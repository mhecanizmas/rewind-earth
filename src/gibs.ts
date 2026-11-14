/**
 * NASA GIBS (Global Imagery Browse Services) — anahtar gerektirmeyen, CORS açık
 * WMTS döşeme servisi. https://nasa-gibs.github.io/gibs-api-docs/
 */
export interface GibsLayer {
  id: string;
  nameTr: string;
  nameEn: string;
  ext: "jpg" | "png";
  matrix: string; // TileMatrixSet
  maxZoom: number;
  minDate: string; // YYYY-MM-DD
  descTr: string;
  descEn: string;
  measure?: "water" | "green" | null;
}

export const LAYERS: GibsLayer[] = [
  {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    nameTr: "Gerçek renk",
    nameEn: "True color",
    ext: "jpg",
    matrix: "GoogleMapsCompatible_Level9",
    maxZoom: 9,
    minDate: "2000-02-24",
    descTr: "Terra uydusu, MODIS kamerası, 250 m çözünürlük. Her gün tüm Dünya, 2000'den beri.",
    descEn: "Terra satellite, MODIS instrument, 250 m. Whole Earth daily since 2000.",
    measure: "water",
  },
  {
    id: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    nameTr: "Gerçek renk (VIIRS, daha keskin)",
    nameEn: "True color (VIIRS, sharper)",
    ext: "jpg",
    matrix: "GoogleMapsCompatible_Level9",
    maxZoom: 9,
    minDate: "2015-11-24",
    descTr: "Suomi NPP uydusu, 375 m, 2015 sonrası. Yakın tarihli kıyaslamalar için.",
    descEn: "Suomi NPP, 375 m, after 2015. For recent comparisons.",
    measure: "water",
  },
  {
    id: "MODIS_Terra_NDVI_8Day",
    nameTr: "Bitki örtüsü (NDVI)",
    nameEn: "Vegetation (NDVI)",
    ext: "png",
    matrix: "GoogleMapsCompatible_Level9",
    maxZoom: 9,
    minDate: "2000-02-18",
    descTr: "8 günlük bitki sağlığı indeksi: koyu yeşil = gür bitki, kahverengi = çıplak toprak.",
    descEn: "8-day vegetation index: dark green = lush, brown = bare ground.",
    measure: "green",
  },
  {
    id: "MODIS_Terra_Land_Surface_Temp_Day",
    nameTr: "Yüzey sıcaklığı",
    nameEn: "Surface temperature",
    ext: "png",
    matrix: "GoogleMapsCompatible_Level7",
    maxZoom: 7,
    minDate: "2000-02-24",
    descTr: "Gündüz yüzey sıcaklığı: şehirler çevresinden sıcak görünür (ısı adası).",
    descEn: "Daytime land surface temperature: cities glow hotter than their surroundings.",
    measure: null,
  },
  {
    id: "VIIRS_SNPP_DayNightBand_At_Sensor_Radiance",
    nameTr: "Gece ışıkları",
    nameEn: "Night lights",
    ext: "png",
    matrix: "GoogleMapsCompatible_Level8",
    maxZoom: 8,
    minDate: "2016-11-30",
    descTr: "Geceleri şehir ışıkları: büyüme, elektrik kesintileri, savaşın karanlığı.",
    descEn: "City lights at night: growth, blackouts, the darkness of war.",
    measure: null,
  },
];

export const layerById = (id: string) => LAYERS.find((l) => l.id === id) ?? LAYERS[0];

export function tileUrl(layer: GibsLayer, date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer.id}/default/${date}/${layer.matrix}/{z}/{y}/{x}.${layer.ext}`;
}

export function tileUrlXYZ(layer: GibsLayer, date: string, z: number, x: number, y: number): string {
  return tileUrl(layer, date).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

export const todayISO = () => {
  const d = new Date(Date.now() - 86400000 * 2); // GIBS 1–2 gün gecikmeli
  return d.toISOString().slice(0, 10);
};

export function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clampDate(iso: string, layer: GibsLayer): string {
  if (iso < layer.minDate) return layer.minDate;
  const t = todayISO();
  return iso > t ? t : iso;
}
