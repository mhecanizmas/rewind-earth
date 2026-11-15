/**
 * NASA GIBS her tarih için her yerde görüntü döndürmez: uydu şeridinin dışında
 * kalan, kutup gecesine denk gelen ya da ürünün takvimine uymayan günlerde
 * döşemeler siyah (veya saydam) gelir. Burada görünen alanı yoklayıp o tarihte
 * gerçekten kayıt olup olmadığını ölçüyoruz.
 */
import L from "leaflet";
import { tileUrlXYZ, type GibsLayer } from "./gibs";

export interface Coverage {
  /** 0..1 — görünen alanın ne kadarında gerçek görüntü var */
  dataFraction: number;
  ok: boolean;
  checked: boolean;
}

const TILE = 256;
const THRESHOLD = 0.4;
const cache = new Map<string, Coverage>();

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const done = (v: HTMLImageElement | null) => resolve(v);
    img.onload = () => done(img);
    img.onerror = () => done(null);
    setTimeout(() => done(null), 9000); // ağ takılırsa yoklamayı bekletme
    img.src = url;
  });
}

/** Görünen alandan en çok 4 döşeme indirip veri oranını ölçer. */
export async function probeCoverage(
  layer: GibsLayer,
  date: string,
  bounds: L.LatLngBounds,
  zoom: number,
): Promise<Coverage> {
  const key = `${layer.id}|${date}|${bounds.getCenter().lat.toFixed(1)},${bounds.getCenter().lng.toFixed(1)}|${Math.round(zoom)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const crs = L.CRS.EPSG3857;
  const z = Math.max(2, Math.min(Math.round(zoom) - 2, layer.maxZoom, 5));
  const n = 1 << z;
  const a = crs.latLngToPoint(bounds.getNorthWest(), z);
  const b = crs.latLngToPoint(bounds.getSouthEast(), z);
  const tx0 = Math.floor(a.x / TILE), tx1 = Math.floor((b.x - 1) / TILE);
  const ty0 = Math.floor(a.y / TILE), ty1 = Math.floor((b.y - 1) / TILE);

  const coords: [number, number][] = [];
  for (let ty = ty0; ty <= ty1 && coords.length < 4; ty++)
    for (let tx = tx0; tx <= tx1 && coords.length < 4; tx++)
      if (ty >= 0 && ty < n) coords.push([((tx % n) + n) % n, ty]);
  if (coords.length === 0) {
    const r: Coverage = { dataFraction: 1, ok: true, checked: false };
    return r;
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  let data = 0, total = 0, failed = 0;

  const imgs = await Promise.all(coords.map(([x, y]) => loadTile(tileUrlXYZ(layer, date, z, x, y))));
  for (const img of imgs) {
    if (!img) { failed++; continue; }
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, TILE, TILE).data;
    for (let i = 0; i < px.length; i += 16) {
      // her 4. pikseli örnekle: yoklama hızlı olmalı
      total++;
      if (px[i + 3] > 10 && px[i] + px[i + 1] + px[i + 2] > 26) data++;
    }
  }

  // hiçbir döşeme inmediyse bu bir ağ sorunu olabilir; kullanıcıyı yanlış uyarma
  if (failed === imgs.length) {
    const r: Coverage = { dataFraction: 1, ok: true, checked: false };
    return r;
  }

  const dataFraction = total ? data / total : 1;
  const res: Coverage = { dataFraction, ok: dataFraction >= THRESHOLD, checked: true };
  cache.set(key, res);
  return res;
}

/**
 * Verilen günde kayıt yoksa ±1, ±2 … gün arayıp görüntüsü olan en yakın günü bulur.
 * Bulamazsa null döner.
 */
export async function findNearestWithData(
  layer: GibsLayer,
  date: string,
  bounds: L.LatLngBounds,
  zoom: number,
  step: (iso: string, days: number) => string,
  clamp: (iso: string) => string,
  maxDays = 8,
): Promise<string | null> {
  for (let d = 1; d <= maxDays; d++) {
    for (const sign of [-1, 1]) {
      const cand = clamp(step(date, d * sign));
      if (cand === date) continue;
      const c = await probeCoverage(layer, cand, bounds, zoom);
      if (c.ok) return cand;
    }
  }
  return null;
}
