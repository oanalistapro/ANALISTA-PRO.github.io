
const admin = require("firebase-admin");

function credencial(nome) {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error("Secret ausente: " + nome);
  }

  const dados = JSON.parse(valor);

  if (
    !dados.project_id ||
    !dados.client_email ||
    !dados.private_key
  ) {
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

const agora = admin.firestore.FieldValue.serverTimestamp();

const LIMITE = 1000;

function texto(valor, max = 300) {
  return String(valor ?? "").slice(0, max);
}

async function buscar(colecao) {
  const snapshot = await dbOrigem
    .collection(colecao)
    .limit(LIMITE)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    dados: doc.data()
  }));
}

async function sincronizarUsuarios() {
  const usuarios = await buscar("users");

  let total = 0;

  for (const item of usuarios) {
    const u = item.dados;

    await dbDestino
      .collection("portalUsers")
      .doc("analista_" + item.id)
      .set({
        portal: "analista",
        sourceUid: item.id,
        displayName: texto(u.name || u.displayName || ""),
        email: texto(u.email || ""),
        provider: "firebase",
        createdAt: u.createdAt || null,
        syncedAt: agora
      }, { merge: true });

    total++;
  }

  return total;
}

async function sincronizarSolicitacoes() {
  const solicitacoes = await buscar("champRequests");

  let total = 0;

  for (const item of solicitacoes) {
    const d = item.dados;

    await dbDestino
      .collection("analistaRequests")
      .doc(item.id)
      .set({
        portal: "analista",
        sourceUid: item.id,
        status: texto(d.status || "desconhecido", 50),
        createdAt: d.createdAt || null,
        reviewedAt: d.reviewedAt || null,
        syncedAt: agora
      }, { merge: true });

    total++;
  }

  return total;
}

async function sincronizarCampeonatos() {
  const colecoes = [
    "pontoCorrido",
    "publicChampionships"
  ];

  let total = 0;

  for (const nome of colecoes) {
    const itens = await buscar(nome);

    for (const item of itens) {
      const d = item.dados;

      await dbDestino
        .collection("analistaChampionships")
        .doc(nome + "_" + item.id)
        .set({
          portal: "analista",
          sourceCollection: nome,
          sourceId: item.id,
          ownerUid: texto(
            d.ownerUid || d.ownerId || item.id,
            150
          ),
          title: texto(
            d.title || d.name || d.nome || "",
            200
          ),
          published: d.published === true,
          syncedAt: agora
        }, { merge: true });

      total++;
    }
  }

  return total;
}

async function sincronizarResumo() {
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
      lastSync: agora
    }, { merge: true });

  console.log("Sincronização concluída", {
    usuarios,
    solicitacoes,
    campeonatos
  });
}

sincronizarResumo()
  .then(() => process.exit(0))
  .catch(erro => {
    console.error("Falha na sincronização:", erro.message);
    process.exit(1);
  });
