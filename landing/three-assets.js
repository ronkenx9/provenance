/* ============================================================
   PROVENANCE — three.js generated assets
   · hero: obsidian rating seal, embossed serif A, ring text
   · dossiers: four metal coin tokens (gold/silver/blue/bronze)
   Falls back silently to CSS/SVG if WebGL is unavailable.
============================================================ */
import * as THREE from "three";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { return false; }
}
if (!webglOK()) { console.warn("[provenance] WebGL unavailable — CSS fallback"); }
else init();

function init() {
  document.body.classList.add("webgl-on");
  const clock = new THREE.Clock();
  const scenes = []; // { update(dt,t), visible }

  /* ---------------------------------------------------------
     texture painters
  --------------------------------------------------------- */
  function sealFaceTexture() {
    const S = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");

    // base obsidian
    const g = x.createRadialGradient(S * 0.38, S * 0.34, S * 0.05, S * 0.5, S * 0.5, S * 0.62);
    g.addColorStop(0, "#33343C");
    g.addColorStop(0.5, "#1C1D23");
    g.addColorStop(1, "#0B0C0F");
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);

    // concentric engraved rings
    x.strokeStyle = "rgba(255,255,255,.10)";
    x.lineWidth = 3;
    [0.475, 0.345].forEach((r) => {
      x.beginPath(); x.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); x.stroke();
    });
    x.strokeStyle = "rgba(0,0,0,.55)";
    [0.468, 0.338].forEach((r) => {
      x.beginPath(); x.arc(S / 2, S / 2, S * r, 0, Math.PI * 2); x.stroke();
    });

    // ring text
    const msg = "PROVENANCE · DETERMINISTIC · ANCHORED · ";
    x.font = "500 38px 'JetBrains Mono', monospace";
    x.fillStyle = "#6A6B75";
    x.textAlign = "center";
    x.textBaseline = "middle";
    const radius = S * 0.41;
    const step = (Math.PI * 2) / (msg.length * 1.0);
    x.save();
    x.translate(S / 2, S / 2);
    for (let i = 0; i < msg.length; i++) {
      const a = i * step - Math.PI / 2;
      x.save();
      x.rotate(a);
      x.translate(0, -radius);
      x.fillText(msg[i], 0, 0);
      x.restore();
    }
    x.restore();

    // embossed serif A
    x.font = "400 470px 'Instrument Serif', serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    // shadow pass (engrave depth)
    x.fillStyle = "rgba(0,0,0,.8)";
    x.fillText("A", S / 2 + 7, S / 2 + 46);
    // amber face
    x.fillStyle = "#E3A52F";
    x.fillText("A", S / 2, S / 2 + 38);
    // top sheen
    x.fillStyle = "rgba(255,255,255,.18)";
    x.fillText("A", S / 2 - 3, S / 2 + 34);
    x.fillStyle = "#E3A52F";
    x.fillText("A", S / 2 - 1, S / 2 + 36);

    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    return t;
  }

  function coinFaceTexture(symbol, ink, paper) {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    x.fillStyle = paper;
    x.fillRect(0, 0, S, S);
    // dashed inner ring
    x.strokeStyle = ink;
    x.globalAlpha = 0.45;
    x.setLineDash([6, 5]);
    x.lineWidth = 3;
    x.beginPath(); x.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]);
    x.globalAlpha = 1;
    // symbol
    x.font = "500 52px 'JetBrains Mono', monospace";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = ink;
    x.fillText(symbol, S / 2, S / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    return t;
  }

  /* ---------------------------------------------------------
     shared scene builder — a coin/seal disc facing the camera
  --------------------------------------------------------- */
  function makeDisc({ mount, faceTexture, sideColor, metalness, roughness, size, spin, tiltAmp }) {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    cam.position.set(0, 0, 7);

    // lights — warm key, cool rim, low ambient
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x8FA0C8, 1.6, 30);
    rim.position.set(4, -2, 3);
    scene.add(rim);

    const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, metalness, roughness: roughness + 0.12 });
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture, metalness: metalness * 0.7, roughness });
    const backMat = new THREE.MeshStandardMaterial({ color: sideColor, metalness, roughness: roughness + 0.18 });

    const geo = new THREE.CylinderGeometry(1.55, 1.55, 0.22, 96);
    const disc = new THREE.Mesh(geo, [sideMat, faceMat, backMat]);
    disc.rotation.x = Math.PI / 2; // face the camera
    scene.add(disc);

    const group = new THREE.Group();
    scene.remove(disc); group.add(disc); scene.add(group);

    let mx = 0, my = 0; // pointer-driven tilt targets
    const entry = {
      visible: true,
      onPointer(dx, dy) { mx = dx; my = dy; },
      update(dt, t) {
        disc.rotation.y = t * spin;                 // slow face spin (cylinder axis)
        group.rotation.x += ((my * tiltAmp) - group.rotation.x) * Math.min(dt * 4, 1);
        group.rotation.y += ((mx * tiltAmp) - group.rotation.y) * Math.min(dt * 4, 1);
        group.rotation.y += Math.sin(t * 0.4) * 0.0008; // idle breathing
        renderer.render(scene, cam);
      },
      renderer,
    };

    const io = new IntersectionObserver(([e]) => { entry.visible = e.isIntersecting; }, { rootMargin: "80px" });
    io.observe(mount);
    return entry;
  }

  /* ---------------------------------------------------------
     hero seal
  --------------------------------------------------------- */
  function setup() {
  const sealMount = document.getElementById("seal3d");
  if (sealMount) {
    const px = Math.min(sealMount.clientWidth || 560, 720);
    const seal = makeDisc({
      mount: sealMount,
      faceTexture: sealFaceTexture(),
      sideColor: 0x191A20,
      metalness: 0.25,
      roughness: 0.38,
      size: px,
      spin: reduced ? 0 : 0.05,
      tiltAmp: 0.22,
    });
    scenes.push(seal);
    window.addEventListener("pointermove", (e) => {
      const dx = (e.clientX / window.innerWidth) * 2 - 1;
      const dy = (e.clientY / window.innerHeight) * 2 - 1;
      seal.onPointer(dx, dy);
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     dossier coins
  --------------------------------------------------------- */
  const METALS = {
    gold:   { side: 0xA87E1F, ink: "#4A3505", paper: "#E8C66A", metalness: 0.95, roughness: 0.28 },
    silver: { side: 0x83858D, ink: "#33343A", paper: "#D9DAE0", metalness: 0.95, roughness: 0.24 },
    blue:   { side: 0x2C4478, ink: "#0E1830", paper: "#6F8CC4", metalness: 0.85, roughness: 0.3 },
    bronze: { side: 0x7E5526, ink: "#3A2208", paper: "#C99159", metalness: 0.9, roughness: 0.32 },
  };
  document.querySelectorAll(".coin[data-coin]").forEach((el) => {
    const m = METALS[el.dataset.metal] || METALS.gold;
    const coin = makeDisc({
      mount: el,
      faceTexture: coinFaceTexture(el.dataset.coin, m.ink, m.paper),
      sideColor: m.side,
      metalness: m.metalness,
      roughness: m.roughness,
      size: 144,
      spin: reduced ? 0 : 0.5,
      tiltAmp: 0.3,
    });
    scenes.push(coin);
    const card = el.closest(".dossier-card");
    if (card) {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        coin.onPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      }, { passive: true });
      card.addEventListener("pointerleave", () => coin.onPointer(0, 0), { passive: true });
    }
  });
  } // end setup()

  /* ---------------------------------------------------------
     single RAF loop
  --------------------------------------------------------- */
  function loop() {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    for (const s of scenes) if (s.visible) s.update(dt, t);
    requestAnimationFrame(loop);
  }
  // build textures only after fonts load, so canvases use the right faces
  const start = () => { setup(); loop(); };
  if (document.fonts?.ready) document.fonts.ready.then(start);
  else start();
}
