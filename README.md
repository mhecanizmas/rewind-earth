# Rewind Earth

**Kendi Dünya gözlem uydunu tasarla, fırlat — sonra onun gözüyle gezegenin 25 yıllık değişimini izle.**
Tek sayfa, iki mod, tek hikâye. Her görüntü gerçek NASA verisi. Arka uç yok, API anahtarı yok.

> Design and launch your own Earth-observing satellite, then watch 25 years of planetary change
> through its eye. One page, two modes, one story. Every image is real NASA data. Turkish / English.

---

## 🛰 Mod 1 — Uydunu Kur (3B oyun)

NASA Space Apps *Space Mission Design Game* görevine yanıt: oyuncu çelişen talepler arasında
gerçek mühendislik ödünleşmeleri yaparak bir görev tasarlar, yönetir ve sonucunu yaşar.

| Aşama | Oyuncu ne yapar | Hangi gerçek kısıt çalışır |
|---|---|---|
| **Görev** | Üç görevden birini seç: kuruyan göller, orman yangınları, kentleşme | Her görev farklı çözünürlük + ziyaret sıklığı + bütçe ister |
| **Tasarım** | 3 kamera, 3 güneş kanadı, 3 anten, 2 batarya, 2 itki | Kütle, güç, veri dönüşü, maliyet **canlı** hesaplanır; uydu 3B'de anında yeniden şekillenir |
| **Yörünge** | 350–1200 km yükseklik | Kepler periyodu, günlük tur sayısı, ziyaret sıklığı, sürüklenme ömrü |
| **Fırlatma** | — | Yerçekimi dönüşü, kademe ayrımı, yörüngeye giriş, panel açılımı |
| **Sonuç** | Skor + yıldız + mühendislik notları | Hangi bütçeyi neden kaçırdığın açıklanır |

**Oyunun kalbi:** keskin kamera dar bakar. 1 m çözünürlük seçersen ayrıntıyı görürsün ama aynı
yere 15 günde bir uğrarsın ve ürettiğin verinin dörtte birini indirebilirsin. 250 m seçersen her
gün bakarsın ama gölün kıyı çizgisi piksellerin arasında kaybolur. Oyun bu gerilimi öğretir.

### İki modu birbirine bağlayan şey

Sonuç ekranındaki **"Uydunun gözüyle bak"** düğmesi atlası açar — ama seçtiğin kameranın
çözünürlüğü atlasın **yakınlaştırma sınırını** belirler (250 m → z6, 30 m → z8, 1 m → z9) ve
görevinin bölgesi karşına gelir. Kötü bir uydu tasarlarsan Dünya'yı bulanık görürsün.

### 3B sahne

- **Gerçek NASA Blue Marble + gece ışıkları** küre üzerinde; özel shader ile gündüz/gece
  terminatörü, okyanusta güneş parlaması, kabartmadan normal sapması, atmosfer saçılımı
- Prosedürel uydu modeli: altın MLI folyo (canvas'ta üretilen buruşukluk normal haritası),
  güneş hücresi dokusu, parabolik anten, teleskop tüpü, RTG/itki/batarya — hepsi seçime göre
  boyut ve biçim değiştirir, açılma animasyonlu
- Prosedürel ortam haritası (uzay + Dünya albedosu + Güneş) ile metallerde gerçek yansıma

## 🌍 Mod 2 — Dünya Atlası

2000'den bugüne her gün çekilmiş uydu görüntülerini önce/sonra kaydırıcısıyla karşılaştır.

1. Soldan bir hikâye seç — **Aral Gölü'nün yok oluşu**, **Tuz Gölü kuruyor**, **2021 Manavgat
   yangınları**, **Larsen B buz rafının çöküşü**… Kaydırıcı kendiliğinden süpürüp farkı gösterir.
2. Alttaki **yıl çizelgesinde** iki tutamacı sürükle: sol = önce, sağ = sonra.
3. **▶ Zaman akışı** — sağ taraf yıl yıl ilerler, ortada dev yıl sayacı (boşluk tuşu).
4. **📏 Değişimi ölç** — kesikli çerçevedeki su/yeşil alanı km² olarak sayar:
   *Aral Gölü 2000: 15.500 km² → 2013: 4.300 km² (−72 %)*.
5. **📍 Benim şehrim**, **🔗 Paylaş**, **📅 Gün ayarı** (bulut varsa günü kaydır).

---

## NASA verisi

| Kaynak | Kullanım |
|---|---|
| **NASA GIBS / Worldview** (WMTS, anahtarsız, CORS açık) | Atlasın bütün görüntüleri; 3B kürenin dokuları |
| `BlueMarble_ShadedRelief_Bathymetry` | 3B Dünya gündüz haritası (4096×2048'e dikildi) |
| `VIIRS_CityLights_2012` | 3B Dünya gece ışıkları |
| Terra **MODIS** Gerçek Renk (250 m, 2000→) | Atlas varsayılan katmanı |
| Suomi NPP **VIIRS** (375 m, 2015→) | Yakın tarihli keskin kıyaslama |
| MODIS **NDVI**, **Yüzey Sıcaklığı**, VIIRS **Gece Işıkları** | Bitki örtüsü, ısı adaları, kentleşme |
| NASA Earth Observatory *World of Change* | Hikâye metinlerinin kaynağı |
| Terra MODIS, Landsat 9, MRO, Juno… | Oyundaki parçaların gerçek mirası (her kartta yazılı) |

`scripts/build-earth-textures.py` GIBS döşemelerini indirip 3B küre dokularını üretir
(bir kez çalışır, çıktılar depoda). Çalışma anında ek indirme yok.

## Fizik notları

- **Yörünge:** Kepler periyodu `T = 2π√(a³/μ)`, ardışık iz aralığı `40075 / tur`, ziyaret = iz aralığı / şerit
- **Güç:** üretim × gölge payı vs. platform + alet + verici yükü, marj yüzdesi
- **Veri:** `(Mbps × görüntüleme payı)` üretim, `(Mbps × geçiş dakikası)` indirme
- **Atlas ölçümü:** döşemeler canvas'a çizilir, su `b > r+12 && b > g && toplam < 300` ile
  sınıflandırılır; piksel alanı `(40 075 km·cos φ / 2^(z+8))²`
- Değerler oynanabilirlik için sadeleştirildi; gerçek görev verilerine kalibre edildi

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:5176
npm run build    # dist/ — statik; GitHub Pages / Vercel / Netlify
```

Veri tasarrufu: atlas döşemeleri yalnızca hareket bitince yüklenir, zoom animasyonunda ara
seviyeler indirilmez. Oyun modülü yalnızca oyuna girilince indirilir (kod bölme).

## Yapı

```
src/
  main.ts            kabuk: hub, mod geçişi, oyun→atlas aktarımı
  atlas.ts           Dünya Atlası (Leaflet + GIBS)
  game/
    game.ts          aşama makinesi, arayüz, fırlatma koreografisi, skor
    scene3d.ts       Three.js sahnesi, Dünya shader'ı, ortam haritası, yıldızlar
    satellite.ts     parçalara göre üretilen 3B uydu + bütçe ve yörünge hesapları
    parts.ts         parça kataloğu ve görevler (gerçek miras değerleriyle)
  gibs.ts  stories.ts  map.ts  measure.ts  timeline.ts  anim.ts  i18n.ts
public/tex/          GIBS'ten dikilmiş Dünya dokuları
```

Lisans: MIT. NASA görüntüleri ve verileri kamu malıdır; atıflar arayüzde gösterilir.
