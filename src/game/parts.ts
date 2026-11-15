/** Uydu parça kataloğu — gerçek Dünya gözlem misyonlarından ölçeklenmiş değerler. */

export interface Part {
  id: string;
  kind: "camera" | "power" | "antenna" | "battery" | "thruster";
  nameTr: string;
  nameEn: string;
  descTr: string;
  descEn: string;
  massKg: number;
  powerW: number; // + üretim, − tüketim
  costM: number;
  heritage: string;
  /** hangi teknoloji kullanılıyor */
  techTr: string;
  techEn: string;
  /** parça neden bu boyutta — 3B modeldeki büyüklük farkının sebebi */
  whyTr: string;
  whyEn: string;
  /** kamera */
  resolutionM?: number;
  swathKm?: number;
  dataMbps?: number;
  /** teleskop tüpü uzunluğu (m) — modeldeki boy farkını belirler */
  opticsLengthM?: number;
  /** ana ayna açıklığı (m) — modeldeki kalınlık farkını belirler */
  apertureM?: number;
  /** anten */
  downlinkMbps?: number;
  dishM?: number;
  /** güç */
  areaM2?: number;
  panels?: number;
  /** batarya */
  energyWh?: number;
  /** itki */
  deltaVms?: number;
}

export const PARTS: Part[] = [
  // ---- kameralar
  {
    id: "cam-wide", kind: "camera",
    nameTr: "Geniş alan kamerası", nameEn: "Wide-field camera",
    descTr: "250 m çözünürlük, 2.330 km şerit. Tüm Dünya'yı günde bir kez görür.",
    descEn: "250 m resolution, 2,330 km swath. Sees the whole Earth daily.",
    massKg: 32, powerW: -28, costM: 60, heritage: "Terra MODIS",
    resolutionM: 250, swathKm: 2330, dataMbps: 11,
    opticsLengthM: 0.9, apertureM: 0.18,
    techTr: "Tarayıcı aynalı, 36 bantlı tarayıcı. Kısa odak uzaklığı (≈2 cm) çok geniş açı verir.",
    techEn: "Scanning-mirror radiometer, 36 bands. A short focal length (~2 cm) buys a very wide angle.",
    whyTr: "En küçük optik bu. Yer örnekleme aralığı = piksel × yükseklik ÷ odak; 250 m için kısa bir tüp yeter.",
    whyEn: "The smallest optics here. Ground sampling = pixel × altitude ÷ focal length; 250 m needs only a short tube.",
  },
  {
    id: "cam-mid", kind: "camera",
    nameTr: "Orta çözünürlük kamerası", nameEn: "Medium-resolution camera",
    descTr: "30 m çözünürlük, 185 km şerit. Tarlaları, gölleri, şehirleri ayırt eder.",
    descEn: "30 m resolution, 185 km swath. Resolves fields, lakes and cities.",
    massKg: 88, powerW: -78, costM: 150, heritage: "Landsat 9 OLI-2",
    resolutionM: 30, swathKm: 185, dataMbps: 265,
    opticsLengthM: 1.8, apertureM: 0.4,
    techTr: "Üç aynalı anastigmat + itmeli tarama (push-broom) çizgi dedektörü. Odak ≈16 cm.",
    techEn: "Three-mirror anastigmat with a push-broom line detector. Focal length ~16 cm.",
    whyTr: "Aynı piksel boyutunda 250 m'den 30 m'ye inmek odağı ~8 kat uzatır; tüp ve platform büyür.",
    whyEn: "Going from 250 m to 30 m at the same pixel pitch stretches the focal length ~8×, so tube and bus grow.",
  },
  {
    id: "cam-sharp", kind: "camera",
    nameTr: "Keskin göz kamerası", nameEn: "Sharp-eye camera",
    descTr: "1 m çözünürlük, 15 km şerit. Tek tek ağaçları görür ama dar bakar.",
    descEn: "1 m resolution, 15 km swath. Sees individual trees, but looks narrow.",
    massKg: 165, powerW: -140, costM: 320, heritage: "WorldView sınıfı",
    resolutionM: 1, swathKm: 15, dataMbps: 800,
    opticsLengthM: 3.2, apertureM: 1.1,
    techTr: "Katlanmış Cassegrain teleskop, ~1,1 m ana ayna, zaman gecikmeli integrasyon (TDI) dedektör.",
    techEn: "Folded Cassegrain telescope, ~1.1 m primary mirror, time-delay integration (TDI) detector.",
    whyTr: "1 m için odak ~5 m olmalı (aynalarla katlanır) ve kırınım sınırı büyük ayna zorunlu kılar: en uzun, en kalın tüp.",
    whyEn: "1 m needs a ~5 m focal length (folded by mirrors) and the diffraction limit forces a large mirror: the longest, thickest tube.",
  },

  // ---- güç
  {
    id: "pow-s", kind: "power",
    nameTr: "Küçük güneş kanadı", nameEn: "Small solar wing",
    descTr: "4 m², hafif ve ucuz. Küçük yüklere yeter.",
    descEn: "4 m², light and cheap. Enough for small payloads.",
    massKg: 18, powerW: 120, costM: 15, heritage: "SmallSat sınıfı",
    areaM2: 4, panels: 1,
    techTr: "Gövdeye sabit tek panel, üçlü eklemli galyum arsenit hücre (~%30 verim).",
    techEn: "One body-fixed panel of triple-junction gallium-arsenide cells (~30% efficient).",
    whyTr: "Güç alanla doğru orantılı: 120 W için 4 m² hücre yeter, mekanizma gerekmez.",
    whyEn: "Power scales with area: 120 W needs only 4 m² and no deployment mechanism.",
  },
  {
    id: "pow-m", kind: "power",
    nameTr: "Orta güneş kanadı", nameEn: "Medium solar wing",
    descTr: "10 m², çift kanat. Çoğu Dünya gözlem uydusunun standardı.",
    descEn: "10 m², twin wings. The standard for most Earth-observing satellites.",
    massKg: 42, powerW: 310, costM: 38, heritage: "Landsat 9",
    areaM2: 10, panels: 2,
    techTr: "Açılır çift kanat, tek eksenli güneş takip mekanizması.",
    techEn: "Deployable twin wings on a single-axis sun-tracking drive.",
    whyTr: "310 W için 10 m² gerekir; tek panele sığmaz, iki kanada bölünür.",
    whyEn: "310 W needs 10 m²; that no longer fits one panel, so it splits into two wings.",
  },
  {
    id: "pow-l", kind: "power",
    nameTr: "Büyük güneş kanadı", nameEn: "Large solar wing",
    descTr: "20 m², üç panelli uzun kanatlar. Güç açlığı çeken aletler için.",
    descEn: "20 m², long three-panel wings. For power-hungry instruments.",
    massKg: 78, powerW: 620, costM: 72, heritage: "Aqua / Terra",
    areaM2: 20, panels: 3,
    techTr: "Üç panelli uzun kanatlar, güçlendirilmiş menteşe ve takip motoru.",
    techEn: "Three-panel long wings with reinforced hinges and a tracking drive.",
    whyTr: "620 W = 20 m²; kanatlar üç panele uzar, açıklık gövdenin birkaç katına çıkar.",
    whyEn: "620 W = 20 m²; the wings extend to three panels and the span becomes several times the bus.",
  },

  // ---- antenler
  {
    id: "ant-s", kind: "antenna",
    nameTr: "S bandı anten", nameEn: "S-band antenna",
    descTr: "Küçük ve güvenilir, ama veriyi yavaş indirir.",
    descEn: "Small and reliable, but downlinks slowly.",
    massKg: 6, powerW: -12, costM: 8, heritage: "CubeSat / SmallSat",
    downlinkMbps: 15,
    dishM: 0.3,
    techTr: "Çubuk/yama anten, geniş hüzme. Yönlendirme gerektirmez.",
    techEn: "Whip/patch antenna with a wide beam. Needs no pointing.",
    whyTr: "Geniş hüzme kazancı düşürür; küçük kalır ama veri hızı da düşük olur.",
    whyEn: "A wide beam means low gain; it stays small, but so does the data rate.",
  },
  {
    id: "ant-x", kind: "antenna",
    nameTr: "X bandı çanak", nameEn: "X-band dish",
    descTr: "Dünya gözleminin iş atı. Yer istasyonu geçişinde çok veri indirir.",
    descEn: "The workhorse of Earth observation. Dumps a lot per ground pass.",
    massKg: 24, powerW: -45, costM: 30, heritage: "Landsat, Sentinel",
    downlinkMbps: 384,
    dishM: 0.6,
    techTr: "0,6 m gimbal'li parabolik çanak, 8 GHz. Yer istasyonunu izler.",
    techEn: "0.6 m gimballed parabolic dish at 8 GHz, tracking the ground station.",
    whyTr: "Hüzme darlığı ve kazanç çanak çapıyla artar: 25 kat veri için çanak iki katına çıkar.",
    whyEn: "Beam narrowness and gain grow with dish diameter: 25× the data needs twice the dish.",
  },
  {
    id: "ant-ka", kind: "antenna",
    nameTr: "Ka bandı çanak", nameEn: "Ka-band dish",
    descTr: "En hızlı bağlantı. Ağır, pahalı ve yağmurdan etkilenir.",
    descEn: "The fastest link. Heavy, costly and rain-sensitive.",
    massKg: 44, powerW: -85, costM: 68, heritage: "NISAR, Sentinel-6",
    downlinkMbps: 1200,
    dishM: 0.9,
    techTr: "0,9 m çanak, 26 GHz Ka bandı. Dar hüzme, hassas yönlendirme ister.",
    techEn: "0.9 m dish at 26 GHz Ka-band. A narrow beam that demands precise pointing.",
    whyTr: "Yüksek frekans + büyük çanak en yüksek hızı verir; karşılığı ağırlık ve yağmur duyarlılığı.",
    whyEn: "High frequency plus a big dish gives the top rate; the price is mass and rain sensitivity.",
  },

  // ---- bataryalar
  {
    id: "bat-s", kind: "battery",
    nameTr: "Küçük batarya", nameEn: "Small battery",
    descTr: "Yörüngenin gece yarısında temel sistemleri taşır.",
    descEn: "Carries the basics through orbital night.",
    massKg: 14, powerW: 0, costM: 6, heritage: "Li-ion 50 Ah",
    techTr: "Lityum-iyon hücre paketi, ~900 Wh.",
    techEn: "Lithium-ion cell pack, ~900 Wh.",
    whyTr: "Küçük kutu: yalnızca gece tarafında temel sistemleri taşır.",
    whyEn: "A small box: it only carries the basics through the night side.",
    energyWh: 900,
  },
  {
    id: "bat-l", kind: "battery",
    nameTr: "Büyük batarya", nameEn: "Large battery",
    descTr: "Gece tarafında da bilim yapmanı sağlar.",
    descEn: "Lets you keep doing science on the night side.",
    massKg: 34, powerW: 0, costM: 17, heritage: "Li-ion 120 Ah",
    techTr: "Çift sıra lityum-iyon paket, ~2.200 Wh.",
    techEn: "Double-row lithium-ion pack, ~2,200 Wh.",
    whyTr: "Enerji hücre sayısıyla artar; paket gövdenin dışına taşan ayrı bir kutuya döner.",
    whyEn: "Energy scales with cell count, so the pack becomes a separate box outside the bus.",
    energyWh: 2200,
  },

  // ---- itki
  {
    id: "thr-none", kind: "thruster",
    nameTr: "İtki yok", nameEn: "No propulsion",
    descTr: "Yakıt taşıma. Hafif ve ucuz, ama yörünge kendiliğinden alçalır.",
    descEn: "Carry no fuel. Light and cheap, but the orbit decays on its own.",
    massKg: 0, powerW: 0, costM: 0, heritage: "kısa görevler",
    techTr: "İtki sistemi yok.",
    techEn: "No propulsion system.",
    whyTr: "Tank ve nozül olmadığı için gövdede hiçbir çıkıntı görünmez.",
    whyEn: "With no tank or nozzle there is nothing protruding from the bus.",
    deltaVms: 0,
  },
  {
    id: "thr-mono", kind: "thruster",
    nameTr: "Hidrazin itki", nameEn: "Hydrazine propulsion",
    descTr: "Yörünge bakımı ve enkaz kaçınma manevraları için yakıt.",
    descEn: "Fuel for orbit maintenance and debris-avoidance manoeuvres.",
    massKg: 48, powerW: -5, costM: 22, heritage: "Landsat 9",
    techTr: "Tek yakıtlı hidrazin, küresel tank + 1 N'luk iticiler.",
    techEn: "Monopropellant hydrazine with a spherical tank and 1 N thrusters.",
    whyTr: "Yakıt basınçlı küresel tank ister; arkada tank ve nozül belirir.",
    whyEn: "Propellant needs a pressurised spherical tank, so a tank and nozzle appear at the back.",
    deltaVms: 180,
  },
];

export const byKind = (k: Part["kind"]) => PARTS.filter((p) => p.kind === k);
export const partById = (id: string) => PARTS.find((p) => p.id === id)!;

/* ---------------- Görevler ---------------- */

export interface Mission {
  id: string;
  emoji: string;
  nameTr: string;
  nameEn: string;
  briefTr: string;
  briefEn: string;
  /** hedefi tutturmak için gereken en kaba çözünürlük (m) */
  needResolutionM: number;
  /** günde gereken en az kapsama (ziyaret) puanı */
  needRevisitDays: number;
  budgetM: number;
  /** sonuçta açılacak Rewind Earth hikâyesi */
  story: string;
  lat: number;
  lng: number;
}

export const MISSIONS: Mission[] = [
  {
    id: "lakes", emoji: "💧",
    nameTr: "Türkiye'nin kuruyan gölleri", nameEn: "Turkey's drying lakes",
    briefTr: "Tuz Gölü ve Burdur Gölü her yıl küçülüyor. Kıyı çizgisini mevsim mevsim izleyecek bir uydu kur: sık ziyaret şart, orta çözünürlük yeterli.",
    briefEn: "Lake Tuz and Lake Burdur shrink every year. Build a satellite to track their shorelines season by season: frequent revisits matter, medium resolution is enough.",
    needResolutionM: 250, needRevisitDays: 8, budgetM: 400,
    story: "tuz", lat: 38.75, lng: 33.35,
  },
  {
    id: "fire", emoji: "🔥",
    nameTr: "Orman yangınlarını yakala", nameEn: "Catch the wildfires",
    briefTr: "2021 Manavgat yangınları günler içinde yayıldı. Yangın sezonunda aynı bölgeye her gün bakabilen bir uydu gerekiyor — geniş şerit kazanır.",
    briefEn: "The 2021 Manavgat fires spread within days. You need a satellite that can look at the same region every day during fire season — a wide swath wins.",
    needResolutionM: 500, needRevisitDays: 2, budgetM: 350,
    story: "manavgat", lat: 36.85, lng: 31.55,
  },
  {
    id: "city", emoji: "🏙️",
    nameTr: "Şehrin ormana ilerleyişi", nameEn: "The city eating the forest",
    briefTr: "İstanbul'un kuzeye yayılmasını sokak ölçeğinde belgele. Burada çözünürlük her şeydir; sık ziyarete gerek yok.",
    briefEn: "Document Istanbul's spread north at street scale. Here resolution is everything; frequent revisits are not needed.",
    needResolutionM: 30, needRevisitDays: 20, budgetM: 520,
    story: "istanbul", lat: 41.12, lng: 28.85,
  },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id)!;
