# Rewind Earth

**NASA uydu arşivinde Dünya'yı geri sar.** 2000'den bugüne her gün çekilmiş uydu görüntülerini
önce/sonra kaydırıcısıyla karşılaştır, değişimi pikselden ölç, hikâyeyi oku.

> Rewind the Earth in NASA's satellite archive: compare any two days since 2000 with a swipe,
> measure the change in km², read the story. Turkish / English, no backend, no API key.

## 30 saniyede

1. Soldan bir hikâye seç — **Aral Gölü'nün yok oluşu**, **Tuz Gölü kuruyor**, **2021 Manavgat yangınları**, **Larsen B buz rafının çöküşü**… Kaydırıcı kendiliğinden soldan sağa süpürüp farkı gösterir.
2. Alttaki **yıl çizelgesinde** iki tutamacı sürükle: sol = *önce* yılı, sağ = *sonra* yılı. Ekran anında o iki yılı karşılaştırır.
3. **▶ Zaman akışı** — sağ taraf yıl yıl ilerler, ortada dev yıl sayacı: gölün yok oluşunu film gibi izle (boşluk tuşu da çalışır).
4. Ortadaki beyaz çizgiyi sürükle (ya da ← →): solda *önce*, sağda *sonra*.
5. **📏 Değişimi ölç** — kesikli çerçevedeki su (veya yeşil) alanını iki tarih için km² olarak sayar: *Aral Gölü 2000: 15.500 km² → 2013: 4.300 km² (−72 %)*. Sayılar sayarak gelir, çubuklar büyür.
6. **📍 Benim şehrim** — kendi şehrinin 2000'e karşı geçen yazını gör. **🔗 Paylaş** — görünüm, yıllar ve katman bağlantıda saklanır.
7. **📅 Gün ayarı** — bulut varsa günü bir iki gün kaydır.

Hikâye kartlarının arka planı o yerin gerçek uydu görüntüsüdür; giriş ekranı 6 saniye sonra kendiliğinden kapanır.

## NASA verisi

| Kaynak | Ne için |
|---|---|
| **NASA GIBS / Worldview** (`gibs.earthdata.nasa.gov`, WMTS) | Tüm görüntüler. Anahtar yok, CORS açık, 2000'den bugüne günlük. |
| Terra **MODIS** Gerçek Renk (250 m) | Varsayılan katman, 2000-02-24'ten itibaren |
| Suomi NPP **VIIRS** Gerçek Renk (375 m) | 2015 sonrası daha keskin kıyaslamalar |
| MODIS **NDVI** 8 günlük | Bitki örtüsü / ormansızlaşma |
| MODIS **Yüzey Sıcaklığı** | Şehir ısı adaları |
| VIIRS **Gece Işıkları** | Kentleşme, kesintiler |
| NASA Earth Observatory *World of Change* | Hikâye metinlerinin kaynağı |

Türkiye hikâyeleri yerel jüri ve öğrenciler için: Tuz Gölü, Burdur Gölü, Manavgat yangınları, İstanbul'un büyümesi.

## Değişim ölçer nasıl çalışıyor?

Kesikli çerçevedeki döşemeler (en çok 36 tane) `canvas`'a çizilir, her piksel sınıflandırılır:

- **Su:** koyu ve mavimsi (`b > r + 12`, `b > g`, toplam parlaklık < 300). Çöl, orman, gölge ve beyaz (bulut/tuz) elenir.
- **Yeşil:** yeşil baskın (`g > 1.08·r`, `g > 1.2·b`).
- Uydu şerit boşlukları (saf siyah) hiçbir sınıfa sayılmaz.
- Piksel alanı enleme göre: `(40 075 km · cos φ / 2ᶻ⁺⁸)²`.

Sonuç yaklaşıktır (bulut, sığ su, 250 m çözünürlük); arayüz bunu söyler ve bulut oranı yüksekse uyarır.
Aral Gölü için çıkan −43 % (2000→2024) literatürdeki küçülmeyle aynı mertebededir.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:5176
npm run build    # dist/ — statik; GitHub Pages / Vercel / Netlify
```

Veri tasarrufu: döşemeler yalnızca hareket bitince yüklenir, zoom animasyonunda ara seviyeler indirilmez,
ekran dışı tampon tutulmaz. İlk ziyaretten sonra tarayıcı önbelleği devreye girer.

## Yapı

```
src/
  gibs.ts      NASA GIBS katman tanımları, URL üretimi, tarih yardımcıları
  stories.ts   9 hikâye (TR/EN metin, konum, tarihler, kaynak)
  map.ts       Leaflet haritası + iki katmanı ayıran kaydırıcı (clip)
  measure.ts   piksel sınıflandırma ve km² hesabı
  i18n.ts      TR/EN sözlük
  main.ts      arayüz, URL durumu, konum, paylaşım
```

Lisans: MIT. NASA görüntüleri kamu malıdır; atıf arayüzde gösterilir.
