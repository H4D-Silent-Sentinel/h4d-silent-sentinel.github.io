// Breadboard builds: 2D top view (SVG) and 3D view (three.js), drawn from one set of
// part outlines in millimetres. Dimensions and positions match the to-scale drawings
// on demo-system.html (Espressif and Adafruit design files, 830-point breadboard).
import * as THREE from "three";

// ---------- geometry (mm). x = along the breadboard (row 1 at x≈3.8), y = across (col a→j), z = up
const P = 2.54, L = 165.1, W = 54.6, BB_H = 8.5, HDR = 2.5, PCB = 1.6;
const rowx = r => 3.8 + (r - 1) * P;
const COL = { a: 13.33, b: 15.87, c: 18.41, d: 20.95, e: 23.49, f: 31.11, g: 33.65, h: 36.19, i: 38.73, j: 41.27 };
const RAIL = [5.71, 8.25, 46.35, 48.89];

function mic(id, c, r0, label, slot) {
  const out = c === "a" ? -1 : 1, yh = COL[c];
  const x0 = rowx(r0) - 1.905, x1 = x0 + 16.51;
  const ya = yh - out * 2.54, yb = yh + out * 10.16;
  return {
    id, kind: "mic", name: label, info: `ICS-43434 · 16.5 × 12.7 mm · ${slot}`,
    box: [x0, Math.min(ya, yb), x1, Math.max(ya, yb)],
    port: [x0 + 8.255, yh + out * 4.572],
    pins: Array.from({ length: 6 }, (_, k) => [rowx(r0 + k), yh]),
  };
}

function esp(info = "62.7 × 25.4 mm · detector, I2S capture, LoRa reports") {
  const x0 = rowx(21) - 1.40, x1 = rowx(42) + 8.0, ya = COL.c - 1.27, yb = COL.j + 1.27;
  const uy = [ya + 6.2, ya + 19.3];
  return {
    id: "esp", kind: "esp", name: "ESP32-S3-DevKitC-1", info,
    box: [x0, ya, x1, yb],
    module: [x0 + 6.5, COL.c + 1.0, x0 + 24.5, COL.j - 1.0],
    antenna: [x0, COL.c + 1.0, x0 + 6.5, COL.j - 1.0],
    usb: uy.map(y => [x1 - 7.3, y - 4.5, x1 + 1.0, y + 4.5]),
    pins: [...Array.from({ length: 22 }, (_, k) => [rowx(21 + k), COL.c]), ...Array.from({ length: 22 }, (_, k) => [rowx(21 + k), COL.j])],
  };
}

function rfm() {
  const xr = rowx(17), yj = COL.j;
  const fx = lx => xr - (lx - 2.54), fy = ly => yj + (ly - 2.54);
  return {
    id: "rfm", kind: "rfm", name: "RFM95W", info: "25.4 × 29.2 mm · LoRa 915 MHz, SPI · 78 mm wire antenna",
    box: [fx(25.654), fy(0), fx(0.254), fy(29.21)],
    module: [fx(12.7) - 8, fy(16) - 8, fx(12.7) + 8, fy(16) + 8],
    ant: [fx(21.59), fy(24.511)],
    pins: Array.from({ length: 9 }, (_, k) => [rowx(9 + k), yj]),
  };
}

// RD-03D: 44.0 × 15.0 mm PCB (datasheet), stood on edge past row 63, antenna face toward +x.
// Its 4-pin cable ends in Dupont sockets; each takes an M-M jumper into column a beside ESP32 J1.
const RD_X = L + 14, RD_Y0 = W / 2 - 22;
function rd03d() {
  const pins = [0, 1, 2, 3].map(k => [RD_X - 3, RD_Y0 + 17 + k * 2.54]);
  return {
    id: "rd", kind: "radar", name: "RD-03D", info: "44.0 × 15.0 mm · 24 GHz radar, faces outward · 4-pin cable: 5V, GND, TX → GPIO17, RX ← GPIO18",
    box: [RD_X, RD_Y0, RD_X + PCB, RD_Y0 + 44], stand: 15, face: +1, pins,
  };
}
// J1 runs from row 21 (pin 1, 3V3, antenna end) to row 42 (pin 22, GND, USB end)
const J1 = n => [rowx(20 + n), COL.a];
const RADAR_WIRES = [
  { from: J1(21), to: 0, name: "5V", cls: "w5" },   // J1-21 5V
  { from: J1(22), to: 1, name: "GND", cls: "wg" },  // J1-22 GND
  { from: J1(10), to: 2, name: "GPIO17 ← radar TX", cls: "ws" },
  { from: J1(11), to: 3, name: "GPIO18 → radar RX", cls: "ws" },
];

const BUILDS = {
  node: {
    name: "Listening node", count: "×4",
    parts: [esp(), rfm(),
      mic("m0", "a", 1, "Mic 0", "I2S bus 0 · left"), mic("m1", "j", 1, "Mic 1", "I2S bus 0 · right"),
      mic("m2", "a", 58, "Mic 2", "I2S bus 1 · left"), mic("m3", "j", 58, "Mic 3", "I2S bus 1 · right")],
  },
  base: { name: "Base receiver", count: "×1", parts: [esp("62.7 × 25.4 mm · LoRa receive, USB to the C2 laptop"), rfm()] },
  radar: { name: "Radar station", count: "×1", parts: [esp("62.7 × 25.4 mm · reads the radar, sends plots over LoRa"), rfm(), rd03d()], wires: RADAR_WIRES },
};
const BOARD = { id: "bb", name: "Breadboard", info: "830-point · 165.1 × 54.6 mm · 63 rows" };

// ---------- DOM
const root = document.getElementById("boards");
if (root) init();

function init() {
  const svgHost = root.querySelector(".bd-2d"), glHost = root.querySelector(".bd-3d");
  const out = root.querySelector(".bd-read");
  const tabs = [...root.querySelectorAll(".bd-tabs button")];
  let build = "node", hover = null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const show = id => {
    hover = id;
    const p = id === "bb" ? BOARD : BUILDS[build].parts.find(q => q.id === id);
    out.innerHTML = p ? `<b>${p.name}</b><span>${p.info}</span>` : `<b>${BUILDS[build].name} ${BUILDS[build].count}</b><span>${BUILDS[build].parts.length} parts · 165.1 × 54.6 mm breadboard</span>`;
    svgHost.querySelectorAll("[data-id]").forEach(g => g.classList.toggle("hot", g.dataset.id === id));
    view && view.highlight(id);
  };

  // ---- 2D
  const K = 5, PAD = 70;
  function draw2d() {
    const parts = BUILDS[build].parts;
    let x0 = 0, y0 = 0, x1 = L, y1 = W;
    for (const p of parts) { x0 = Math.min(x0, p.box[0]); y0 = Math.min(y0, p.box[1]); x1 = Math.max(x1, p.box[2]); y1 = Math.max(y1, p.box[3]); }
    y0 = Math.min(y0, -11);
    x0 -= 12; y0 -= 10; x1 += 8; y1 += 10;
    const X = v => (v - x0) * K, Y = v => (v - y0) * K;
    const r = (b, cls, rx = 2) => `<rect class="${cls}" x="${X(b[0])}" y="${Y(b[1])}" width="${(b[2] - b[0]) * K}" height="${(b[3] - b[1]) * K}" rx="${rx}"/>`;
    const o = [];
    o.push(`<g data-id="bb">${r([0, 0, L, W], "bb", 6)}`);
    o.push(`<rect class="ch" x="${X(1.5)}" y="${Y(25.6)}" width="${(L - 3) * K}" height="${3.4 * K}"/>`);
    for (const y of RAIL) o.push(`<line class="${y < 10 ? "rail" : "rail"}" x1="${X(2)}" y1="${Y(y)}" x2="${X(L - 2)}" y2="${Y(y)}"/>`);
    let h = "";
    for (let k = 1; k <= 63; k++) for (const c in COL) h += `M${X(rowx(k)).toFixed(1)} ${Y(COL[c]).toFixed(1)}h.01`;
    o.push(`<path class="holes" d="${h}"/></g>`);
    const rd = parts.find(p => p.kind === "radar");
    for (const w of BUILDS[build].wires || []) {
      const [tx, ty] = rd.pins[w.to], lane = 4 + 1.6 * w.to;
      o.push(`<path class="wire ${w.cls}" d="M${X(w.from[0])} ${Y(w.from[1])}V${Y(-lane)}H${X(L + 4 + w.to * 1.5)}V${Y(ty)}H${X(tx)}"/>`);
    }
    for (const p of parts) {
      o.push(`<g data-id="${p.id}" class="pt ${p.kind}">${r(p.box, "pcb")}`);
      if (p.stand) o.push(`<path class="face" d="M${X(p.box[2]) + 3} ${Y(p.box[1]) + 4}v${(p.box[3] - p.box[1]) * K - 8}"/>`);
      if (p.module) o.push(r(p.module, "mod", 1));
      if (p.antenna) o.push(r(p.antenna, "mod dim", 1));
      if (p.usb) p.usb.forEach(u => o.push(r(u, "mod", 1)));
      if (p.port) o.push(`<circle class="port" cx="${X(p.port[0])}" cy="${Y(p.port[1])}" r="${K * 0.9}"/>`);
      if (p.ant) o.push(`<path class="antw" d="M${X(p.ant[0])} ${Y(p.ant[1])}H${X(x0 + 2)}"/>`);
      let pp = ""; for (const [x, y] of p.pins) pp += `M${X(x) - 2.6} ${Y(y) - 2.6}h5.2v5.2h-5.2z`;
      o.push(`<path class="pins" d="${pp}"/>`);
      const cx = (p.box[0] + p.box[2]) / 2, cy = (p.box[1] + p.box[3]) / 2;
      // mic labels sit outside the board edge so they clear the sound port
      const ty = p.kind === "mic" ? (cy < W / 2 ? Y(p.box[1]) - 9 : Y(p.box[3]) + 20) : p.stand ? Y(p.box[3]) + 18 : Y(cy) + 5;
      o.push(`<text x="${X(cx)}" y="${ty}" text-anchor="middle">${p.kind === "esp" ? "ESP32-S3" : p.name}</text></g>`);
    }
    svgHost.innerHTML = `<svg viewBox="0 0 ${(x1 - x0) * K} ${(y1 - y0) * K}" role="img" aria-label="${BUILDS[build].name}, top view to scale">${o.join("")}</svg>`;
    svgHost.querySelectorAll("[data-id]").forEach(g => {
      g.addEventListener("pointerenter", () => show(g.dataset.id));
      g.addEventListener("pointerleave", () => show(null));
    });
  }

  // ---- 3D
  let view = null;
  try { view = make3d(glHost, reduce, id => show(id)); } catch (e) { glHost.classList.add("off"); }

  const select = b => {
    build = b;
    tabs.forEach(t => t.setAttribute("aria-selected", t.dataset.b === b));
    draw2d(); view && view.load(Object.assign([...BUILDS[b].parts], { wires: BUILDS[b].wires })); show(null);
  };
  tabs.forEach(t => t.addEventListener("click", () => select(t.dataset.b)));
  document.addEventListener("click", e => { const a = e.target.closest("[data-board]"); if (a) select(a.dataset.board); });
  select("node");
}

function make3d(host, reduce, onHover) {
  const canvas = document.createElement("canvas");
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 1, 2000);
  const rig = new THREE.Group(); scene.add(rig);   // turns
  const model = new THREE.Group(); rig.add(model); // board, centred

  const CY = 0x7fd4ff, HOT = 0xffb547;
  const lineMat = c => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
  const faceMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // floor: rings and ticks
  const floor = new THREE.Group(); scene.add(floor);
  for (const rad of [70, 105, 140]) {
    const g = new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, rad, 0, Math.PI * 2).getPoints(160));
    const l = new THREE.LineLoop(g, lineMat(CY)); l.material.opacity = rad === 105 ? .35 : .18; l.rotation.x = -Math.PI / 2; floor.add(l);
  }
  const tk = []; for (let a = 0; a < 360; a += 5) { const t = a * Math.PI / 180, r0 = a % 30 ? 136 : 130; tk.push(new THREE.Vector3(Math.cos(t) * r0, 0, Math.sin(t) * r0), new THREE.Vector3(Math.cos(t) * 140, 0, Math.sin(t) * 140)); }
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tk), lineMat(CY)); ticks.material.opacity = .3; floor.add(ticks);
  floor.position.y = -22;
  const sweep = new THREE.Mesh(new THREE.RingGeometry(104, 141, 64, 1, 0, .35), faceMat(CY, .05)); sweep.rotation.x = -Math.PI / 2; floor.add(sweep);

  const groups = new Map(); // id -> {lines:[], faces:[]}
  const pickables = [];
  // board coords (x along, y across, z up) -> three (x, y up, z)
  function box(id, b, z0, h, opts = {}) {
    const [x0, y0, x1, y1] = b, w = x1 - x0, d = y1 - y0;
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, faceMat(CY, opts.face ?? .06));
    m.position.set(x0 + w / 2, z0 + h / 2, y0 + d / 2);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(CY));
    e.material.opacity = opts.line ?? .85; e.position.copy(m.position);
    model.add(m, e);
    const g = groups.get(id) || { lines: [], faces: [] }; g.lines.push(e); g.faces.push(m); groups.set(id, g);
    m.userData.id = id; pickables.push(m);
    return m;
  }
  function points(id, pts, z, size, op = .9) {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, z, y)));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: CY, size, sizeAttenuation: true, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    model.add(p); const gr = groups.get(id) || { lines: [], faces: [] }; gr.lines.push(p); groups.set(id, gr);
  }

  function load(parts) {
    model.clear(); groups.clear(); pickables.length = 0;
    box("bb", [0, 0, L, W], -BB_H, BB_H, { face: .035, line: .55 });
    const holes = []; for (let k = 1; k <= 63; k++) for (const c in COL) holes.push([rowx(k), COL[c]]);
    for (const y of RAIL) for (let g = 0; g < 10; g++) for (let j = 0; j < 5; j++) holes.push([rowx(2) + (g * 6 + j) * P, y]);
    points("bb", holes, 0.05, 0.9, .45);
    for (const w of (parts.wires || [])) {
      const rd = parts.find(p => p.kind === "radar"), [tx, ty] = rd.pins[w.to], lane = 4 + 1.6 * w.to, z = 1.2 + w.to * .6;
      const pts = [[w.from[0], 0, w.from[1]], [w.from[0], z, w.from[1]], [w.from[0], z, -lane], [L + 4 + w.to * 1.5, z, -lane],
                   [L + 4 + w.to * 1.5, z, ty], [tx, 6, ty]].map(([x, y, zz]) => new THREE.Vector3(x, y, zz));
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(w.cls === "w5" ? 0xff8a7a : w.cls === "wg" ? 0x9aa3ad : 0x6fb6ff));
      model.add(l);
    }
    for (const p of parts) {
      if (p.stand) {  // PCB on edge, antenna face outward
        box(p.id, p.box, 0, p.stand, { face: .12 });
        box(p.id, [p.box[2], p.box[1] + 2, p.box[2] + .6, p.box[3] - 2], 3, p.stand - 6, { face: .2 });
        points(p.id, p.pins, 6, 1.3);
        continue;
      }
      const zp = HDR; // PCB sits on the header plastic
      box(p.id, p.box, zp, PCB, { face: .09 });
      if (p.module) box(p.id, p.module, zp + PCB, p.kind === "esp" ? 3.1 : 2.0, { face: .12 });
      if (p.antenna) box(p.id, p.antenna, zp + PCB, .8, { face: .05, line: .5 });
      if (p.usb) p.usb.forEach(u => box(p.id, u, zp + PCB, 3.2, { face: .1 }));
      if (p.port) box(p.id, [p.port[0] - 1.75, p.port[1] - 1.3, p.port[0] + 1.75, p.port[1] + 1.3], zp + PCB, 1.0, { face: .2 });
      // header strips and pins
      points(p.id, p.pins, zp + PCB + 1.4, 1.3);
      for (const [x, y] of p.pins) box(p.id, [x - 1.27, y - 1.27, x + 1.27, y + 1.27], 0, HDR, { face: .03, line: .25 });
      if (p.ant) {
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p.ant[0], zp + PCB + .5, p.ant[1]), new THREE.Vector3(p.ant[0] - 78, zp + PCB + .5, p.ant[1])]);
        const l = new THREE.Line(g, lineMat(CY)); model.add(l); groups.get(p.id).lines.push(l);
      }
    }
    // centre on the parts' footprint
    // centre from the part outlines (board coords), independent of the current rotation
    let x0 = 0, y0 = 0, x1 = L, y1 = W;
    for (const p of parts) {
      x0 = Math.min(x0, p.box[0], p.ant ? p.ant[0] - 78 : Infinity); y0 = Math.min(y0, p.box[1]);
      x1 = Math.max(x1, p.box[2]); y1 = Math.max(y1, p.box[3]);
    }
    model.position.set(-(x0 + x1) / 2, 0, -(y0 + y1) / 2);
    const s = { x: x1 - x0, z: y1 - y0 }; dist = Math.hypot(s.x, s.z) * 1.4; floor.scale.setScalar(Math.max(s.x, s.z) / 230);
    highlight(null);
  }

  function highlight(id) {
    for (const [gid, g] of groups) {
      const on = gid === id;
      g.lines.forEach(l => l.material.color.setHex(on ? HOT : CY));
      g.faces.forEach(f => f.material.color.setHex(on ? HOT : CY));
    }
  }

  // drag to turn, otherwise slow auto-rotate
  let dist = 300, yaw = -0.6, pitch = 0.62, vYaw = reduce ? 0 : 0.0035, drag = null, idle = 0;
  canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", () => { drag = null; idle = performance.now(); });
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let lastHit = null;
  canvas.addEventListener("pointermove", e => {
    if (drag) { yaw = drag.yaw + (e.clientX - drag.x) * 0.008; pitch = Math.max(0.12, Math.min(1.35, drag.pitch + (e.clientY - drag.y) * 0.006)); return; }
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const hits = ray.intersectObjects(pickables).filter(h => h.object.userData.id !== "bb");
    const id = hits.length ? hits[0].object.userData.id : null;
    if (id !== lastHit) { lastHit = id; onHover(id); }
  });
  canvas.addEventListener("pointerleave", () => { if (lastHit) { lastHit = null; onHover(null); } });

  const hud = host.querySelector(".bd-hud");
  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(host); size();

  let live = false, t0 = performance.now();
  new IntersectionObserver(([e]) => { live = e.isIntersecting; if (live) requestAnimationFrame(frame); }).observe(host);
  function frame(now) {
    if (!live) return;
    const dt = now - t0; t0 = now;
    if (!drag && now - idle > 1500) yaw += vYaw * dt / 16;
    rig.rotation.y = yaw;
    rig.position.y = reduce ? 0 : Math.sin(now / 1400) * 1.5;
    sweep.rotation.z = -now / 2600;
    cam.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, -4, 0);
    if (hud) hud.textContent = `AZ ${String(Math.round(((yaw * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, "0")}°  EL ${String(Math.round(pitch * 180 / Math.PI)).padStart(2, "0")}°`;
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  return { load, highlight };
}
