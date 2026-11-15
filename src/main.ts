/**
 * Kabuk: giriş ekranı (hub) + iki mod.
 *   🛰 Uydunu Kur  — 3B uydu tasarım oyunu (Three.js)
 *   🌍 Dünya Atlası — NASA GIBS önce/sonra kaydırıcısı (Leaflet)
 * Oyunun sonucu atlası açar: kameranın çözünürlüğü yakınlaştırma sınırını belirler.
 */
import { applyStatic, getLang, setLang } from "./i18n";
import "./styles.css";
import "./game/game.css";

type Mode = "hub" | "game" | "atlas";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hub = $("hub");
const gameRoot = $("game-root");
const atlasRoot = $("atlas");
const sw = $("switch");

let mode: Mode = "hub";
let game: import("./game/game").Game | null = null;
let atlas: typeof import("./atlas") | null = null;
let loadingGame = false;

/* ---------- mod geçişi ---------- */
interface EyeInfo { resolutionM: number; score: number; stars: number; maxZoom: number }

async function go(next: Mode, opts?: { story?: string; maxZoom?: number; eye?: EyeInfo }) {
  mode = next;
  hub.classList.toggle("out", next !== "hub");
  sw.classList.toggle("hidden", next === "hub");
  gameRoot.classList.toggle("on", next === "game");
  atlasRoot.classList.toggle("on", next === "atlas");
  sw.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
    b.classList.toggle("on", b.dataset.mode === next));

  if (next === "game") {
    if (!game && !loadingGame) {
      loadingGame = true;
      showLoading(true);
      const { createGame } = await import("./game/game");
      game = createGame(gameRoot, (res) =>
        void go("atlas", {
          story: res.mission.story,
          maxZoom: res.maxZoom,
          eye: {
            resolutionM: res.selection.camera === "cam-sharp" ? 1 : res.selection.camera === "cam-mid" ? 30 : 250,
            score: res.score,
            stars: res.stars,
            maxZoom: res.maxZoom,
          },
        }));
      loadingGame = false;
      showLoading(false);
    }
    game?.start();
    requestAnimationFrame(() => game?.resize());
  } else {
    game?.stop();
  }

  if (next === "atlas") {
    if (!atlas) {
      showLoading(true);
      atlas = await import("./atlas");
      showLoading(false);
    }
    atlas.atlasShow(!opts?.story);
    if (opts?.maxZoom !== undefined) atlas.setMaxZoom(opts.maxZoom);
    if (opts?.story) atlas.openStoryById(opts.story);
    if (opts?.eye) atlas.setEyeBadge(opts.eye);
    else if (!opts?.story) atlas.clearEyeBadge();
  }
}

function showLoading(on: boolean) {
  let el = document.getElementById("boot");
  if (on) {
    if (!el) {
      el = document.createElement("div");
      el.id = "boot";
      el.innerHTML = `<div class="boot-ring"></div>`;
      document.body.appendChild(el);
    }
  } else el?.remove();
}

/* ---------- bağlantılar ---------- */
hub.querySelectorAll<HTMLButtonElement>(".hub-card").forEach((b) =>
  b.addEventListener("click", () => void go(b.dataset.go as Mode)));
$("sw-home").addEventListener("click", () => void go("hub"));
sw.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => void go(b.dataset.mode as Mode)));

function toggleLang() {
  setLang(getLang() === "tr" ? "en" : "tr");
  renderLang();
  atlas?.relang();
  game?.relang();
}
$("btn-lang").addEventListener("click", toggleLang);
$("hub-lang").addEventListener("click", toggleLang);

function renderLang() {
  const en = getLang() === "en";
  $("btn-lang").textContent = en ? "TR" : "EN";
  $("hub-lang").textContent = en ? "TR" : "EN";
  document.documentElement.lang = getLang();
  applyStatic();
}

window.addEventListener("resize", () => {
  if (mode === "game") game?.resize();
});

renderLang();

// derin bağlantı: #game ile doğrudan oyuna gir
function fromHash() {
  if (location.hash.startsWith("#game")) void go("game");
  else if (location.hash.length > 3) void go("atlas");
}
window.addEventListener("hashchange", () => {
  if (mode === "hub") fromHash();
});
fromHash();
