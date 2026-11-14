import L from "leaflet";
import { cancelTween, countUp, retrigger, tween } from "./anim";
import { clampDate, LAYERS, layerById, shiftDate, todayISO, type GibsLayer } from "./gibs";
import { applyStatic, fmtDate, fmtN, getLang, setLang, t } from "./i18n";
import { createSwipeMap } from "./map";
import { measureArea } from "./measure";
import { STORIES, type Story } from "./stories";
import { createTimeline } from "./timeline";
import "./styles.css";

/* ---------- durum ---------- */
interface State {
  lat: number; lng: number; zoom: number;
  before: string; after: string;
  layer: GibsLayer;
  story: string | null;
}
const yearOf = (iso: string) => Number(iso.slice(0, 4));
const mmdd = (iso: string) => iso.slice(5);
const CUR_YEAR = yearOf(todayISO());

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

/* ---------- harita ---------- */
const sm = createSwipeMap(document.getElementById("map")!, document.getElementById("swipe")!, t("attribution"));
sm.map.setView([S.lat, S.lng], S.zoom);
sm.setLayer(S.layer, S.before, S.after);

function writeHash() {
  const c = sm.map.getCenter();
  const p = new URLSearchParams({
    lat: c.lat.toFixed(3), lng: c.lng.toFixed(3), z: String(sm.map.getZoom()),
    b: S.before, a: S.after, l: S.layer.id,
  });
  if (S.story) p.set("s", S.story);
  history.replaceState(null, "", "#" + p.toString());
}
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
const yearflash = $("yearflash");
const btnPlay = $<HTMLButtonElement>("btn-play");

function showToast(msg: string) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  retrigger(toast, "show");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

/* ---------- zaman çizelgesi ---------- */
const tl = createTimeline($("timeline"), yearOf(S.layer.minDate), CUR_YEAR);
tl.onChange((b, a, side) => {
  if (playing) stopPlay();
  if (side === "l") applyDates(`${b}-${mmdd(S.before)}`, S.after);
  else applyDates(S.before, `${a}-${mmdd(S.after)}`);
});

function renderDates() {
  dateL.value = S.before;
  dateR.value = S.after;
  dateL.min = dateR.min = S.layer.minDate;
  dateL.max = dateR.max = todayISO();
  badgeL.textContent = fmtDate(S.before);
  badgeR.textContent = fmtDate(S.after);
  tl.set(yearOf(S.before), yearOf(S.after));
}

function applyDates(before: string, after: string) {
  const nb = clampDate(before, S.layer);
  const na = clampDate(after, S.layer);
  if (nb !== S.before) retrigger(badgeL, "bump");
  if (na !== S.after) retrigger(badgeR, "bump");
  S.before = nb;
  S.after = na;
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
$("btn-fine").addEventListener("click", () => {
  $("fine").classList.toggle("hidden");
  $("btn-fine").classList.toggle("on");
});

/* katman seçici */
function renderLayerSelect() {
  layerSel.innerHTML = LAYERS.map(
    (l) => `<option value="${l.id}" ${l.id === S.layer.id ? "selected" : ""}>${getLang() === "tr" ? l.nameTr : l.nameEn}</option>`,
  ).join("");
  layerSel.title = getLang() === "tr" ? S.layer.descTr : S.layer.descEn;
}
layerSel.addEventListener("change", () => {
  if (playing) stopPlay();
  S.layer = layerById(layerSel.value);
  S.before = clampDate(S.before, S.layer);
  S.after = clampDate(S.after, S.layer);
  tl.setRange(yearOf(S.layer.minDate), CUR_YEAR);
  sm.setLayer(S.layer, S.before, S.after);
  renderDates();
  renderLayerSelect();
  result.classList.add("hidden");
  writeHash();
});

/* ---------- hikâyeler ---------- */
const storyList = $("story-list");

/** Kart arka planı için hikâyenin konumundaki gerçek uydu döşemesi (zoom 5). */
function thumbUrl(s: Story): string {
  const z = 5, n = 1 << z;
  const x = Math.floor(((s.lng + 180) / 360) * n);
  const latR = (s.lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  const layer = layerById(s.layer);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${s.after}/${layer.matrix}/${z}/${y}/${x}.${layer.ext}`;
}

function renderStories() {
  const lang = getLang();
  const group = (tag: "tr" | "world") => `
    <div class="group">${t(tag)}</div>
    ${STORIES.filter((s) => s.tag === tag).map((s) => `
      <button class="story ${S.story === s.id ? "on" : ""}" data-id="${s.id}" style="--thumb:url('${thumbUrl(s)}')">
        <span class="emoji">${s.emoji}</span>
        <span class="title">${lang === "tr" ? s.titleTr : s.titleEn}</span>
        <span class="years">${s.before.slice(0, 4)} → ${s.after.slice(0, 4)}</span>
      </button>`).join("")}`;
  storyList.innerHTML = group("tr") + group("world");
  storyList.querySelectorAll<HTMLButtonElement>(".story").forEach((b) => {
    b.addEventListener("click", () => openStory(STORIES.find((s) => s.id === b.dataset.id)!));
  });
}
function markActive() {
  storyList.querySelectorAll<HTMLButtonElement>(".story").forEach((b) => b.classList.toggle("on", b.dataset.id === S.story));
}

function showCaption(s: Story) {
  const lang = getLang();
  $("caption-title").textContent = `${s.emoji} ${lang === "tr" ? s.titleTr : s.titleEn}`;
  $("caption-text").textContent = lang === "tr" ? s.textTr : s.textEn;
  $("caption-src").textContent = s.source;
  caption.classList.remove("hidden");
  retrigger(caption, "show");
}

function openStory(s: Story) {
  if (playing) stopPlay();
  S.story = s.id;
  if (S.layer.id !== s.layer) {
    S.layer = layerById(s.layer);
    S.before = s.before;
    S.after = s.after;
    tl.setRange(yearOf(S.layer.minDate), CUR_YEAR);
    sm.setLayer(S.layer, S.before, S.after);
    renderLayerSelect();
    renderDates();
  } else {
    applyDates(s.before, s.after);
  }
  showCaption(s);
  markActive();
  result.classList.add("hidden");
  document.body.classList.remove("panel-open");
  writeHash();

  const target = L.latLng(s.lat, s.lng);
  const alreadyThere = sm.map.getCenter().distanceTo(target) < 2000 && sm.map.getZoom() === s.zoom;
  if (alreadyThere) void cinematicReveal();
  else {
    sm.map.once("moveend", () => void cinematicReveal());
    sm.map.flyTo(target, s.zoom, { duration: 1.4 });
  }
}
$("caption-close").addEventListener("click", () => caption.classList.add("hidden"));

/* ---------- sinematik süpürme ---------- */
let revealToken = 0;
async function cinematicReveal() {
  const token = ++revealToken;
  cancelTween();
  sm.setSplit(0.03);
  document.body.classList.add("revealing");
  await sm.whenLoaded(3500);
  if (token !== revealToken) return;
  await tween(0.03, 0.97, 1900, (v) => sm.setSplit(v));
  if (token !== revealToken) return;
  await tween(0.97, 0.5, 900, (v) => sm.setSplit(v));
  document.body.classList.remove("revealing");
}

/* ---------- zaman akışı ---------- */
let playing = false;
let playTimer: number | null = null;

function flashYear(y: number) {
  yearflash.textContent = String(y);
  retrigger(yearflash, "pop");
}
async function startPlay() {
  if (yearOf(S.before) >= CUR_YEAR) return;
  playing = true;
  revealToken++;
  btnPlay.textContent = "⏸";
  btnPlay.classList.add("on");
  btnPlay.title = t("playing");
  document.body.classList.add("playing");
  caption.classList.add("hidden");
  result.classList.add("hidden");
  await tween(sm.getSplit(), 0.14, 700, (v) => sm.setSplit(v));
  stepPlay();
}
function stepPlay() {
  if (!playing) return;
  const bY = yearOf(S.before);
  let y = yearOf(S.after) + 1;
  if (y > CUR_YEAR) y = bY + 1;
  S.after = clampDate(`${y}-${mmdd(S.after)}`, S.layer);
  sm.setDates(S.before, S.after);
  renderDates();
  retrigger(badgeR, "bump");
  flashYear(yearOf(S.after));
  tl.highlight(yearOf(S.after));
  writeHash();
  playTimer = window.setTimeout(stepPlay, 1500);
}
function stopPlay() {
  playing = false;
  if (playTimer) clearTimeout(playTimer);
  playTimer = null;
  btnPlay.textContent = "▶";
  btnPlay.classList.remove("on");
  btnPlay.title = t("play");
  document.body.classList.remove("playing");
  tl.highlight(null);
  void tween(sm.getSplit(), 0.5, 600, (v) => sm.setSplit(v));
}
btnPlay.addEventListener("click", () => (playing ? stopPlay() : void startPlay()));

/* ---------- ölçüm ---------- */
$("btn-measure").addEventListener("click", async () => {
  const kind = S.layer.measure;
  if (!kind) {
    showToast(t("nomeasure"));
    return;
  }
  if (playing) stopPlay();
  result.classList.remove("hidden");
  retrigger(result, "show");
  result.innerHTML = `<span class="spin"></span> ${t("measuring")}`;
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
    const maxv = Math.max(a.km2, b.km2, 1);
    result.innerHTML = `
      <div class="res-head"><b>${t(kind)}</b><small>${t("approx")}${cloudy ? " ⚠ " + t("cloudwarn") : ""}</small></div>
      <div class="res-grid">
        <div class="res-col"><span class="yr before">${S.before.slice(0, 4)}</span><span class="num" id="r-a">0</span></div>
        <div class="res-bars">
          <div class="bar before" style="width:${(a.km2 / maxv) * 100}%"></div>
          <div class="bar after" style="width:${(b.km2 / maxv) * 100}%"></div>
        </div>
        <div class="res-col"><span class="yr after">${S.after.slice(0, 4)}</span><span class="num" id="r-b">0</span></div>
        <div class="delta ${pct < 0 ? "down" : "up"}">${sign}${fmtN(pct)} %</div>
      </div>`;
    countUp($("r-a"), a.km2, 900, (v) => `${fmtN(v)} km²`);
    countUp($("r-b"), b.km2, 900, (v) => `${fmtN(v)} km²`);
  } catch {
    result.innerHTML = `<small>⚠ ${t("cloudwarn")}</small>`;
  }
});

/* ---------- konum, paylaş, dil, panel ---------- */
$("btn-locate").addEventListener("click", () => {
  if (!navigator.geolocation) return showToast(t("nolocate"));
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (playing) stopPlay();
      S.story = null;
      const y = CUR_YEAR - 1;
      caption.classList.add("hidden");
      if (S.layer.id !== LAYERS[0].id) {
        S.layer = LAYERS[0];
        tl.setRange(yearOf(S.layer.minDate), CUR_YEAR);
        S.before = "2000-07-15"; S.after = `${y}-07-15`;
        sm.setLayer(S.layer, S.before, S.after);
        renderLayerSelect();
        renderDates();
      } else applyDates("2000-07-15", `${y}-07-15`);
      markActive();
      showToast(t("located"));
      sm.map.once("moveend", () => void cinematicReveal());
      sm.map.flyTo([pos.coords.latitude, pos.coords.longitude], 9, { duration: 1.6 });
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
  btnPlay.title = t(playing ? "playing" : "play");
  const s = STORIES.find((x) => x.id === S.story);
  if (s && !caption.classList.contains("hidden")) showCaption(s);
}
langBtn.addEventListener("click", () => {
  setLang(getLang() === "tr" ? "en" : "tr");
  renderLang();
});

$("panel-toggle").addEventListener("click", () => document.body.classList.toggle("panel-open"));

/* ---------- klavye ---------- */
document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    if ((e.target as HTMLElement).classList?.contains("tl-handle")) return;
    cancelTween();
    sm.setSplit(sm.getSplit() + (e.key === "ArrowRight" ? 0.02 : -0.02));
    e.preventDefault();
  } else if (e.key === " ") {
    e.preventDefault();
    playing ? stopPlay() : void startPlay();
  } else if (e.key === "Escape") {
    caption.classList.add("hidden");
    dismissIntro();
    if (playing) stopPlay();
  }
});

/* ---------- giriş ekranı ---------- */
const intro = $("intro");
let introDone = false;
function dismissIntro() {
  if (introDone) return;
  introDone = true;
  intro.classList.add("out");
  setTimeout(() => intro.remove(), 700);
  void cinematicReveal();
}
$("btn-start").addEventListener("click", dismissIntro);
intro.addEventListener("click", (e) => {
  if (e.target === intro) dismissIntro();
});
setTimeout(dismissIntro, 6000);

/* ---------- başlangıç ---------- */
renderLang();
{
  const s = STORIES.find((x) => x.id === S.story);
  if (s) showCaption(s);
}
sm.setSplit(0.03);
writeHash();
