export interface Story {
  id: string;
  emoji: string;
  titleTr: string;
  titleEn: string;
  lat: number;
  lng: number;
  zoom: number;
  before: string;
  after: string;
  layer: string;
  textTr: string;
  textEn: string;
  source: string;
  tag: "tr" | "world";
}

export const STORIES: Story[] = [
  {
    id: "aral",
    emoji: "🏜️",
    titleTr: "Aral Gölü'nün yok oluşu",
    titleEn: "The vanishing Aral Sea",
    lat: 45.0, lng: 59.6, zoom: 6,
    before: "2000-08-20", after: "2024-08-20",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "1960'ta dünyanın 4. büyük gölüydü. Sovyet pamuk tarlaları için nehirleri çevrildi; 2000'de bile bugünkünden çok daha büyüktü. Bugün kuruyan tabanı Aralkum Çölü olarak anılıyor ve tuzlu tozu yüzlerce kilometre uçuyor.",
    textEn: "In 1960 it was the world's 4th largest lake. Its rivers were diverted for Soviet cotton; even in 2000 it was far larger than today. The dry bed is now called the Aralkum Desert and its salty dust travels hundreds of kilometres.",
    source: "NASA Earth Observatory — World of Change: Shrinking Aral Sea",
    tag: "world",
  },
  {
    id: "tuz",
    emoji: "🦩",
    titleTr: "Tuz Gölü kuruyor",
    titleEn: "Lake Tuz is drying",
    lat: 38.75, lng: 33.35, zoom: 8,
    before: "2000-07-15", after: "2024-07-15",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "Türkiye'nin ikinci büyük gölü, flamingoların yuvası. Yeraltı suyunun tarım için çekilmesiyle yazın neredeyse tamamen kuruyor; 2021'de binlerce flamingo yavrusu susuzluktan öldü. Beyaz alan tuz, mavi alan sudur.",
    textEn: "Turkey's second-largest lake and a flamingo nursery. Groundwater pumping for farms leaves it almost dry in summer; in 2021 thousands of flamingo chicks died. White is salt, blue is water.",
    source: "NASA Worldview · MODIS Terra",
    tag: "tr",
  },
  {
    id: "burdur",
    emoji: "💧",
    titleTr: "Burdur Gölü küçülüyor",
    titleEn: "Lake Burdur is shrinking",
    lat: 37.72, lng: 30.17, zoom: 9,
    before: "2000-08-10", after: "2024-08-10",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "Son 50 yılda yüzeyinin üçte birinden fazlasını kaybetti. Besleyen dereler üzerine kurulan göletler ve sulama, gölü her yıl biraz daha geri çekiyor. Kıyıdaki açık renkli şerit eski göl tabanı.",
    textEn: "It has lost more than a third of its surface in 50 years. Ponds and irrigation on its feeder streams pull the shoreline back every year. The pale band along the shore is the old lakebed.",
    source: "NASA Worldview · MODIS Terra",
    tag: "tr",
  },
  {
    id: "manavgat",
    emoji: "🔥",
    titleTr: "2021 Manavgat yangınları",
    titleEn: "2021 Manavgat wildfires",
    lat: 36.85, lng: 31.55, zoom: 9,
    before: "2021-07-25", after: "2021-08-12",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "28 Temmuz 2021'de başlayan yangınlar Antalya ve Muğla'da 1.700 km²'den fazla ormanı yaktı — Türkiye tarihinin en büyük orman yangını. Sağdaki görüntüde yanık alanlar koyu kahverengi lekeler olarak görünür.",
    textEn: "Fires starting 28 July 2021 burned over 1,700 km² of forest in Antalya and Muğla — Turkey's largest wildfire on record. On the right, burn scars show as dark brown patches.",
    source: "NASA FIRMS · MODIS Terra",
    tag: "tr",
  },
  {
    id: "istanbul",
    emoji: "🏙️",
    titleTr: "İstanbul'un büyümesi",
    titleEn: "Istanbul's growth",
    lat: 41.12, lng: 28.85, zoom: 9,
    before: "2000-07-20", after: "2024-07-20",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "25 yılda nüfus 10 milyondan 16 milyona çıktı. Kuzeydeki ormanların içinde beliren gri alan İstanbul Havalimanı (2018) ve çevresindeki yeni yerleşim. Gri yayılma kentin ormana doğru ilerleyişidir.",
    textEn: "Population grew from 10 to 16 million in 25 years. The grey patch inside the northern forests is Istanbul Airport (2018) and new settlement around it. Grey spreading north is the city eating the forest.",
    source: "NASA Worldview · MODIS Terra",
    tag: "tr",
  },
  {
    id: "urmia",
    emoji: "🧂",
    titleTr: "Urmiye Gölü: kayıp ve geri dönüş",
    titleEn: "Lake Urmia: loss and return",
    lat: 37.7, lng: 45.4, zoom: 7,
    before: "2000-09-01", after: "2023-09-01",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "İran'ın, Van Gölü'nün hemen doğusundaki tuz gölü 2000'lerde %90 küçüldü; barajlar ve kuraklık. Su azaldıkça tuz seven bakteriler gölü kırmızıya boyar. 2024'te yağışlarla kısmen geri döndü — tarihi değiştirip bak.",
    textEn: "Iran's salt lake just east of Lake Van shrank ~90% in the 2000s from dams and drought. As water drops, salt-loving bacteria turn it red. It partly returned with 2024 rains — change the date and see.",
    source: "NASA Earth Observatory — Lake Urmia",
    tag: "world",
  },
  {
    id: "rondonia",
    emoji: "🌳",
    titleTr: "Amazon'da ormansızlaşma",
    titleEn: "Deforestation in the Amazon",
    lat: -10.3, lng: -63.2, zoom: 7,
    before: "2000-08-21", after: "2024-08-05",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "Brezilya'nın Rondônia eyaleti. Yollardan iki yana açılan 'balık kılçığı' deseni, ormanın tarla ve meraya dönüşmesinin imzası. Kahverengi ve açık yeşil = kesilmiş alan.",
    textEn: "Rondônia, Brazil. The 'fishbone' pattern spreading from roads is the signature of forest turning into pasture. Brown and pale green = cleared land.",
    source: "NASA Earth Observatory — World of Change: Amazon Deforestation",
    tag: "world",
  },
  {
    id: "larsen",
    emoji: "🧊",
    titleTr: "Larsen B buz rafının çöküşü",
    titleEn: "Collapse of the Larsen B ice shelf",
    lat: -65.4, lng: -61.0, zoom: 6,
    before: "2002-01-31", after: "2002-03-07",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "Antarktika'da 3.250 km²'lik, 220 m kalınlığında, 12.000 yıllık bir buz rafı sadece 5 haftada parçalandı. Terra uydusu bunu günü gününe izledi — bilim insanlarını bile şaşırtan hız.",
    textEn: "A 3,250 km², 220 m thick, 12,000-year-old Antarctic ice shelf shattered in just 5 weeks. Terra watched it day by day — a speed that stunned scientists.",
    source: "NASA Earth Observatory — Larsen B Ice Shelf Collapses",
    tag: "world",
  },
  {
    id: "saltlake",
    emoji: "🏞️",
    titleTr: "Büyük Tuz Gölü (ABD) rekor düşükte",
    titleEn: "Great Salt Lake at record low",
    lat: 41.1, lng: -112.5, zoom: 8,
    before: "2000-08-01", after: "2022-08-01",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    textTr: "Utah'taki göl 2022'de ölçüm tarihinin en düşük seviyesine indi; yüzeyinin %60'ı kayboldu. Kuruyan taban arsenik içeren toz kaldırıyor — 2,5 milyon insanın yaşadığı Salt Lake City'nin hemen yanında.",
    textEn: "Utah's lake hit its lowest recorded level in 2022, losing ~60% of its surface. The exposed bed lifts arsenic-laden dust — right next to 2.5 million people in Salt Lake City.",
    source: "NASA Earth Observatory — Great Salt Lake",
    tag: "world",
  },
];
