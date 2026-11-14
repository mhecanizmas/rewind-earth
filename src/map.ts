import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { tileUrl, type GibsLayer } from "./gibs";

export interface SwipeMap {
  map: L.Map;
  setLayer(layer: GibsLayer, before: string, after: string): void;
  setDates(before: string, after: string): void;
  setSplit(frac: number): void;
  getSplit(): number;
}

/** İki NASA GIBS katmanını aynı haritada, dikey bir kaydırıcıyla ayırarak gösterir. */
export function createSwipeMap(mapEl: HTMLElement, swipeEl: HTMLElement, attribution: string): SwipeMap {
  const map = L.map(mapEl, {
    zoomControl: false,
    minZoom: 2,
    maxZoom: 9,
    worldCopyJump: true,
    zoomSnap: 1, // yarım zoom yok: her ara seviye ayrı döşeme indiriyordu
    attributionControl: true,
  });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution(attribution);

  let left: L.TileLayer | null = null;
  let right: L.TileLayer | null = null;
  let split = 0.5;

  function make(layer: GibsLayer, date: string, z: number) {
    return L.tileLayer(tileUrl(layer, date), {
      tileSize: 256,
      maxNativeZoom: layer.maxZoom,
      maxZoom: 9,
      zIndex: z,
      crossOrigin: "anonymous",
      // Veri tasarrufu: ekran dışı tampon yok, kaydırma/zoom bitince yükle,
      // zoom animasyonu sırasındaki ara seviyeleri hiç indirme.
      keepBuffer: 0,
      updateWhenIdle: true,
      updateWhenZooming: false,
    });
  }

  function clip() {
    if (!left || !right) return;
    const size = map.getSize();
    const nw = map.containerPointToLayerPoint([0, 0]);
    const se = map.containerPointToLayerPoint(size);
    const x = nw.x + size.x * split;
    const lc = left.getContainer();
    const rc = right.getContainer();
    if (lc) lc.style.clip = `rect(${nw.y}px, ${x}px, ${se.y}px, ${nw.x}px)`;
    if (rc) rc.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${x}px)`;
    swipeEl.style.left = `${size.x * split}px`;
  }
  map.on("move zoom zoomanim resize viewreset", clip);

  function setLayer(layer: GibsLayer, before: string, after: string) {
    if (left) map.removeLayer(left);
    if (right) map.removeLayer(right);
    left = make(layer, before, 1).addTo(map);
    right = make(layer, after, 2).addTo(map);
    left.on("load", clip);
    right.on("load", clip);
    requestAnimationFrame(clip);
  }

  function setDates(before: string, after: string) {
    if (!left || !right) return;
    // setUrl ile döşemeleri tazele; Leaflet eski döşemeleri yeni gelene kadar tutar
    left.setUrl(replaceDate(tileUrlOf(left), before), false);
    right.setUrl(replaceDate(tileUrlOf(right), after), false);
    requestAnimationFrame(clip);
  }

  function setSplit(f: number) {
    split = Math.min(0.98, Math.max(0.02, f));
    clip();
  }

  /* kaydırıcı sürükleme */
  let dragging = false;
  swipeEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    swipeEl.setPointerCapture(e.pointerId);
    map.dragging.disable();
    e.preventDefault();
  });
  swipeEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const r = mapEl.getBoundingClientRect();
    setSplit((e.clientX - r.left) / r.width);
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    map.dragging.enable();
  };
  swipeEl.addEventListener("pointerup", stop);
  swipeEl.addEventListener("pointercancel", stop);

  return { map, setLayer, setDates, setSplit, getSplit: () => split };
}

function tileUrlOf(l: L.TileLayer): string {
  return (l as any)._url as string;
}
function replaceDate(url: string, date: string): string {
  return url.replace(/\/default\/\d{4}-\d{2}-\d{2}\//, `/default/${date}/`);
}
