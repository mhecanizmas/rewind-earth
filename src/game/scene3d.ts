import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const R_EARTH = 10; // sahne birimi = Dünya yarıçapı
const TEX = import.meta.env.BASE_URL + "tex/";

/** Dünya: gerçek NASA Blue Marble + gece ışıkları, gerçek gündüz/gece terminatörü. */
const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
  }`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D waterMap;
  uniform sampler2D bumpMap;
  uniform vec3 sunDir;
  uniform vec3 camPos;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 N = normalize(vNormalW);

    // kabartmadan küçük bir normal sapması (dağlar hissedilsin)
    float h  = texture2D(bumpMap, vUv).r;
    float hx = texture2D(bumpMap, vUv + vec2(0.0015, 0.0)).r;
    float hy = texture2D(bumpMap, vUv + vec2(0.0, 0.0015)).r;
    vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
    vec3 B = normalize(cross(N, T));
    N = normalize(N + (T * (h - hx) + B * (h - hy)) * 1.6);

    float ndl = dot(N, sunDir);
    float day = smoothstep(-0.12, 0.22, ndl);

    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float water = texture2D(waterMap, vUv).r;

    // gündüz: yumuşak difüz + ufukta hafif soğuma
    vec3 lit = dayCol * (0.18 + 0.95 * max(ndl, 0.0));

    // okyanusta güneş parlaması
    vec3 V = normalize(camPos - vPosW);
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 68.0) * water * step(0.0, ndl);
    lit += vec3(1.0, 0.95, 0.85) * spec * 1.3;

    // gece: şehir ışıkları, terminatöre yakın sönümlü
    vec3 night = nightCol * 2.1 * smoothstep(0.08, -0.25, ndl);
    night += vec3(0.012, 0.018, 0.035) * (1.0 - day); // okyanusun zifiri olmaması için

    vec3 col = mix(night, lit, day);

    // atmosferin kenar maviliği
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += vec3(0.25, 0.47, 0.95) * fres * (0.35 + 0.65 * max(ndl, 0.0)) * 0.55;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
  }`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 sunDir;
  uniform vec3 camPos;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(camPos - vPosW);
    float fres = pow(1.0 - max(dot(N, -V), 0.0), 2.6);
    float sun = max(dot(N, sunDir), 0.0);
    float a = fres * (0.25 + 0.75 * sun);
    gl_FragColor = vec4(vec3(0.33, 0.58, 1.0), a * 0.9);
  }`;

export interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  earth: THREE.Mesh;
  earthGroup: THREE.Group;
  sun: THREE.DirectionalLight;
  setSunAngle(rad: number): void;
  resize(): void;
  render(): void;
  texturesReady: Promise<void>;
  dispose(): void;
}

export function createScene3D(canvas: HTMLCanvasElement): Scene3D {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 4000);
  camera.position.set(0, 7, 26);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = R_EARTH + 1.2;
  controls.maxDistance = 120;
  controls.enablePan = false;
  controls.rotateSpeed = 0.5;

  /* ---- dokular ---- */
  const loader = new THREE.TextureLoader();
  const load = (f: string, srgb: boolean) =>
    new Promise<THREE.Texture>((resolve) => {
      loader.load(
        TEX + f,
        (t) => {
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          t.wrapS = THREE.RepeatWrapping;
          resolve(t);
        },
        undefined,
        () => resolve(fallbackTexture(srgb)), // doku gelmezse sahne yine çalışsın
      );
    });

  const uniforms = {
    dayMap: { value: fallbackTexture(true) },
    nightMap: { value: fallbackTexture(true) },
    waterMap: { value: fallbackTexture(false) },
    bumpMap: { value: fallbackTexture(false) },
    sunDir: { value: new THREE.Vector3(1, 0.15, 0.4).normalize() },
    camPos: { value: new THREE.Vector3() },
  };

  const texturesReady = Promise.all([
    load("earth_day.jpg", true),
    load("earth_night.jpg", true),
    load("earth_water.jpg", false),
    load("earth_bump.jpg", false),
  ]).then(([d, n, w, b]) => {
    uniforms.dayMap.value = d;
    uniforms.nightMap.value = n;
    uniforms.waterMap.value = w;
    uniforms.bumpMap.value = b;
  });

  /* ---- Dünya ---- */
  const earthGroup = new THREE.Group();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(R_EARTH, 128, 96),
    new THREE.ShaderMaterial({ uniforms, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG }),
  );
  earth.rotation.y = -Math.PI / 2; // doku boylamını gerçek boylamla hizala
  earthGroup.add(earth);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R_EARTH * 1.035, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { sunDir: uniforms.sunDir, camPos: uniforms.camPos },
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  earthGroup.add(atmo);
  scene.add(earthGroup);

  /* ---- yıldızlar ---- */
  scene.add(makeStars());

  /* ---- ortam haritası: metal yüzeyler gerçek yansıma alsın ---- */
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(makeEnvTexture()).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.75;
    pmrem.dispose();
  }

  /* ---- ışık ---- */
  const sun = new THREE.DirectionalLight(0xfff4e0, 3.2);
  sun.position.copy(uniforms.sunDir.value).multiplyScalar(220);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x5a6a8a, 0.55));
  const fill = new THREE.DirectionalLight(0x4a7ad0, 0.5);
  fill.position.set(-80, -30, -60);
  scene.add(fill);

  function setSunAngle(rad: number) {
    uniforms.sunDir.value.set(Math.cos(rad), 0.16, Math.sin(rad)).normalize();
    sun.position.copy(uniforms.sunDir.value).multiplyScalar(220);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render() {
    uniforms.camPos.value.copy(camera.position);
    controls.update();
    renderer.render(scene, camera);
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  resize();

  return {
    renderer, scene, camera, controls, earth, earthGroup, sun,
    setSunAngle, resize, render, texturesReady,
    dispose() {
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
    },
  };
}

/** Doku indirilemezse sahneyi ayakta tutan 1x1 doku. */
function fallbackTexture(srgb: boolean): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = srgb ? "#17406e" : "#808080";
  ctx.fillRect(0, 0, 2, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

/**
 * Uzay ortamı: üstte karanlık gökyüzü, altta Dünya'dan yansıyan mavi-beyaz
 * parlaklık, bir yanda Güneş. Metal panellerin üzerinde gerçekçi yansıma verir.
 */
function makeEnvTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#02030a");
  g.addColorStop(0.42, "#070d1c");
  g.addColorStop(0.62, "#1d3f72");
  g.addColorStop(0.82, "#5c93d8");
  g.addColorStop(1, "#b9d6f2");
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 256);
  // Güneş
  const s = x.createRadialGradient(118, 74, 0, 118, 74, 72);
  s.addColorStop(0, "#ffffff");
  s.addColorStop(0.25, "#fff0cc");
  s.addColorStop(1, "rgba(255,230,180,0)");
  x.fillStyle = s;
  x.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStars(): THREE.Points {
  const N = 3500;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 700);
    pos.set([v.x, v.y, v.z], i * 3);
    // gerçekçi yıldız renkleri: mavimsi-beyazdan sarımsıya
    c.setHSL(0.55 + Math.random() * 0.12, 0.35 * Math.random(), 0.72 + Math.random() * 0.28);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({ size: 2.1, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95 }),
  );
}

/** Enlem/boylamdan sahne koordinatı (Dünya yüzeyinden `alt` birim yukarı). */
export function latLngToVec3(lat: number, lng: number, alt = 0): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const r = R_EARTH + alt;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
