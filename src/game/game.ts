import * as THREE from "three";
import { getLang } from "../i18n";
import { byKind, MISSIONS, missionById, partById, type Mission, type Part } from "./parts";
import { budgets, buildSatellite, dimensions, orbitStats, type Budgets, type Selection, type SatelliteModel } from "./satellite";
import { createScene3D, latLngToVec3, R_EARTH, type Scene3D } from "./scene3d";

type TR = { tr: string; en: string };
const L = (v: TR) => v[getLang()];
const n0 = (v: number) => Math.round(v).toLocaleString(getLang() === "tr" ? "tr-TR" : "en-US");
const n2 = (v: number) =>
  v.toLocaleString(getLang() === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = (v: number) => v.toLocaleString(getLang() === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 1 });

export type Phase = "brief" | "build" | "orbit" | "launch" | "result";

export interface GameResult {
  mission: Mission;
  score: number;
  stars: number;
  selection: Selection;
  altitudeKm: number;
  maxZoom: number;
}

const DEFAULT_SEL: Selection = {
  camera: "cam-wide", power: "pow-m", antenna: "ant-x", battery: "bat-s", thruster: "thr-none",
};

/** Kamera çözünürlüğünden anlamlı yakınlaştırma sınırı (GIBS en çok 9). */
const zoomForResolution = (m: number) => (m <= 1 ? 9 : m <= 30 ? 8 : m <= 250 ? 6 : 5);

export interface Game {
  el: HTMLElement;
  start(): void;
  stop(): void;
  resize(): void;
  /** Dil değişince bütün oyun arayüzünü yeniden çizer. */
  relang(): void;
}

export function createGame(root: HTMLElement, onSeeThroughEye: (r: GameResult) => void): Game {
  /* ---------- DOM iskeleti ---------- */
  root.innerHTML = `
    <canvas id="g-canvas"></canvas>
    <div id="g-hud">
      <header id="g-top">
        <div class="g-brand"><b id="g-title"></b><span id="g-sub"></span></div>
        <div id="g-steps"></div>
      </header>
      <aside id="g-left"></aside>
      <aside id="g-right"></aside>
      <footer id="g-bottom"></footer>
      <div id="g-center"></div>
    </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>("#g-canvas")!;
  const elTitle = root.querySelector<HTMLElement>("#g-title")!;
  const elSub = root.querySelector<HTMLElement>("#g-sub")!;
  const elSteps = root.querySelector<HTMLElement>("#g-steps")!;
  const elLeft = root.querySelector<HTMLElement>("#g-left")!;
  const elRight = root.querySelector<HTMLElement>("#g-right")!;
  const elBottom = root.querySelector<HTMLElement>("#g-bottom")!;
  const elCenter = root.querySelector<HTMLElement>("#g-center")!;

  /* ---------- 3B sahne ---------- */
  const S = createScene3D(canvas);
  S.setSunAngle(0.6);

  const satPivot = new THREE.Group();
  const satHolder = new THREE.Group();
  satPivot.add(satHolder);
  S.scene.add(satPivot);
  satPivot.rotation.x = -0.52; // kutup yörüngesine yakın eğim

  let sat: SatelliteModel | null = null;
  let satRadius = R_EARTH + 5.5;
  let spinSpeed = 0;
  let deploy = 1;
  let deployTarget = 1;
  let showroom = 0.6; // tasarım masasında uydu kendi etrafında yavaşça döner

  function rebuildSat() {
    if (sat) { satHolder.remove(sat.group); sat.dispose(); }
    sat = buildSatellite(sel);
    sat.setDeploy(deploy);
    satHolder.add(sat.group);
  }

  /* ---------- roket (fırlatma animasyonu) ---------- */
  const rocket = new THREE.Group();
  {
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, metalness: 0.2, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2128, metalness: 0.5, roughness: 0.6 });
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.6, 20), white);
    rocket.add(b1);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 1.2, 20), white);
    b2.position.y = 1.9;
    rocket.add(b2);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.8, 20), white);
    nose.position.y = 2.9;
    rocket.add(nose);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.22, 20), dark);
    band.position.y = 1.25;
    rocket.add(band);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.42), dark);
      const a = (i / 4) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 0.24, -1.2, Math.sin(a) * 0.24);
      fin.rotation.y = -a;
      rocket.add(fin);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 1.8, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb257, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    flame.position.y = -2.2;
    flame.rotation.x = Math.PI;
    flame.name = "flame";
    rocket.add(flame);
    const glow = new THREE.PointLight(0xffa040, 0, 14);
    glow.position.y = -2;
    glow.name = "glow";
    rocket.add(glow);
  }
  rocket.visible = false;
  S.scene.add(rocket);

  /* ---------- yörünge çizgisi ---------- */
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      }),
    ),
    new THREE.LineBasicMaterial({ color: 0x6ed0ff, transparent: true, opacity: 0.55 }),
  );
  orbitLine.visible = false;
  satPivot.add(orbitLine);

  /* ---------- oyun durumu ---------- */
  let phase: Phase = "brief";
  let mission: Mission = MISSIONS[0];
  let sel: Selection = { ...DEFAULT_SEL };
  let altitudeKm = 700;
  let running = false;
  let camMode: "earth" | "sat" | "launch" = "earth";
  const camTarget = new THREE.Vector3();
  let wantDist = 30;
  /** Dar ekranda paneller alt üçte ikiyi kaplar: uydu daha uzaktan ve yukarıda durmalı. */
  const isMobile = () => window.innerWidth < 900;

  rebuildSat();

  /* ---------- kamera koreografisi ---------- */
  function applyCamera(dt: number) {
    const satPos = new THREE.Vector3();
    satHolder.getWorldPosition(satPos);
    if (camMode === "sat") {
      // dar ekranda paneller alt kısmı kaplıyor: uyduyu görünür bölgeye yukarı kaydır
      if (isMobile()) satPos.addScaledVector(S.camera.up, -8.0);
      camTarget.lerp(satPos, 1 - Math.pow(0.0015, dt));
    } else if (camMode === "launch") {
      camTarget.lerp(rocket.position, 1 - Math.pow(0.0008, dt));
    } else {
      camTarget.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.pow(0.004, dt));
    }
    S.controls.target.copy(camTarget);
    const d = S.camera.position.distanceTo(camTarget);
    const nd = d + (wantDist - d) * (1 - Math.pow(0.004, dt));
    const dir = S.camera.position.clone().sub(camTarget).normalize();
    S.camera.position.copy(camTarget).add(dir.multiplyScalar(nd));
  }

  /* ---------- döngü ---------- */
  let raf = 0;
  let last = performance.now();
  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    S.earthGroup.rotation.y += dt * 0.012;
    satPivot.rotation.y += dt * spinSpeed;
    satHolder.position.set(0, 0, satRadius);
    if (sat) {
      // uydu daima nadire baksın
      sat.group.rotation.set(0, 0, 0);
      if (phase === "build") {
        showroom += dt * 0.26;
        satHolder.rotation.set(0.24, showroom, 0.08);
      } else {
        satHolder.lookAt(0, 0, 0);
        satHolder.rotateX(-Math.PI / 2);
      }
      deploy += (deployTarget - deploy) * (1 - Math.pow(0.02, dt));
      sat.setDeploy(deploy);
    }
    orbitLine.scale.setScalar(satRadius);
    applyCamera(dt);
    S.render();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- UI yardımcıları ---------- */
  const STEPS: { id: Phase; tr: string; en: string }[] = [
    { id: "brief", tr: "Görev", en: "Mission" },
    { id: "build", tr: "Tasarım", en: "Design" },
    { id: "orbit", tr: "Yörünge", en: "Orbit" },
    { id: "launch", tr: "Fırlatma", en: "Launch" },
    { id: "result", tr: "Sonuç", en: "Result" },
  ];
  function renderSteps() {
    elTitle.textContent = L({ tr: "GÖREV: UYDUNU KUR", en: "MISSION: BUILD A SATELLITE" });
    const i = STEPS.findIndex((s) => s.id === phase);
    elSteps.innerHTML = STEPS.map((s, k) =>
      `<span class="g-step ${k === i ? "on" : k < i ? "done" : ""}"><i>${k + 1}</i>${L(s)}</span>`).join("");
  }

  function setPhase(p: Phase) {
    phase = p;
    renderSteps();
    elCenter.innerHTML = "";
    elLeft.innerHTML = "";
    elRight.innerHTML = "";
    elBottom.innerHTML = "";
    root.dataset.phase = p;
    if (p === "brief") renderBrief();
    if (p === "build") renderBuild();
    if (p === "orbit") renderOrbit();
    if (p === "launch") runLaunch();
    if (p === "result") renderResult();
  }

  /* ---------- 1) görev seçimi ---------- */
  function renderBrief() {
    camMode = "earth"; wantDist = isMobile() ? 40 : 32; spinSpeed = 0; orbitLine.visible = false;
    if (sat) sat.group.visible = false;
    elSub.textContent = L({ tr: "NASA verisiyle gerçek bir Dünya gözlem uydusu tasarla", en: "Design a real Earth-observing satellite with NASA data" });
    elCenter.innerHTML = `
      <div class="g-card g-brief">
        <h2>${L({ tr: "Hangi görevi üstleniyorsun?", en: "Which mission do you take?" })}</h2>
        <div class="g-missions">
          ${MISSIONS.map((m) => `
            <button class="g-mission ${m.id === mission.id ? "on" : ""}" data-m="${m.id}">
              <span class="em">${m.emoji}</span>
              <b>${L({ tr: m.nameTr, en: m.nameEn })}</b>
              <p>${L({ tr: m.briefTr, en: m.briefEn })}</p>
              <div class="g-req">
                <span>🔍 ≤ ${m.needResolutionM} m</span>
                <span>🔁 ≤ ${m.needRevisitDays} ${L({ tr: "gün", en: "days" })}</span>
                <span>💰 ${m.budgetM} M$</span>
              </div>
            </button>`).join("")}
        </div>
        <button class="g-go" id="g-accept">${L({ tr: "Göreve başla", en: "Accept mission" })} →</button>
      </div>`;
    elCenter.querySelectorAll<HTMLButtonElement>(".g-mission").forEach((b) =>
      b.addEventListener("click", () => { mission = missionById(b.dataset.m!); renderBrief(); }));
    elCenter.querySelector("#g-accept")!.addEventListener("click", () => setPhase("build"));
  }

  /* ---------- 2) tasarım ---------- */
  function partCard(p: Part, on: boolean, b: Budgets): string {
    const spec: string[] = [];
    if (p.resolutionM) spec.push(`🔍 ${p.resolutionM} m`, `↔ ${n0(p.swathKm!)} km`);
    if (p.downlinkMbps) spec.push(`📡 ${n0(p.downlinkMbps)} Mbps`);
    if (p.energyWh) spec.push(`🔋 ${n0(p.energyWh)} Wh`);
    if (p.deltaVms) spec.push(`🚀 ${p.deltaVms} m/s`);
    if (p.powerW > 0) spec.push(`⚡ +${p.powerW} W`);
    else if (p.powerW < 0) spec.push(`⚡ ${p.powerW} W`);
    spec.push(`⚖ ${p.massKg} kg`, `💰 ${p.costM} M$`);
    if (p.opticsLengthM) spec.push(`🔭 ${n1(p.opticsLengthM)} m ${L({ tr: "tüp", en: "tube" })}`, `⌀ ${n2(p.apertureM ?? 0)} m ${L({ tr: "ayna", en: "mirror" })}`);
    if (p.areaM2) spec.push(`▭ ${p.areaM2} m²`);
    if (p.dishM) spec.push(`⌀ ${n1(p.dishM)} m`);
    void b;
    // seçili kart açılır: hangi teknoloji ve parça neden bu boyutta
    const detail = on
      ? `<div class="g-why">
           <div><i>⚙</i><span>${L({ tr: p.techTr, en: p.techEn })}</span></div>
           <div><i>📐</i><span>${L({ tr: p.whyTr, en: p.whyEn })}</span></div>
         </div>`
      : "";
    return `<button class="g-part ${on ? "on" : ""}" data-id="${p.id}">
      <b>${L({ tr: p.nameTr, en: p.nameEn })}</b>
      <p>${L({ tr: p.descTr, en: p.descEn })}</p>
      <div class="g-spec">${spec.map((s) => `<span>${s}</span>`).join("")}</div>
      ${detail}
      <em>${p.heritage}</em>
    </button>`;
  }

  function renderBuild() {
    camMode = "sat"; wantDist = isMobile() ? 30 : 14; spinSpeed = 0.025; orbitLine.visible = false;
    satRadius = R_EARTH + 5.5;
    if (sat) sat.group.visible = true;
    deployTarget = 1;
    elSub.textContent = L({ tr: `${mission.emoji} ${mission.nameTr}`, en: `${mission.emoji} ${mission.nameEn}` });
    const b = budgets(sel, altitudeKm);
    const groups: { k: Part["kind"]; tr: string; en: string }[] = [
      { k: "camera", tr: "Kamera", en: "Camera" },
      { k: "power", tr: "Güç", en: "Power" },
      { k: "antenna", tr: "Anten", en: "Antenna" },
      { k: "battery", tr: "Batarya", en: "Battery" },
      { k: "thruster", tr: "İtki", en: "Propulsion" },
    ];
    elLeft.innerHTML = `<div class="g-scroll">${groups.map((g) => `
      <h4>${L(g)}</h4>
      ${byKind(g.k).map((p) => partCard(p, sel[g.k] === p.id, b)).join("")}`).join("")}</div>`;
    elLeft.querySelectorAll<HTMLButtonElement>(".g-part").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = partById(btn.dataset.id!);
        sel = { ...sel, [p.kind]: p.id };
        rebuildSat();
        deploy = 0.45; // yeni parça açılarak gelsin
        renderBuild();
      }));
    renderBudgets();
    elBottom.innerHTML = `<button class="g-go" id="g-next">${L({ tr: "Yörüngeyi seç", en: "Choose orbit" })} →</button>`;
    elBottom.querySelector("#g-next")!.addEventListener("click", () => setPhase("orbit"));
  }

  function bar(label: string, val: string, frac: number, status: "ok" | "warn" | "bad") {
    return `<div class="g-bar ${status}"><div class="g-bar-h"><span>${label}</span><b>${val}</b></div>
      <div class="g-bar-t"><i style="width:${Math.max(2, Math.min(100, frac * 100))}%"></i></div></div>`;
  }

  function renderBudgets() {
    const b = budgets(sel, altitudeKm);
    const cam = partById(sel.camera);
    const o = orbitStats(altitudeKm, cam.swathKm ?? 200);
    const d = dimensions(sel);
    const powStat = b.genW < b.loadW ? "bad" : b.marginPct < 25 ? "warn" : "ok";
    const costStat = b.costM > mission.budgetM ? "bad" : b.costM > mission.budgetM * 0.92 ? "warn" : "ok";
    const dataStat = b.dataOk < 0.4 ? "bad" : b.dataOk < 0.85 ? "warn" : "ok";
    const resOk = (cam.resolutionM ?? 9999) <= mission.needResolutionM;
    const revOk = o.revisitDays <= mission.needRevisitDays;
    elRight.innerHTML = `
      <div class="g-scroll">
        <h4>${L({ tr: "Bütçeler", en: "Budgets" })}</h4>
        ${bar(L({ tr: "Güç", en: "Power" }), `${n0(b.genW)} / ${n0(b.loadW)} W`, b.loadW ? b.genW / b.loadW : 1, powStat)}
        ${bar(L({ tr: "Veri dönüşü", en: "Data return" }), `${Math.round(b.dataOk * 100)} %`, b.dataOk, dataStat)}
        ${bar(L({ tr: "Maliyet", en: "Cost" }), `${n0(b.costM)} / ${mission.budgetM} M$`, b.costM / mission.budgetM, costStat)}
        ${bar(L({ tr: "Kütle", en: "Mass" }), `${n0(b.massKg)} kg`, b.massKg / 900, b.massKg > 900 ? "bad" : "ok")}
        <h4>${L({ tr: "Görev hedefi", en: "Mission target" })}</h4>
        <div class="g-check ${resOk ? "ok" : "bad"}">${resOk ? "✔" : "✖"} ${L({ tr: "Çözünürlük", en: "Resolution" })}
          <b>${cam.resolutionM} m</b> <small>(≤ ${mission.needResolutionM} m)</small></div>
        <div class="g-check ${revOk ? "ok" : "bad"}">${revOk ? "✔" : "✖"} ${L({ tr: "Ziyaret sıklığı", en: "Revisit" })}
          <b>${o.revisitDays} ${L({ tr: "gün", en: "d" })}</b> <small>(≤ ${mission.needRevisitDays})</small></div>
        <h4>${L({ tr: "Aracın ölçüleri", en: "Spacecraft size" })}</h4>
        <div class="g-dims">
          <div><span>${L({ tr: "Kanat açıklığı", en: "Wing span" })}</span><b>${n1(d.spanM)} m</b></div>
          <div><span>${L({ tr: "Boy", en: "Length" })}</span><b>${n1(d.lengthM)} m</b></div>
          <div><span>${L({ tr: "Teleskop", en: "Telescope" })}</span><b>${n1(d.opticsM)} m</b></div>
          <div><span>${L({ tr: "Ana ayna", en: "Primary mirror" })}</span><b>${n2(d.apertureM)} m</b></div>
        </div>
        <div class="g-note">${L({
          tr: "Keskin kamera dar bakar: aynı yere daha seyrek uğrarsın. Geniş kamera her gün bakar ama ayrıntıyı kaçırır.",
          en: "A sharp camera looks narrow: you revisit less often. A wide camera looks daily but misses detail.",
        })}</div>
        <div class="g-note small">${L({
          tr: "3B model şematiktir; yukarıdaki ölçüler gerçek tasarımından gelir.",
          en: "The 3D model is schematic; the sizes above come from your actual design.",
        })}</div>
      </div>`;
  }

  /* ---------- 3) yörünge ---------- */
  function renderOrbit() {
    camMode = "earth"; wantDist = isMobile() ? 42 : 34; spinSpeed = 0.12; orbitLine.visible = true;
    elSub.textContent = L({ tr: "Yörünge yüksekliğini seç", en: "Choose your orbit altitude" });
    const draw = () => {
      const cam = partById(sel.camera);
      const o = orbitStats(altitudeKm, cam.swathKm ?? 200);
      satRadius = R_EARTH * (1 + altitudeKm / 6371);
      const revOk = o.revisitDays <= mission.needRevisitDays;
      elCenter.innerHTML = `
        <div class="g-card g-orbit">
          <h2>${n0(altitudeKm)} km</h2>
          <input type="range" id="g-alt" min="350" max="1200" step="10" value="${altitudeKm}">
          <div class="g-alt-ends"><span>350 km · ${L({ tr: "keskin ama kısa ömür", en: "sharp but short-lived" })}</span>
            <span>1200 km · ${L({ tr: "geniş ama uzak", en: "wide but distant" })}</span></div>
          <div class="g-orbit-stats">
            <div><span>${L({ tr: "Tur süresi", en: "Period" })}</span><b>${n0(o.periodMin)} ${L({ tr: "dk", en: "min" })}</b></div>
            <div><span>${L({ tr: "Günde tur", en: "Orbits/day" })}</span><b>${n1(o.orbitsPerDay)}</b></div>
            <div class="${revOk ? "ok" : "bad"}"><span>${L({ tr: "Ziyaret", en: "Revisit" })}</span><b>${o.revisitDays} ${L({ tr: "gün", en: "d" })}</b></div>
            <div><span>${L({ tr: "Ömür", en: "Lifetime" })}</span><b>${n1(o.lifetimeYears)} ${L({ tr: "yıl", en: "yr" })}</b></div>
          </div>
        </div>`;
      elCenter.querySelector<HTMLInputElement>("#g-alt")!.addEventListener("input", (e) => {
        altitudeKm = Number((e.target as HTMLInputElement).value);
        draw();
      });
    };
    draw();
    renderBudgets();
    elBottom.innerHTML = `<button class="g-back" id="g-b">← ${L({ tr: "Tasarım", en: "Design" })}</button>
      <button class="g-go g-launch" id="g-l">🚀 ${L({ tr: "FIRLAT", en: "LAUNCH" })}</button>`;
    elBottom.querySelector("#g-b")!.addEventListener("click", () => setPhase("build"));
    elBottom.querySelector("#g-l")!.addEventListener("click", () => setPhase("launch"));
  }

  /* ---------- 4) fırlatma ---------- */
  let launchTimers: number[] = [];
  function runLaunch() {
    elSub.textContent = L({ tr: "Fırlatma", en: "Launch" });
    const site = latLngToVec3(28.5, -80.6, 0); // Cape Canaveral
    const up = site.clone().normalize();
    rocket.position.copy(site);
    rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    rocket.visible = true;
    rocket.scale.setScalar(0.5);
    if (sat) sat.group.visible = false;
    orbitLine.visible = false;
    camMode = "launch";
    wantDist = 9;
    spinSpeed = 0;

    const flame = rocket.getObjectByName("flame") as THREE.Mesh;
    const glow = rocket.getObjectByName("glow") as THREE.PointLight;
    const t0 = performance.now();
    const DUR = 7200;

    const say = (txt: TR, sub = "") =>
      (elCenter.innerHTML = `<div class="g-launchtxt"><b>${L(txt)}</b><span>${sub}</span></div>`);

    say({ tr: "T−3… ateşleme", en: "T−3… ignition" });
    const step = (now: number) => {
      if (phase !== "launch") return;
      const k = Math.min(1, (now - t0) / DUR);
      const h = Math.pow(k, 1.7) * (satRadius - R_EARTH);
      rocket.position.copy(up).multiplyScalar(R_EARTH + h);
      // yerçekimi dönüşü: yükseldikçe yan yat
      const tilt = k * 1.25;
      const axis = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0, 1, 0)).normalize();
      rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      if (axis.lengthSq() > 0.001) rocket.rotateOnWorldAxis(axis, tilt);
      const burn = k < 0.72;
      flame.visible = burn;
      flame.scale.setScalar(burn ? 0.7 + Math.sin(now / 40) * 0.25 + k * 1.2 : 0);
      glow.intensity = burn ? 9 + Math.sin(now / 35) * 3 : 0;
      wantDist = 9 + k * 16;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    launchTimers = [
      window.setTimeout(() => say({ tr: "Maksimum dinamik basınç", en: "Max dynamic pressure" }, "T+72 s"), 1700),
      window.setTimeout(() => say({ tr: "Kademe ayrımı", en: "Stage separation" }, "T+2:41"), 3400),
      window.setTimeout(() => say({ tr: "Yörüngeye giriş", en: "Orbit insertion" }, `${n0(altitudeKm)} km`), 5200),
      window.setTimeout(() => {
        rocket.visible = false;
        if (sat) sat.group.visible = true;
        deploy = 0; deployTarget = 1;
        camMode = "sat"; wantDist = isMobile() ? 30 : 14;
        say({ tr: "Panel açılımı", en: "Array deployment" }, L({ tr: "sinyal alındı", en: "signal acquired" }));
      }, 7100),
      window.setTimeout(() => setPhase("result"), 9600),
    ];
  }

  /* ---------- 5) sonuç ---------- */
  function renderResult() {
    const b = budgets(sel, altitudeKm);
    const cam = partById(sel.camera);
    const o = orbitStats(altitudeKm, cam.swathKm ?? 200);
    const resOk = (cam.resolutionM ?? 9999) <= mission.needResolutionM;
    const revOk = o.revisitDays <= mission.needRevisitDays;
    const powOk = b.genW >= b.loadW;
    const costOk = b.costM <= mission.budgetM;

    let score = 0;
    score += resOk ? 28 : Math.max(0, 28 - Math.log2((cam.resolutionM ?? 1) / mission.needResolutionM) * 10);
    score += revOk ? 26 : Math.max(0, 26 - (o.revisitDays - mission.needRevisitDays) * 3);
    score += powOk ? 16 : 0;
    score += b.dataOk * 16;
    score += costOk ? 10 : Math.max(0, 10 - ((b.costM - mission.budgetM) / mission.budgetM) * 30);
    score += Math.min(4, o.lifetimeYears / 2);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const stars = score >= 85 ? 3 : score >= 62 ? 2 : score >= 35 ? 1 : 0;

    const notes: TR[] = [];
    if (!resOk) notes.push({
      tr: `Kameran ${cam.resolutionM} m görüyor; bu görev ${mission.needResolutionM} m istiyordu. Aradığın değişim piksellerin arasında kayboldu.`,
      en: `Your camera sees ${cam.resolutionM} m; the mission needed ${mission.needResolutionM} m. The change you sought fell between pixels.`,
    });
    if (!revOk) notes.push({
      tr: `Aynı yere ${o.revisitDays} günde bir uğruyorsun; ${mission.needRevisitDays} gün gerekiyordu. Daha geniş şerit ya da daha alçak yörünge dene.`,
      en: `You revisit every ${o.revisitDays} days; ${mission.needRevisitDays} was needed. Try a wider swath or a lower orbit.`,
    });
    if (!powOk) notes.push({
      tr: `Güç açığın var: ${n0(b.genW)} W üretip ${n0(b.loadW)} W harcıyorsun. Gerçekte araç güvenli moda düşer ve bilim durur.`,
      en: `Power deficit: you generate ${n0(b.genW)} W and draw ${n0(b.loadW)} W. In reality the craft safes and science stops.`,
    });
    if (b.dataOk < 0.85) notes.push({
      tr: `Ürettiğin verinin %${Math.round(b.dataOk * 100)}'ini indirebiliyorsun. Gerisi kaydediciye yazılıp üzerine yazılıyor — daha hızlı anten gerekli.`,
      en: `You downlink ${Math.round(b.dataOk * 100)}% of what you produce. The rest is overwritten on the recorder — you need a faster antenna.`,
    });
    if (!costOk) notes.push({
      tr: `Bütçeyi ${n0(b.costM - mission.budgetM)} M$ aştın. Gerçek bir seçim kurulu burada projeyi keserdi.`,
      en: `You are ${n0(b.costM - mission.budgetM)} M$ over budget. A real selection board would cancel here.`,
    });
    if (notes.length === 0) notes.push({
      tr: "Bütün bütçeler kapandı, hedefler tutturuldu. Bu tasarım gerçek bir Dünya gözlem misyonu olarak uçabilirdi.",
      en: "Every budget closes and the targets are met. This design could fly as a real Earth-observing mission.",
    });

    camMode = "sat"; wantDist = isMobile() ? 30 : 16; spinSpeed = 0.1; orbitLine.visible = true;
    if (sat) sat.setScanVisible(true);
    elSub.textContent = L({ tr: "Görev raporu", en: "Mission report" });
    elCenter.innerHTML = `
      <div class="g-card g-result">
        <div class="g-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>
        <h2>${score} <small>/ 100</small></h2>
        <div class="g-rchips">
          <span class="${resOk ? "ok" : "bad"}">🔍 ${cam.resolutionM} m</span>
          <span class="${revOk ? "ok" : "bad"}">🔁 ${o.revisitDays} ${L({ tr: "gün", en: "d" })}</span>
          <span class="${powOk ? "ok" : "bad"}">⚡ ${n0(b.genW)}/${n0(b.loadW)} W</span>
          <span class="${costOk ? "ok" : "bad"}">💰 ${n0(b.costM)} M$</span>
          <span>🛰 ${n0(altitudeKm)} km · ${n1(o.lifetimeYears)} ${L({ tr: "yıl", en: "yr" })}</span>
        </div>
        <ul class="g-notes">${notes.map((x) => `<li>${L(x)}</li>`).join("")}</ul>
        <div class="g-rbtns">
          <button class="g-back" id="g-again">↺ ${L({ tr: "Yeniden tasarla", en: "Redesign" })}</button>
          <button class="g-go" id="g-eye">🛰 ${L({ tr: "Uydunun gözüyle bak", en: "See through its eye" })} →</button>
        </div>
        <small class="g-eyehint">${L({
          tr: `Uydun ${cam.resolutionM} m görüyor — NASA arşivinde ${mission.emoji} ${mission.nameTr} bölgesi bu keskinlikte açılacak.`,
          en: `Your satellite sees ${cam.resolutionM} m — the ${mission.emoji} ${mission.nameEn} region opens at that sharpness in the NASA archive.`,
        })}</small>
      </div>`;
    elCenter.querySelector("#g-again")!.addEventListener("click", () => {
      if (sat) sat.setScanVisible(false);
      setPhase("build");
    });
    elCenter.querySelector("#g-eye")!.addEventListener("click", () =>
      onSeeThroughEye({
        mission, score, stars, selection: sel, altitudeKm,
        maxZoom: zoomForResolution(cam.resolutionM ?? 250),
      }));
  }

  /* ---------- dış arayüz ---------- */
  return {
    el: root,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      S.resize();
      raf = requestAnimationFrame(frame);
      if (!root.dataset.phase) setPhase("brief");
      else renderSteps();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      launchTimers.forEach(clearTimeout);
      launchTimers = [];
    },
    resize() { S.resize(); },
    relang() {
      renderSteps();
      // fırlatma sırasında yeniden çizmek animasyonu baştan başlatır
      if (phase === "launch") elSub.textContent = L({ tr: "Fırlatma", en: "Launch" });
      else setPhase(phase);
    },
  };
}
