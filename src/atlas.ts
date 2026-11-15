/** Dünya Atlası — NASA GIBS önce/sonra kaydırıcısı, yıl çizelgesi ve değişim ölçer. */
import L from "leaflet";
import { cancelTween, countUp, retrigger, tween } from "./anim";
import { clampDate, LAYERS, layerById, shiftDate, snapToCadence, todayISO, type GibsLayer } from "./gibs";
import { findNearestWithData, probeCoverage } from "./coverage";
import { fmtDate, fmtN, getLang, t } from "./i18n";
import { createSwipeMap } from "./map";
import { measureArea } from "./measure";
import { STORIES, type Story } from "./stories";
import { createTimeline } from "./timeline";

interface State {
  before: string; after: string;
  layer: GibsLayer;
  story: string | null;
}
const yearOf = (iso: string) => Number(iso.slice(0, 4));
const mmdd = (iso: string) => iso.slice(5);
const CUR_YEAR = yearOf(todayISO());

function parseHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ""));
  return {
    lat: p.get("lat") ? Number(p.get("lat")) : undefined,
    lng: p.get("lng") ? Number(p.get("lng")) : undefined,
    zoom: p.get("z") ? Number(p.get("z")) : undefined,
    before: p.get("b") ?? undefined,
    after: p.get("a") ?? undefined,
    layer: p.get("l") ? layerById(p.get("l")!) : undefined,
    story: p.get("s") ?? undefined,
  };
}

const first = STORIES[0];
const h = parseHash();
const S: State = {
  before: h.before ?? first.before,
  after: h.after ?? first.after,
  layer: h.layer ?? layerById(first.layer),
  story: h.story ?? first.id,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const sm = createSwipeMap($("map"), $("swipe"), t("attribution"));
sm.map.setView([h.lat ?? first.lat, h.lng ?? first.lng], h.zoom ?? first.zoom);
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
sm.map.on("moveend", () => { writeHash(); scheduleProbe(1200); });

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
const eyebadge = $("eyebadge");

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
  // 8 günlük ürünlerde aradaki günler boş gelir: geçerli döneme oturt
  const nb = snapToCadence(clampDate(before, S.layer), S.layer);
  const na = snapToCadence(clampDate(after, S.layer), S.layer);
  if (nb !== S.before) retrigger(badgeL, "bump");
  if (na !== S.after) retrigger(badgeR, "bump");
  S.before = nb;
  S.after = na;
  sm.setDates(S.before, S.after);
  renderDates();
  result.classList.add("hidden");
  writeHash();
  scheduleProbe();
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
  emptyYears.clear();
  writeHash();
  scheduleProbe();
});

/* ---------- hikâyeler ---------- */
const storyList = $("story-list");

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
  const zoom = Math.min(s.zoom, sm.map.getMaxZoom());
  if (sm.map.getCenter().distanceTo(target) < 2000 && sm.map.getZoom() === zoom) void cinematicReveal();
  else {
    sm.map.once("moveend", () => void cinematicReveal());
    sm.map.flyTo(target, zoom, { duration: 1.4 });
  }
}
$("caption-close").addEventListener("click", () => caption.classList.add("hidden"));

/* ---------- sinematik süpürme ---------- */
let revealToken = 0;
let revealGuard: number | null = null;

/** Süpürme hangi noktada kesilirse kesilsin, kaydırıcı ortada ve açık kalır. */
function endReveal(token: number) {
  if (token !== revealToken) return;
  if (revealGuard) { clearTimeout(revealGuard); revealGuard = null; }
  cancelTween();
  sm.setSplit(0.5);
  document.body.classList.remove("revealing");
}

async function cinematicReveal() {
  const token = ++revealToken;
  cancelTween();
  if (revealGuard) clearTimeout(revealGuard);
  // emniyet kemeri: ne olursa olsun 7 sn sonra normale dön
  revealGuard = window.setTimeout(() => endReveal(token), 7000);
  sm.setSplit(0.03);
  document.body.classList.add("revealing");
  await sm.whenLoaded(3500);
  if (token !== revealToken) return;
  await tween(0.03, 0.97, 1900, (v) => { if (token === revealToken) sm.setSplit(v); });
  if (token !== revealToken) return;
  await tween(0.97, 0.5, 900, (v) => { if (token === revealToken) sm.setSplit(v); });
  endReveal(token);
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
  let y = yearOf(S.after) + 1;
  if (y > CUR_YEAR) y = yearOf(S.before) + 1;
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

/* ---------- bu tarihte kayıt var mı? ---------- */
const nodata = $("nodata");
const emptyYears = new Set<number>();
let probeTimer: number | null = null;
let probeRun = 0;

function scheduleProbe(delay = 700) {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = window.setTimeout(() => void runProbe(), delay);
}

async function runProbe() {
  const run = ++probeRun;
  const bounds = sm.map.getBounds();
  const zoom = sm.map.getZoom();
  const [ca, cb] = await Promise.all([
    probeCoverage(S.layer, S.before, bounds, zoom),
    probeCoverage(S.layer, S.after, bounds, zoom),
  ]);
  if (run !== probeRun) return;

  for (const [iso, cov] of [[S.before, ca], [S.after, cb]] as const) {
    if (!cov.checked) continue;
    if (cov.ok) emptyYears.delete(yearOf(iso));
    else emptyYears.add(yearOf(iso));
  }
  tl.setEmptyYears(emptyYears);

  const bad = ([["l", S.before, ca], ["r", S.after, cb]] as const).filter(([, , c]) => c.checked && !c.ok);
  if (bad.length === 0) { nodata.classList.add("hidden"); return; }

  nodata.innerHTML = bad.map(([side, iso, c]) => `
    <div class="nd-row" data-side="${side}">
      <span class="nd-side ${side}">${t(side === "l" ? "before" : "after")}</span>
      <div class="nd-txt">
        <b>${fmtDate(iso)} — ${t("nodataTitle")}</b>
        <small>${t("nodataWhy")} · ${Math.round(c.dataFraction * 100)}% ${t("nodataCover")}</small>
      </div>
      <button class="nd-jump" data-side="${side}" data-iso="${iso}">${t("nodataJump")}</button>
    </div>`).join("");
  nodata.classList.remove("hidden");
  retrigger(nodata, "show");
  nodata.querySelectorAll<HTMLButtonElement>(".nd-jump").forEach((b) =>
    b.addEventListener("click", () => void jumpToData(b.dataset.side as "l" | "r", b)));
}

async function jumpToData(side: "l" | "r", btn: HTMLButtonElement) {
  btn.disabled = true;
  btn.textContent = t("nodataSearching");
  const iso = side === "l" ? S.before : S.after;
  const found = await findNearestWithData(
    S.layer, iso, sm.map.getBounds(), sm.map.getZoom(),
    shiftDate, (x) => clampDate(x, S.layer),
  );
  if (!found) {
    btn.textContent = t("nodataNone");
    return;
  }
  if (side === "l") applyDates(found, S.after);
  else applyDates(S.before, found);
  showToast(t("nodataJumped"));
}

/* ---------- ölçüm ---------- */
$("btn-measure").addEventListener("click", async () => {
  const kind = S.layer.measure;
  if (!kind) return showToast(t("nomeasure"));
  if (playing) stopPlay();
  result.classList.remove("hidden");
  retrigger(result, "show");
  result.innerHTML = `<span class="spin"></span> ${t("measuring")}`;
  const size = sm.map.getSize();
  const bounds = L.latLngBounds(
    sm.map.containerPointToLatLng([size.x * 0.2, size.y * 0.2]),
    sm.map.containerPointToLatLng([size.x * 0.8, size.y * 0.8]),
  );
  const zoom = sm.map.getZoom();
  try {
    const [a, b] = await Promise.all([
      measureArea(S.layer, S.before, bounds, zoom, kind),
      measureArea(S.layer, S.after, bounds, zoom, kind),
    ]);
    const pct = a.km2 > 0 ? ((b.km2 - a.km2) / a.km2) * 100 : 0;
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
        <div class="delta ${pct < 0 ? "down" : "up"}">${pct > 0 ? "+" : ""}${fmtN(pct)} %</div>
      </div>`;
    countUp($("r-a"), a.km2, 900, (v) => `${fmtN(v)} km²`);
    countUp($("r-b"), b.km2, 900, (v) => `${fmtN(v)} km²`);
  } catch {
    result.innerHTML = `<small>⚠ ${t("cloudwarn")}</small>`;
  }
});

/* ---------- konum, paylaş, panel ---------- */
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
      sm.map.flyTo([pos.coords.latitude, pos.coords.longitude], Math.min(9, sm.map.getMaxZoom()), { duration: 1.6 });
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

$("panel-toggle").addEventListener("click", () => document.body.classList.toggle("panel-open"));

document.addEventListener("keydown", (e) => {
  if (!document.getElementById("atlas")?.classList.contains("on")) return;
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
    if (playing) stopPlay();
  }
});

/* ---------- dış arayüz ---------- */
let shown = false;

/** @param reveal Hemen ardından openStoryById çağrılacaksa false verilir (çift süpürme olmasın). */
export function atlasShow(reveal = true) {
  renderDates();
  renderLayerSelect();
  renderStories();
  requestAnimationFrame(() => {
    sm.map.invalidateSize();
    scheduleProbe(900);
    if (!shown) {
      shown = true;
      const s = STORIES.find((x) => x.id === S.story);
      if (s) showCaption(s);
      if (reveal) void cinematicReveal();
    }
  });
}

export function openStoryById(id: string) {
  const s = STORIES.find((x) => x.id === id);
  if (!s) return;
  shown = true;
  requestAnimationFrame(() => {
    sm.map.invalidateSize();
    openStory(s);
  });
}

/** Oyundaki kameranın çözünürlüğü, atlasta anlamlı yakınlaştırma sınırını belirler. */
export function setMaxZoom(z: number) {
  const zz = Math.max(3, Math.min(9, z));
  sm.map.setMaxZoom(zz);
  if (sm.map.getZoom() > zz) sm.map.setZoom(zz);
}

type EyeInfo = { resolutionM: number; score: number; stars: number; maxZoom: number };
let lastEye: EyeInfo | null = null;

export function setEyeBadge(info: EyeInfo) {
  lastEye = info;
  const tr = getLang() === "tr";
  eyebadge.innerHTML = `
    <b>🛰 ${tr ? "Senin uydun" : "Your satellite"}</b>
    <span>${info.resolutionM} m · ${"★".repeat(info.stars)}${"☆".repeat(3 - info.stars)} ${info.score}/100</span>
    <small>${tr ? `yakınlaştırma sınırı z${info.maxZoom}` : `zoom limited to z${info.maxZoom}`}</small>`;
  eyebadge.classList.remove("hidden");
  retrigger(eyebadge, "show");
}

export function clearEyeBadge() {
  lastEye = null;
  eyebadge.classList.add("hidden");
  sm.map.setMaxZoom(9);
}

export function relang() {
  renderDates();
  renderLayerSelect();
  renderStories();
  btnPlay.title = t(playing ? "playing" : "play");
  const s = STORIES.find((x) => x.id === S.story);
  if (s && !caption.classList.contains("hidden")) showCaption(s);
  if (lastEye) setEyeBadge(lastEye);
}
