import L from "leaflet";
import { tileUrlXYZ, type GibsLayer } from "./gibs";

export interface MeasureResult {
  km2: number;
  fraction: number; // eşleşen piksel oranı
  cloudFraction: number; // beyaz piksel oranı (bulut/kar/tuz)
  tiles: number;
  zoom: number;
}

const TILE = 256;
const MAX_TILES = 36;
const EARTH_CIRC = 40075016.686;

type Classifier = (r: number, g: number, b: number) => boolean;

/** Gerçek renk görüntüde su: koyu ve mavimsi. Çöl (r>g>b), orman (g≥b), gölge (gri), tuz/bulut (beyaz) dışarıda kalır. */
const isWater: Classifier = (r, g, b) => {
  const sum = r + g + b;
  if (sum > 360) return false;
  if (sum < 100) return b >= r + 4 && b >= g; // çok koyu ama mavimsi
  return b > r + 12 && b > g + 2 && sum < 300;
};

/** Uydu şerit boşluğu / veri yok: neredeyse saf siyah. Hiçbir sınıfa sayılmaz. */
const isNoData: Classifier = (r, g, b) => r + g + b < 24;

/** Gür bitki örtüsü: yeşil baskın (hem gerçek renk hem NDVI paletinde çalışır). */
const isGreen: Classifier = (r, g, b) => {
  const sum = r + g + b;
  return g > r * 1.08 && g > b * 1.2 && g > 45 && sum < 540;
};

const isWhite: Classifier = (r, g, b) => r > 200 && g > 200 && b > 200;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Görünen alandaki döşemeleri indirip piksel piksel sınıflandırır, km² döner. */
export async function measureArea(
  layer: GibsLayer,
  date: string,
  bounds: L.LatLngBounds,
  zoom: number,
  kind: "water" | "green",
): Promise<MeasureResult> {
  const crs = L.CRS.EPSG3857;
  let z = Math.min(Math.round(zoom), layer.maxZoom);
  const pxBounds = () => {
    const a = crs.latLngToPoint(bounds.getNorthWest(), z);
    const b = crs.latLngToPoint(bounds.getSouthEast(), z);
    return { x0: Math.max(0, a.x), y0: Math.max(0, a.y), x1: b.x, y1: b.y };
  };
  let pb = pxBounds();
  let tx0 = Math.floor(pb.x0 / TILE), tx1 = Math.floor((pb.x1 - 1) / TILE);
  let ty0 = Math.floor(pb.y0 / TILE), ty1 = Math.floor((pb.y1 - 1) / TILE);
  while ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > MAX_TILES && z > 2) {
    z -= 1;
    pb = pxBounds();
    tx0 = Math.floor(pb.x0 / TILE); tx1 = Math.floor((pb.x1 - 1) / TILE);
    ty0 = Math.floor(pb.y0 / TILE); ty1 = Math.floor((pb.y1 - 1) / TILE);
  }
  const n = 1 << z;
  const classify = kind === "water" ? isWater : isGreen;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  let km2 = 0, matched = 0, total = 0, white = 0, tiles = 0;

  const jobs: [number, number][] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);

  const worker = async () => {
    while (jobs.length) {
      const [tx, ty] = jobs.shift()!;
      if (ty < 0 || ty >= n) continue;
      const img = await loadImage(tileUrlXYZ(layer, date, z, ((tx % n) + n) % n, ty));
      if (!img) continue;
      tiles++;
      ctx.clearRect(0, 0, TILE, TILE);
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, TILE, TILE).data;
      const ox = tx * TILE, oy = ty * TILE;
      const rowStart = Math.max(0, Math.floor(pb.y0 - oy)), rowEnd = Math.min(TILE, Math.ceil(pb.y1 - oy));
      const colStart = Math.max(0, Math.floor(pb.x0 - ox)), colEnd = Math.min(TILE, Math.ceil(pb.x1 - ox));
      for (let y = rowStart; y < rowEnd; y++) {
        const lat = crs.pointToLatLng(L.point(ox, oy + y + 0.5), z).lat;
        const res = (EARTH_CIRC * Math.cos((lat * Math.PI) / 180)) / (TILE * n); // m/piksel
        const pxArea = (res * res) / 1e6;
        for (let x = colStart; x < colEnd; x++) {
          const i = (y * TILE + x) * 4;
          if (data[i + 3] < 10) continue; // şeffaf (veri yok)
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (isNoData(r, g, b)) continue;
          total++;
          if (isWhite(r, g, b)) white++;
          if (classify(r, g, b)) {
            matched++;
            km2 += pxArea;
          }
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  return { km2, fraction: total ? matched / total : 0, cloudFraction: total ? white / total : 0, tiles, zoom: z };
}
