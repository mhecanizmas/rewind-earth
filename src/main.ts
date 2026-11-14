import L from "leaflet";
import { clampDate, LAYERS, layerById, shiftDate, todayISO, type GibsLayer } from "./gibs";
import { applyStatic, fmtDate, fmtN, getLang, setLang, t } from "./i18n";
import { createSwipeMap } from "./map";
import { measureArea } from "./measure";
import { STORIES, type Story } from "./stories";
import "./styles.css";

/* ---------- durum ---------- */
interface State {
  lat: number; lng: number; zoom: number;
  before: string; after: string;
  layer: GibsLayer;
  story: string | null;
}

function parseHash(): Partial<State> {
  const h = location.hash.replace(/^#/, "");
  if (!h) return {};
  const p = new URLSearchParams(h);
  const out: Partial<State> = {};
  if (p.get("lat")) out.lat = Number(p.get("lat"));
  if (p.get("lng")) out.lng = Number(p.get("lng"));
  if (p.get("z")) out.zoom = Number(p.get("z"));
  if (p.get("b")) out.before = p.get("b")!;
  if (p.get("a")) out.after = p.get("a")!;
  if (p.get("l")) out.layer = layerById(p.get("l")!);
  if (p.get("s")) out.story = p.get("s");
  return out;
}

const first = STORIES[0];
const fromHash = parseHash();
const S: State = {
  lat: fromHash.lat ?? first.lat,
  lng: fromHash.lng ?? first.lng,
  zoom: fromHash.zoom ?? first.zoom,
  before: fromHash.before ?? first.before,
  after: fromHash.after ?? first.after,
  layer: fromHash.layer ?? layerById(first.layer),
  story: fromHash.story === undefined ? first.id : fromHash.story,
};

function writeHash() {
  const c = sm.map.getCenter();
  const p = new URLSearchParams({
    lat: c.lat.toFixed(3), lng: c.lng.toFixed(3), z: String(sm.map.getZoom()),
    b: S.before, a: S.after, l: S.layer.id,
  });
  if (S.story) p.set("s", S.story);
  history.replaceState(null, "", "#" + p.toString());
}

/* ---------- harita ---------- */
const sm = createSwipeMap(document.getElementById("map")!, document.getElementById("swipe")!, t("attribution"));
sm.map.setView([S.lat, S.lng], S.zoom);
sm.setLayer(S.layer, S.before, S.after);
sm.map.on("moveend", writeHash);

/* ---------- elemanlar ---------- */
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dateL = $<HTMLInputElement>("date-l");
const dateR = $<HTMLInputElement>("date-r");
const badgeL = $("badge-l");
const badgeR = $("badge-r");
const layerSel = $<HTMLSelectElement>("layer");
const result = $("result");
const caption = $("caption");
const toast = $("toast");

function showToast(msg: string) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function renderDates() {
  dateL.value = S.before;
  dateR.value = S.after;
  dateL.min = dateR.min = S.layer.minDate;
  dateL.max = dateR.max = todayISO();
  badgeL.textContent = fmtDate(S.before);
  badgeR.textContent = fmtDate(S.after);
}

function applyDates(before: string, after: string) {
  S.before = clampDate(before, S.layer);
  S.after = clampDate(after, S.layer);
  sm.setDates(S.before, S.after);
  renderDates();
  result.classList.add("hidden");
  writeHash();
}

dateL.addEventListener("change", () => applyDates(dateL.value || S.before, S.after));
dateR.addEventListener("change", () => applyDates(S.before, dateR.value || S.after));
document.querySelectorAll<HTMLButtonElement>(".step").forEach((b) => {
  b.addEventListener("click", () => {
    const d = Number(b.dataset.d);
    if (b.dataset.side === "l") applyDates(shiftDate(S.before, d), S.after);
    else applyDates(S.before, shiftDate(S.after, d));
  });
});

/* katman seçici */
function renderLayerSelect() {
  layerSel.innerHTML = LAYERS.map(
    (l) => `<option value="${l.id}" ${l.id === S.layer.id ? "selected" : ""}>${getLang() === "tr" ? l.nameTr : l.nameEn}</option>`,
  ).join("");
  layerSel.title = getLang() === "tr" ? S.layer.descTr : S.layer.descEn;
}
layerSel.addEventListener("change", () => {
  S.layer = layerById(layerSel.value);
  S.before = clampDate(S.before, S.layer);
  S.after = clampDate(S.after, S.layer);
  sm.setLayer(S.layer, S.before, S.after);
  renderDates();
  renderLayerSelect();
  result.classList.add("hidden");
  writeHash();
});

/* ---------- hikâyeler ---------- */
const storyList = $("story-list");
function renderStories() {
  const lang = getLang();
  const group = (tag: "tr" | "world") => `
    <div class="group">${t(tag)}</div>
    ${STORIES.filter((s) => s.tag === tag).map((s) => `
      <button class="story ${S.story === s.id ? "on" : ""}" data-id="${s.id}">
        <span class="emoji">${s.emoji}</span>
        <span class="title">${lang === "tr" ? s.titleTr : s.titleEn}</span>
        <span class="years">${s.before.slice(0, 4)} → ${s.after.slice(0, 4)}</span>
      </button>`).join("")}`;
  storyList.innerHTML = group("tr") + group("world");
  storyList.querySelectorAll<HTMLButtonElement>(".story").forEach((b) => {
    b.addEventListener("click", () => openStory(STORIES.find((s) => s.id === b.dataset.id)!));
  });
}
/** Listeyi yeniden kurmadan sadece seçili vurgusunu günceller. */
function markActive() {
  storyList.querySelectorAll<HTMLButtonElement>(".story").forEach((b) => b.classList.toggle("on", b.dataset.id === S.story));
}

function openStory(s: Story) {
  S.story = s.id;
  const lang = getLang();
  if (S.layer.id !== s.layer) {
    S.layer = layerById(s.layer);
    S.before = s.before;
    S.after = s.after;
    sm.setLayer(S.layer, S.before, S.after);
    renderLayerSelect();
    renderDates();
  } else {
    applyDates(s.before, s.after);
  }
  sm.map.flyTo([s.lat, s.lng], s.zoom, { duration: 1.4 });
  sm.setSplit(0.5);
  $("caption-title").textContent = `${s.emoji} ${lang === "tr" ? s.titleTr : s.titleEn}`;
  $("caption-text").textContent = lang === "tr" ? s.textTr : s.textEn;
  $("caption-src").textContent = s.source;
  caption.classList.remove("hidden");
  markActive();
  result.classList.add("hidden");
  document.body.classList.remove("panel-open");
  writeHash();
}
$("caption-close").addEventListener("click", () => caption.classList.add("hidden"));

/* ---------- ölçüm ---------- */
$("btn-measure").addEventListener("click", async () => {
  const kind = S.layer.measure;
  if (!kind) {
    showToast(t("nomeasure"));
    return;
  }
  result.classList.remove("hidden");
  result.innerHTML = `<span class="spin"></span> ${t("measuring")}`;
  // Kesikli çerçeve: ekranın ortasındaki %60×%60 alan (CSS ile aynı)
  const size = sm.map.getSize();
  const nw = sm.map.containerPointToLatLng([size.x * 0.2, size.y * 0.2]);
  const se = sm.map.containerPointToLatLng([size.x * 0.8, size.y * 0.8]);
  const bounds = L.latLngBounds(nw, se);
  const zoom = sm.map.getZoom();
  try {
    const [a, b] = await Promise.all([
      measureArea(S.layer, S.before, bounds, zoom, kind),
      measureArea(S.layer, S.after, bounds, zoom, kind),
    ]);
    const pct = a.km2 > 0 ? ((b.km2 - a.km2) / a.km2) * 100 : 0;
    const sign = pct > 0 ? "+" : "";
    const cloudy = a.cloudFraction > 0.35 || b.cloudFraction > 0.35;
    result.innerHTML = `
      <b>${t(kind)}</b>
      <span class="v">${S.before.slice(0, 4)}: <b>${fmtN(a.km2)} km²</b></span>
      <span class="arrow">→</span>
      <span class="v">${S.after.slice(0, 4)}: <b>${fmtN(b.km2)} km²</b></span>
      <span class="delta ${pct < 0 ? "down" : "up"}">${sign}${fmtN(pct)} %</span>
      <small>${t("approx")}${cloudy ? " ⚠ " + t("cloudwarn") : ""}</small>`;
  } catch {
    result.innerHTML = `<small>⚠ ${t("cloudwarn")}</small>`;
  }
});

/* ---------- konum, paylaş, dil, panel ---------- */
$("btn-locate").addEventListener("click", () => {
  if (!navigator.geolocation) return showToast(t("nolocate"));
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      S.story = null;
      const y = new Date().getUTCFullYear() - 1;
      caption.classList.add("hidden");
      sm.map.flyTo([pos.coords.latitude, pos.coords.longitude], 9, { duration: 1.6 });
      if (S.layer.id !== LAYERS[0].id) {
        S.layer = LAYERS[0];
        sm.setLayer(S.layer, "2000-07-15", `${y}-07-15`);
        renderLayerSelect();
        S.before = "2000-07-15"; S.after = `${y}-07-15`;
        renderDates();
      } else applyDates("2000-07-15", `${y}-07-15`);
      showToast(t("located"));
      markActive();
    },
    () => showToast(t("nolocate")),
    { timeout: 8000 },
  );
});

$("btn-share").addEventListener("click", async () => {
  writeHash();
  try {
    await navigator.clipboard.writeText(location.href);
    showToast(t("copied"));
  } catch {
    prompt("URL", location.href);
  }
});

const langBtn = $("btn-lang");
function renderLang() {
  langBtn.textContent = getLang() === "tr" ? "EN" : "TR";
  document.documentElement.lang = getLang();
  applyStatic();
  renderDates();
  renderLayerSelect();
  renderStories();
  if (S.story) {
    const s = STORIES.find((x) => x.id === S.story);
    if (s && !caption.classList.contains("hidden")) {
      $("caption-title").textContent = `${s.emoji} ${getLang() === "tr" ? s.titleTr : s.titleEn}`;
      $("caption-text").textContent = getLang() === "tr" ? s.textTr : s.textEn;
    }
  }
}
langBtn.addEventListener("click", () => {
  setLang(getLang() === "tr" ? "en" : "tr");
  renderLang();
});

$("panel-toggle").addEventListener("click", () => document.body.classList.toggle("panel-open"));

/* ---------- başlangıç ---------- */
renderLang();
if (S.story) {
  const s = STORIES.find((x) => x.id === S.story);
  if (s) {
    $("caption-title").textContent = `${s.emoji} ${getLang() === "tr" ? s.titleTr : s.titleEn}`;
    $("caption-text").textContent = getLang() === "tr" ? s.textTr : s.textEn;
    $("caption-src").textContent = s.source;
    caption.classList.remove("hidden");
  }
}
writeHash();
