
const admin = require("firebase-admin");

function credencial(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error("Secret ausente: " + nome);

  const dados = JSON.parse(valor);

  if (!dados.project_id ||
      !dados.client_email ||
      !dados.private_key) {
    throw new Error("Credencial inválida: " + nome);
  }

  return admin.credential.cert(dados);
}

const origem = admin.initializeApp({
  credential: credencial("FIREBASE_ANALISTA_ADMIN")
}, "analista");

const destino = admin.initializeApp({
  credential: credencial("FIREBASE_CENTRAL_ADMIN")
}, "central");

const dbOrigem = origem.firestore();
const dbDestino = destino.firestore();
const serverTime = admin.firestore.FieldValue.serverTimestamp;

function texto(v, max = 300) {
  return String(v ?? "").slice(0, max);
}

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dataSegura(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function lista(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    return Object.values(v);
  }
  return [];
}

function equipesResumidas(dados) {
  const fonte =
    dados.teams ??
    dados.equipes ??
    dados.times ??
    [];

  return lista(fonte).slice(0, 100).map((e, i) => {
    if (typeof e === "string") {
      return {
        nome: texto(e, 100),
        posicao: i + 1,
        pontos: 0,
        kills: 0
      };
    }

    if (!e || typeof e !== "object") {
      return {
        nome: "Equipe " + (i + 1),
        posicao: i + 1,
        pontos: 0,
        kills: 0
      };
    }

    return {
      nome: texto(
        e.name ?? e.nome ?? e.tag ??
        e.teamName ?? "Equipe " + (i + 1),
        100
      ),
      posicao: numero(
        e.position ?? e.posicao ?? e.rank ?? i + 1
      ),
      pontos: numero(
        e.points ?? e.pontos ?? e.totalPoints ?? 0
      ),
      kills: numero(
        e.kills ?? e.abates ?? e.totalKills ?? 0
      )
    };
  });
}

async function buscarTudo(nome) {
  const resultados = [];
  let ultimo = null;

  while (true) {
    let consulta = dbOrigem
      .collection(nome)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(300);

    if (ultimo) consulta = consulta.startAfter(ultimo);

    const snap = await consulta.get();

    if (snap.empty) break;

    for (const d of snap.docs) {
      resultados.push({ id: d.id, dados: d.data() });
    }

    ultimo = snap.docs[snap.docs.length - 1];

    if (snap.size < 300) break;
  }

  return resultados;
}

async function salvar(colecao, id, dados) {
  await dbDestino.collection(colecao).doc(id).set({
    ...dados,
    syncedAt: serverTime()
  }, { merge: true });
}

async function sincronizarUsuarios() {
  const itens = await buscarTudo("users");

  for (const { id, dados: d } of itens) {
    await salvar("portalUsers", "analista_" + id, {
      portal: "analista",
      sourceUid: id,
      displayName: texto(d.name ?? d.displayName ?? ""),
      email: texto(d.email ?? ""),
      provider: "firebase",
      createdAt: dataSegura(d.createdAt),
      lastLoginAt: dataSegura(d.lastLoginAt)
    });
  }

  return itens.length;
}

async function sincronizarSolicitacoes() {
  const itens = await buscarTudo("champRequests");

  for (const { id, dados: d } of itens) {
    await salvar("analistaRequests", id, {
      portal: "analista",
      sourceUid: id,
      status: texto(d.status ?? "desconhecido", 50),
      createdAt: dataSegura(d.createdAt),
      reviewedAt: dataSegura(d.reviewedAt),
      reviewedBy: texto(d.reviewedBy ?? "", 150)
    });
  }

  return itens.length;
}

async function sincronizarCampeonatos() {
  const colecoes = [
    "pontoCorrido",
    "publicChampionships"
  ];

  let total = 0;

  for (const colecao of colecoes) {
    const itens = await buscarTudo(colecao);

    for (const { id, dados: d } of itens) {
      const equipes = equipesResumidas(d);

      await salvar(
        "analistaChampionships",
        colecao + "_" + id,
        {
          portal: "analista",
          sourceCollection: colecao,
          sourceId: id,
          ownerUid: texto(
            d.ownerUid ?? d.ownerId ?? id,
            150
          ),
          title: texto(
            d.title ?? d.name ?? d.nome ?? "",
            200
          ),
          published: d.published === true,
          status: texto(d.status ?? "", 50),
          teamCount: equipes.length,
          teams: equipes,
          createdAt: dataSegura(d.createdAt)
        }
      );

      total++;
    }
  }

  return total;
}

async function executar() {
  console.log("Iniciando sincronização ANALISTA PRO");

  const usuarios = await sincronizarUsuarios();
  const solicitacoes = await sincronizarSolicitacoes();
  const campeonatos = await sincronizarCampeonatos();

  await dbDestino
    .collection("settings")
    .doc("analistaSync")
    .set({
      portal: "analista",
      status: "connected",
      usersCount: usuarios,
      requestsCount: solicitacoes,
      championshipsCount: campeonatos,
      lastSync: serverTime()
    }, { merge: true });

  console.log(
    "Sincronização concluída ***",
    "usuários:", usuarios,
    "solicitações:", solicitacoes,
    "campeonatos:", campeonatos,
    "***"
  );
}

executar()
  .then(() => process.exit(0))
  .catch(erro => {
    console.error("ERRO:", erro);
    process.exit(1);
  });
