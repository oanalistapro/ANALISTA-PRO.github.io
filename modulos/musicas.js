
/* ANALISTA PRO UNIVERSAL — MÚSICAS V2 */
(function () {
  "use strict";

  const app = window.AnalistaPro;

  if (!app || typeof app.register !== "function") {
    console.warn("Sistema Universal não carregado.");
    return;
  }

  app.register({
    id: "musicas",
    name: "Músicas",
    icon: "🎵",

    render(container) {
      container.innerHTML = `
        <div style="
          background:#101e30;
          color:white;
          padding:20px;
          border-radius:18px;
          border:1px solid #31567c;
        ">
          <h2>🎵 Música do celular</h2>
          <p>Escolha uma música dos seus arquivos.</p>

          <input
            id="musicaArquivo"
            type="file"
            accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav"
            style="display:block;width:100%;margin:15px 0"
          >

          <p id="musicaNome">Nenhuma música escolhida</p>

          <button id="musicaPlay" type="button">
            ▶ Reproduzir
          </button>

          <button id="musicaPause" type="button">
            ⏸ Pausar
          </button>

          <p>Volume</p>
          <input
            id="musicaVolume"
            type="range"
            min="0"
            max="100"
            value="30"
            style="width:100%"
          >

          <p id="musicaStatus"></p>

          <audio id="musicaAudio" loop></audio>
        </div>
      `;

      const get = id =>
        container.querySelector("#" + id);

      const arquivo = get("musicaArquivo");
      const audio = get("musicaAudio");
      const status = get("musicaStatus");

      let urlAtual = null;

      audio.volume = 0.3;

      arquivo.addEventListener("change", event => {
        const musica = event.target.files?.[0];

        if (!musica) return;

        if (
          !musica.type.startsWith("audio/") &&
          !/\.(mp3|m4a|aac|ogg|wav)$/i.test(musica.name)
        ) {
          status.textContent = "Arquivo inválido.";
          return;
        }

        audio.pause();

        if (urlAtual) {
          URL.revokeObjectURL(urlAtual);
        }

        urlAtual = URL.createObjectURL(musica);
        audio.src = urlAtual;

        get("musicaNome").textContent =
          "🎵 " + musica.name;

        status.textContent =
          "Música selecionada. Aperte Reproduzir.";
      });

      get("musicaPlay").onclick = async () => {
        if (!audio.src) {
          status.textContent =
            "Escolha uma música primeiro.";
          return;
        }

        try {
          await audio.play();
          status.textContent = "▶ Reproduzindo";
        } catch (erro) {
          status.textContent =
            "Não foi possível tocar: " + erro.message;
        }
      };

      get("musicaPause").onclick = () => {
        audio.pause();
        status.textContent = "⏸ Música pausada";
      };

      get("musicaVolume").oninput = event => {
        audio.volume = Number(event.target.value) / 100;
      };
    }
  });
})();
