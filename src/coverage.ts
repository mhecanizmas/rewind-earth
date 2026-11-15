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
    let settled = false;
    const done = (v: HTMLImageElement | null) => {
      if (!settled) { settled = true; resolve(v); }
    };
    img.onload = () => done(img);
    img.onerror = () => done(null);
    setTimeout(() => done(null), 9000); // ağ takılırsa yoklamayı bekletme
    img.src = url;
  });
}

/**
 * Görünen alanı yoklar. Döşemeler görünen dikdörtgenden taşabildiği için
 * sayım yalnızca görünen alana düşen piksellerde yapılır — yoksa ekran
 * kapkara iken komşu bölgelerin aydınlığı sonucu yanıltır.
 */
export async function probeCoverage(
  layer: GibsLayer,
  date: string,
  bounds: L.LatLngBounds,
  zoom: number,
  maxTiles = 6,
): Promise<Coverage> {
  const c = bounds.getCenter();
  const key = `${layer.id}|${date}|${c.lat.toFixed(1)},${c.lng.toFixed(1)}|${Math.round(zoom)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const crs = L.CRS.EPSG3857;
  let z = Math.min(Math.round(zoom), layer.maxZoom, 6);
  const px = () => {
    const a = crs.latLngToPoint(bounds.getNorthWest(), z);
    const b = crs.latLngToPoint(bounds.getSouthEast(), z);
    return { x0: a.x, y0: Math.max(0, a.y), x1: b.x, y1: b.y };
  };
  let pb = px();
  const tiles = () => ({
    tx0: Math.floor(pb.x0 / TILE), tx1: Math.floor((pb.x1 - 1) / TILE),
    ty0: Math.floor(pb.y0 / TILE), ty1: Math.floor((pb.y1 - 1) / TILE),
  });
  let t = tiles();
  while ((t.tx1 - t.tx0 + 1) * (t.ty1 - t.ty0 + 1) > maxTiles && z > 2) {
    z -= 1;
    pb = px();
    t = tiles();
  }
  const n = 1 << z;

  const jobs: [number, number][] = [];
  for (let ty = t.ty0; ty <= t.ty1; ty++)
    for (let tx = t.tx0; tx <= t.tx1; tx++)
      if (ty >= 0 && ty < n) jobs.push([tx, ty]);
  if (jobs.length === 0) return { dataFraction: 1, ok: true, checked: false };

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  let data = 0, total = 0, failed = 0;

  const imgs = await Promise.all(jobs.map(([tx, ty]) => loadTile(tileUrlXYZ(layer, date, z, ((tx % n) + n) % n, ty))));

  for (let k = 0; k < jobs.length; k++) {
    const img = imgs[k];
    if (!img) { failed++; continue; }
    const [tx, ty] = jobs[k];
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.drawImage(img, 0, 0);
    const buf = ctx.getImageData(0, 0, TILE, TILE).data;
    const ox = tx * TILE, oy = ty * TILE;
    // yalnızca görünen dikdörtgene düşen pikseller
    const rowStart = Math.max(0, Math.floor(pb.y0 - oy)), rowEnd = Math.min(TILE, Math.ceil(pb.y1 - oy));
    const colStart = Math.max(0, Math.floor(pb.x0 - ox)), colEnd = Math.min(TILE, Math.ceil(pb.x1 - ox));
    for (let y = rowStart; y < rowEnd; y += 2) {
      for (let x = colStart; x < colEnd; x += 2) {
        const i = (y * TILE + x) * 4;
        total++;
        if (buf[i + 3] > 10 && buf[i] + buf[i + 1] + buf[i + 2] > 26) data++;
      }
    }
  }

  // hiçbir döşeme inmediyse bu bir ağ sorunu olabilir; kullanıcıyı yanlış uyarma
  if (failed === imgs.length || total === 0) return { dataFraction: 1, ok: true, checked: false };

  const dataFraction = data / total;
  const res: Coverage = { dataFraction, ok: dataFraction >= THRESHOLD, checked: true };
  cache.set(key, res);
  return res;
}

/**
 * Görüntüsü olan en yakın günü arar: önce gün gün (±8), bulamazsa mevsim
 * ölçeğinde (15 günlük adımlarla ±150). Kutup gecesinde haftalarca kayıt
 * olmadığı için geniş arama şart.
 */
export async function findNearestWithData(
  layer: GibsLayer,
  date: string,
  bounds: L.LatLngBounds,
  zoom: number,
  step: (iso: string, days: number) => string,
  clamp: (iso: string) => string,
): Promise<string | null> {
  const offsets: number[] = [];
  for (let d = 1; d <= 8; d++) offsets.push(d);
  for (let d = 15; d <= 150; d += 15) offsets.push(d);

  for (const d of offsets) {
    for (const sign of [-1, 1]) {
      const cand = clamp(step(date, d * sign));
      if (cand === date) continue;
      const c = await probeCoverage(layer, cand, bounds, zoom, 4);
      if (c.ok) return cand;
    }
  }
  return null;
}
