import * as THREE from "three";
import { partById, type Part } from "./parts";

export interface Selection {
  camera: string;
  power: string;
  antenna: string;
  battery: string;
  thruster: string;
}

export interface SatelliteModel {
  group: THREE.Group;
  /** 0 = katlı (fırlatma konumu), 1 = tam açılmış */
  setDeploy(t: number): void;
  /** kamera merceğinden çıkan tarama konisi */
  setScanVisible(v: boolean): void;
  dispose(): void;
}

/* ---------------- yüzey dokuları (hepsi canvas'ta üretilir) ---------------- */

function solarTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0b1b3f";
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const g = x.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32);
      g.addColorStop(0, "#1b3f86");
      g.addColorStop(0.5, "#15306b");
      g.addColorStop(1, "#24529f");
      x.fillStyle = g;
      x.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29);
    }
  x.strokeStyle = "rgba(190,215,255,0.5)";
  x.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 256); x.stroke();
    x.beginPath(); x.moveTo(0, i * 32); x.lineTo(256, i * 32); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Çok katmanlı yalıtım folyosunun buruşukluğu. */
function foilNormal(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#8080ff";
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const px = Math.random() * 256, py = Math.random() * 256;
    const len = 6 + Math.random() * 26, ang = Math.random() * Math.PI;
    const light = Math.random() > 0.5;
    x.strokeStyle = light ? "rgba(170,170,255,0.55)" : "rgba(90,90,255,0.55)";
    x.lineWidth = 0.7 + Math.random() * 1.4;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

/* ---------------- model ---------------- */

export function buildSatellite(sel: Selection): SatelliteModel {
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(o: T) => (disposables.push(o), o);

  const cam = partById(sel.camera);
  const pow = partById(sel.power);
  const ant = partById(sel.antenna);
  const bat = partById(sel.battery);
  const thr = partById(sel.thruster);

  const group = new THREE.Group();

  const foil = keep(foilNormal());
  const matFoil = keep(new THREE.MeshStandardMaterial({
    color: 0xe6bc55, metalness: 0.82, roughness: 0.3, normalMap: foil,
    normalScale: new THREE.Vector2(0.55, 0.55),
  }));
  const matWhite = keep(new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.25, roughness: 0.55 }));
  const matDark = keep(new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.6, roughness: 0.5 }));
  const matGlass = keep(new THREE.MeshStandardMaterial({
    color: 0x0a1626, metalness: 1, roughness: 0.08, emissive: 0x1d4a7a, emissiveIntensity: 0.5,
  }));

  /* --- gövde: kamera büyüdükçe platform büyür --- */
  const bodyScale = cam.id === "cam-sharp" ? 1.3 : cam.id === "cam-mid" ? 1.12 : 1;
  const bw = 1.7 * bodyScale, bh = 1.45 * bodyScale, bd = 1.9 * bodyScale;
  const body = new THREE.Mesh(keep(new THREE.BoxGeometry(bw, bh, bd)), matFoil);
  group.add(body);

  // radyatör (sıcak tarafı dışarı atan beyaz panel)
  const rad = new THREE.Mesh(keep(new THREE.BoxGeometry(bw * 0.92, 0.06, bd * 0.92)), matWhite);
  rad.position.y = bh / 2 + 0.04;
  group.add(rad);

  // yapısal çerçeve çizgileri
  const edge = new THREE.LineSegments(
    keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(bw, bh, bd))),
    keep(new THREE.LineBasicMaterial({ color: 0x3b2f12, transparent: true, opacity: 0.55 })),
  );
  group.add(edge);

  /* --- kamera teleskobu: nadire (−Y) bakar; keskin kamera = uzun tüp --- */
  // Boyutlar parçanın gerçek ölçülerinden türer; abartmamak için yumuşak sıkıştırma
  // uygulanır (tam ölçekte geniş açı kamerası görünmez kalırdı).
  const barrelLen = 0.5 + (cam.opticsLengthM ?? 1) * 0.45;
  const barrelR = 0.22 + (cam.apertureM ?? 0.2) * 0.3;
  const barrel = new THREE.Mesh(keep(new THREE.CylinderGeometry(barrelR, barrelR * 1.08, barrelLen, 28)), matDark);
  barrel.position.y = -bh / 2 - barrelLen / 2;
  group.add(barrel);
  // gölgeleme halkaları
  for (let i = 1; i <= 3; i++) {
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(barrelR * 1.06, 0.035, 8, 28)), matWhite);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -bh / 2 - (barrelLen * i) / 4;
    group.add(ring);
  }
  const lens = new THREE.Mesh(keep(new THREE.CircleGeometry(barrelR * 0.95, 28)), matGlass);
  lens.rotation.x = Math.PI / 2;
  lens.position.y = -bh / 2 - barrelLen - 0.001;
  group.add(lens);

  // tarama konisi (şerit genişliğiyle orantılı)
  const scanSpread = Math.min(2.4, 0.25 + (cam.swathKm ?? 200) / 900);
  const scan = new THREE.Mesh(
    keep(new THREE.ConeGeometry(scanSpread, 7, 32, 1, true)),
    keep(new THREE.MeshBasicMaterial({
      color: 0x7fd4ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })),
  );
  scan.position.y = -bh / 2 - barrelLen - 3.5;
  scan.visible = false;
  group.add(scan);

  /* --- güneş kanatları --- */
  const panelCount = pow.panels ?? 1;
  const panelW = 1.22 + (pow.areaM2 ?? 4) * 0.022, panelH = 0.95;
  const solarTex = keep(solarTexture());
  const matSolar = keep(new THREE.MeshStandardMaterial({
    map: solarTex, metalness: 0.55, roughness: 0.22,
    emissive: 0x0a1c3c, emissiveIntensity: 0.35, side: THREE.DoubleSide,
  }));
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    const boom = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 10)), matWhite);
    boom.rotation.z = Math.PI / 2;
    boom.position.x = side * 0.3;
    wing.add(boom);
    for (let i = 0; i < panelCount; i++) {
      const p = new THREE.Mesh(keep(new THREE.BoxGeometry(panelW, 0.035, panelH)), matSolar);
      p.position.x = side * (0.58 + panelW / 2 + i * (panelW + 0.06));
      wing.add(p);
      const fr = new THREE.Mesh(keep(new THREE.BoxGeometry(panelW + 0.06, 0.05, panelH + 0.06)), matWhite);
      fr.position.copy(p.position);
      fr.position.y -= 0.03;
      wing.add(fr);
    }
    wing.position.x = (side * bw) / 2;
    group.add(wing);
    wings.push(wing);
  }
  (solarTex as THREE.Texture).repeat.set(panelCount * 1.6, 1);

  /* --- anten --- */
  const dishR = 0.16 + (ant.dishM ?? 0.3) * 0.42;
  const antGroup = new THREE.Group();
  const mast = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 10)), matWhite);
  mast.position.y = 0.3;
  antGroup.add(mast);
  if (ant.id === "ant-s") {
    const whip = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8)), matDark);
    whip.position.y = 1.05;
    antGroup.add(whip);
    const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(0.08, 12, 10)), matWhite);
    tip.position.y = 1.5;
    antGroup.add(tip);
  } else {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const r = (i / 14) * dishR;
      pts.push(new THREE.Vector2(r, (r * r) / (dishR * 1.5)));
    }
    const dish = new THREE.Mesh(keep(new THREE.LatheGeometry(pts, 36)), keep(
      new THREE.MeshStandardMaterial({ color: 0xf2f4f8, metalness: 0.65, roughness: 0.25, side: THREE.DoubleSide }),
    ));
    dish.position.y = 0.62;
    antGroup.add(dish);
    const feedArm = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, dishR * 0.9, 8)), matDark);
    feedArm.position.y = 0.62 + dishR * 0.45;
    antGroup.add(feedArm);
    const feed = new THREE.Mesh(keep(new THREE.ConeGeometry(0.07, 0.16, 12)), matDark);
    feed.position.y = 0.62 + dishR * 0.9;
    feed.rotation.x = Math.PI;
    antGroup.add(feed);
  }
  antGroup.position.y = bh / 2;
  antGroup.position.z = -bd * 0.2;
  group.add(antGroup);

  /* --- batarya kutusu --- */
  if (bat.id === "bat-l") {
    const b = new THREE.Mesh(keep(new THREE.BoxGeometry(0.45, 0.5, 0.75)), matDark);
    b.position.set(0, -0.1, bd / 2 + 0.22);
    group.add(b);
  }

  /* --- itki nozülü --- */
  if (thr.deltaVms && thr.deltaVms > 0) {
    const tank = new THREE.Mesh(keep(new THREE.SphereGeometry(0.33, 20, 16)), matWhite);
    tank.position.set(0, -0.05, -bd / 2 - 0.3);
    group.add(tank);
    const noz = new THREE.Mesh(keep(new THREE.ConeGeometry(0.17, 0.4, 16, 1, true)), matDark);
    noz.position.set(0, -0.05, -bd / 2 - 0.78);
    noz.rotation.x = -Math.PI / 2;
    group.add(noz);
  }

  /* --- yıldız izleyici (her uyduda var) --- */
  const st = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 12)), matDark);
  st.position.set(bw / 2 - 0.2, bh / 2 + 0.12, bd / 2 - 0.3);
  st.rotation.x = -0.5;
  group.add(st);

  /* --- açılma animasyonu --- */
  function setDeploy(t: number) {
    const k = Math.max(0, Math.min(1, t));
    wings.forEach((w, i) => {
      const dir = i === 0 ? -1 : 1;
      w.rotation.z = dir * (1 - k) * Math.PI * 0.46;
      w.scale.setScalar(0.35 + 0.65 * k);
    });
    antGroup.scale.setScalar(0.3 + 0.7 * k);
    antGroup.visible = k > 0.04;
  }
  setDeploy(1);

  return {
    group,
    setDeploy,
    setScanVisible(v) { scan.visible = v; },
    dispose() {
      disposables.forEach((d) => d.dispose());
      group.clear();
    },
  };
}

/* ---------------- bütçe hesabı ---------------- */

export interface Budgets {
  massKg: number;
  genW: number;
  loadW: number;
  marginPct: number;
  costM: number;
  /** günde üretilen veri (GB) */
  dataGbDay: number;
  /** günde indirilebilen veri (GB) */
  downGbDay: number;
  dataOk: number; // 0..1
  parts: Part[];
}

export function budgets(sel: Selection, altitudeKm: number): Budgets {
  const parts = [sel.camera, sel.power, sel.antenna, sel.battery, sel.thruster].map(partById);
  const cam = partById(sel.camera);
  const ant = partById(sel.antenna);

  const massKg = 180 + parts.reduce((s, p) => s + p.massKg, 0); // 180 kg platform
  const genW = parts.reduce((s, p) => s + Math.max(0, p.powerW), 0) * 0.72; // gölge payı
  const loadW = 55 + parts.reduce((s, p) => s + Math.max(0, -p.powerW), 0);
  const costM = 95 + parts.reduce((s, p) => s + p.costM, 0); // 95 M$ platform + entegrasyon

  // görüntüleme günün ~%22'sinde (gündüz + hedef üstünde)
  const dataGbDay = ((cam.dataMbps ?? 0) * 86400 * 0.22) / 8 / 1024;
  // yer istasyonu geçişi: alçak yörüngede daha sık ama daha kısa
  const passMinPerDay = 42 * (1 + (altitudeKm - 400) / 1600);
  const downGbDay = ((ant.downlinkMbps ?? 0) * passMinPerDay * 60) / 8 / 1024;

  return {
    massKg, genW, loadW,
    marginPct: loadW > 0 ? ((genW - loadW) / loadW) * 100 : 100,
    costM, dataGbDay, downGbDay,
    dataOk: dataGbDay > 0 ? Math.min(1, downGbDay / dataGbDay) : 1,
    parts,
  };
}

/** Yörünge yüksekliğinden türeyen görev özellikleri. */
export function orbitStats(altitudeKm: number, swathKm: number) {
  const periodMin = 1.658669e-4 * Math.pow(6371 + altitudeKm, 1.5); // Kepler, dakika
  const orbitsPerDay = 1440 / periodMin;
  // ekvatorda ardışık izler arası mesafe
  const trackGapKm = 40075 / orbitsPerDay;
  const revisitDays = Math.max(1, Math.round(trackGapKm / Math.max(swathKm, 1)));
  // sürüklenme ömrü: 400 km'de ~2 yıl, 800 km'de ~onlarca yıl
  const lifetimeYears = Math.round(Math.pow(Math.max(altitudeKm - 330, 20) / 70, 2.1) * 10) / 10;
  return { periodMin, orbitsPerDay, revisitDays, lifetimeYears };
}

/** Seçime göre yaklaşık gerçek ölçüler (metre) — 3B model şematiktir, bunlar gerçek. */
export function dimensions(sel: Selection) {
  const cam = partById(sel.camera);
  const pow = partById(sel.power);
  const busM = cam.resolutionM === 1 ? 2.6 : cam.resolutionM === 30 ? 2.3 : 2.0;
  const panels = pow.panels ?? 1;
  const panelLenM = (pow.areaM2 ?? 4) / panels / 2.0;
  return {
    busM,
    spanM: busM + 2 * panels * panelLenM,
    lengthM: busM + (cam.opticsLengthM ?? 0.9),
    apertureM: cam.apertureM ?? 0.18,
    opticsM: cam.opticsLengthM ?? 0.9,
  };
}
