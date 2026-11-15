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
  play: { tr: "Zaman akışı", en: "Time-lapse" },
  playing: { tr: "yıl yıl ilerliyor — durdurmak için tıkla", en: "advancing year by year — click to stop" },
  fine: { tr: "Gün ayarı", en: "Fine-tune" },
  introline: { tr: "2000'den bugüne, her gün, tüm gezegen.", en: "Every day since 2000, the whole planet." },
  intro1: { tr: "İki yıl seç", en: "Pick two years" },
  intro2: { tr: "Çizgiyi kaydır", en: "Drag the line" },
  intro3: { tr: "Değişimi ölç", en: "Measure the change" },
  start: { tr: "Başla", en: "Start" },
  keys: { tr: "← → kaydırıcı · boşluk: zaman akışı · Esc: kapat", en: "← → swipe · space: time-lapse · Esc: close" },
  reveal: { tr: "fark ortaya çıkıyor…", en: "revealing the change…" },

  // veri boşluğu
  nodataTitle: { tr: "bu tarihte bu bölgede kayıt yok", en: "no imagery here on this date" },
  nodataWhy: {
    tr: "Uydu şeridi buradan geçmemiş ya da kutup gecesi",
    en: "The satellite swath missed this spot, or it was polar night",
  },
  nodataCover: { tr: "kaplama", en: "covered" },
  nodataJump: { tr: "En yakın kayıtlı güne atla", en: "Jump to nearest day with data" },
  nodataSearching: { tr: "aranıyor…", en: "searching…" },
  nodataNone: { tr: "Aylardır kayıt yok (kutup gecesi)", en: "No imagery for months (polar night)" },
  nodataJumped: { tr: "Kayıt bulunan güne geçildi", en: "Moved to a day with imagery" },

  // kabuk / hub
  modeGame: { tr: "Uydunu Kur", en: "Build a Satellite" },
  modeAtlas: { tr: "Dünya Atlası", en: "Earth Atlas" },
  hubline: {
    tr: "Kendi Dünya gözlem uydunu tasarla, fırlat — sonra onun gözüyle gezegenin 25 yıllık değişimini izle. Her görüntü gerçek NASA verisi.",
    en: "Design and launch your own Earth-observing satellite — then watch 25 years of planetary change through its eye. Every image is real NASA data.",
  },
  hubGameT: { tr: "Uydunu Kur", en: "Build a Satellite" },
  hubGameD: {
    tr: "Kamera, güneş paneli, anten ve yörünge seç. Güç, veri ve bütçe arasında denge kur, roketi fırlat.",
    en: "Pick a camera, solar wings, antenna and orbit. Balance power, data and budget, then launch.",
  },
  hubGameTag: { tr: "3B · 5 dakika · görev tasarımı", en: "3D · 5 minutes · mission design" },
  hubAtlasT: { tr: "Dünya Atlası", en: "Earth Atlas" },
  hubAtlasD: {
    tr: "İki yıl seç, ekranı ikiye böl, aradaki farkı gör ve km² olarak ölç. Aral Gölü'nden Manavgat'a 9 hikâye.",
    en: "Pick two years, split the screen, see the difference and measure it in km². Nine stories from the Aral Sea to Manavgat.",
  },
  hubAtlasTag: { tr: "NASA GIBS · 2000'den bugüne", en: "NASA GIBS · since 2000" },
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
