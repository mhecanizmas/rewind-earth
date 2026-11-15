"""
NASA GIBS WMTS döşemelerinden 3D küre için eş dikdörtgensel (equirectangular)
Dünya dokuları üretir. Çıktı: public/tex/*.jpg

Kullanım:  python scripts/build-earth-textures.py
Bir kez çalışır; üretilen dosyalar depoya girer, çalışma anında indirme olmaz.
"""
import io
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageFilter

BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best"
TILE = 512
ZOOM = 2  # 8 x 4 döşeme -> 4096 x 2048
COLS, ROWS = 2 ** (ZOOM + 1), 2 ** ZOOM
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "tex")

LAYERS = {
    "earth_day": ("BlueMarble_ShadedRelief_Bathymetry", "2004-01-01"),
    "earth_night": ("VIIRS_CityLights_2012", "2012-01-01"),
    "earth_relief": ("BlueMarble_ShadedRelief", "2004-01-01"),
}


def fetch(layer, time, row, col):
    url = f"{BASE}/{layer}/default/{time}/500m/{ZOOM}/{row}/{col}.jpeg"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "rewind-earth-build/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return row, col, Image.open(io.BytesIO(r.read())).convert("RGB")
        except Exception as exc:  # ağ dalgalanması: tekrar dene
            if attempt == 3:
                print(f"  ! {layer} {row}/{col}: {exc}", file=sys.stderr)
                return row, col, Image.new("RGB", (TILE, TILE), (0, 0, 0))


def build(name, layer, time):
    canvas = Image.new("RGB", (COLS * TILE, ROWS * TILE))
    jobs = [(layer, time, r, c) for r in range(ROWS) for c in range(COLS)]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for row, col, img in pool.map(lambda a: fetch(*a), jobs):
            canvas.paste(img, (col * TILE, row * TILE))
    path = os.path.join(OUT, f"{name}.jpg")
    canvas.save(path, "JPEG", quality=88, optimize=True)
    print(f"  {name}.jpg  {canvas.width}x{canvas.height}  {os.path.getsize(path)//1024} KB")
    return canvas


def water_mask(day):
    """Mavi baskın pikseller = su. Okyanusta parlama (specular) için maske."""
    small = day.resize((2048, 1024), Image.LANCZOS)
    r, g, b = small.split()
    px_r, px_g, px_b = r.load(), g.load(), b.load()
    mask = Image.new("L", small.size)
    pm = mask.load()
    for y in range(small.height):
        for x in range(small.width):
            vr, vg, vb = px_r[x, y], px_g[x, y], px_b[x, y]
            is_water = vb > vr + 10 and vb >= vg and (vr + vg + vb) < 460
            pm[x, y] = 235 if is_water else 10
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    path = os.path.join(OUT, "earth_water.jpg")
    mask.save(path, "JPEG", quality=85, optimize=True)
    print(f"  earth_water.jpg  {mask.width}x{mask.height}  {os.path.getsize(path)//1024} KB")


def bump_from(relief):
    """Gölgeli kabartma haritasından gri yükseklik dokusu."""
    g = relief.convert("L").resize((2048, 1024), Image.LANCZOS)
    g = g.filter(ImageFilter.GaussianBlur(0.6))
    path = os.path.join(OUT, "earth_bump.jpg")
    g.save(path, "JPEG", quality=85, optimize=True)
    print(f"  earth_bump.jpg  {g.width}x{g.height}  {os.path.getsize(path)//1024} KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("NASA GIBS -> eş dikdörtgensel Dünya dokuları")
    day = build("earth_day", *LAYERS["earth_day"])
    build("earth_night", *LAYERS["earth_night"])
    relief = build("earth_relief", *LAYERS["earth_relief"])
    water_mask(day)
    bump_from(relief)
    os.remove(os.path.join(OUT, "earth_relief.jpg"))  # ara ürün
    print("bitti.")
