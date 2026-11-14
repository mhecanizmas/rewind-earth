export type Lang = "tr" | "en";

const D: Record<string, { tr: string; en: string }> = {
  tagline: { tr: "NASA uydu arşivinde Dünya'yı geri sar", en: "Rewind the Earth in NASA's satellite archive" },
  myplace: { tr: "Benim şehrim", en: "My city" },
  share: { tr: "Paylaş", en: "Share" },
  copied: { tr: "Bağlantı kopyalandı", en: "Link copied" },
  stories: { tr: "Hikâyeler", en: "Stories" },
  tr: { tr: "Türkiye", en: "Türkiye" },
  world: { tr: "Dünya", en: "World" },
  freehint: { tr: "Haritayı istediğin yere kaydır, tarihleri değiştir. Bulut varsa ◀ ▶ ile birkaç gün oynat.", en: "Pan anywhere, change the dates. If it's cloudy, nudge a few days with ◀ ▶." },
  before: { tr: "ÖNCE", en: "BEFORE" },
  after: { tr: "SONRA", en: "AFTER" },
  measure: { tr: "Değişimi ölç", en: "Measure change" },
  measuring: { tr: "Pikseller sayılıyor…", en: "Counting pixels…" },
  nomeasure: { tr: "Bu katmanda ölçüm yok; Gerçek renk veya Bitki örtüsü seç.", en: "No measurement for this layer; pick True color or Vegetation." },
  water: { tr: "Su alanı", en: "Water area" },
  green: { tr: "Yeşil alan", en: "Green area" },
  cloudwarn: { tr: "Bulut var gibi — tarihi bir iki gün kaydırıp tekrar dene.", en: "Looks cloudy — nudge the date a day or two and retry." },
  approx: { tr: "Kesikli çerçeve içinde, uydu piksellerinden yaklaşık hesap.", en: "Approximate, from satellite pixels inside the dashed frame." },
  framelabel: { tr: "ölçüm alanı", en: "measured area" },
  located: { tr: "Senin şehrin: 2000'e karşı geçen yaz", en: "Your city: 2000 vs last summer" },
  nolocate: { tr: "Konum alınamadı.", en: "Could not get location." },
  layer: { tr: "Katman", en: "Layer" },
  attribution: { tr: "Görüntü: NASA GIBS / Worldview · Terra MODIS, Suomi NPP VIIRS", en: "Imagery: NASA GIBS / Worldview · Terra MODIS, Suomi NPP VIIRS" },
};

let lang: Lang = (() => {
  try {
    const s = localStorage.getItem("re.lang");
    if (s === "tr" || s === "en") return s;
  } catch { /* yok say */ }
  return "tr";
})();

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem("re.lang", l); } catch { /* yok say */ }
}
export const t = (k: string) => D[k]?.[lang] ?? k;

export function applyStatic() {
  document.querySelectorAll<HTMLElement>("[data-t]").forEach((el) => {
    el.textContent = t(el.dataset.t!);
  });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const fmtN = (v: number, digits = 0) =>
  v.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: digits });
