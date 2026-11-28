// Hero: 3D view of one defended building in a city block, full layout. 8 listening
// nodes (every corner, street level and roof), the base receiver on the roof, 4 radars on
// the roof edges facing out (±60° each), a compound wall, and the surrounding blocks.
//
// Each episode the target drone flies a new random route: in along one street, irregular
// surveillance loops around the building at changing height, a drop behind the compound
// wall, then a low escape out along a different street. Radar sees it only inside a fan,
// within range, within the beam's elevation and with a clear line (buildings and the wall
// block it). Nodes in range report every 0.5 s over LoRa, radar at 5 Hz, all to the roof
// receiver. The track follows whichever sources hold it, coasts without data, and is
// dropped after 6 s of coasting.
import * as THREE from "three";

const host = document.querySelector(".hero");
const fallback = host && host.querySelector('canvas[data-fx="field"]');
if (host) {
  try { start(); if (fallback) fallback.style.display = "none"; } catch (e) { /* keep the 2D canvas */ }
}

function start() {
  const C = { holo: 0x7fd4ff, amber: 0xffb547, radar: 0x7fb2ff, white: 0xe8f6ff, grey: 0x8b9096, red: 0xff7a5c };
  const BLD = { x0: -20, x1: 20, y0: -15, y1: 15, h: 14 };
  const WALL = { x0: -45, x1: 45, y0: -35, y1: 35, h: 2.6 };
  const ROOF = BLD.h + 1.6;
  const NODES = [[-20, -15], [20, -15], [20, 15], [-20, 15]].flatMap(([x, y]) => [[x, y, 1.6], [x, y, ROOF]]);
  const RZ = BLD.h + 1.2, RANGE = 38, HALF = Math.PI / 3, EL = Math.PI / 6; // ±30° elevation beam
  const RADARS = [[20, 0, 0], [0, 15, Math.PI / 2], [-20, 0, Math.PI], [0, -15, -Math.PI / 2]]
    .map(([x, y, yaw]) => ({ x, y, z: RZ, yaw, last: -1 }));
  const BASE = { x: 0, y: 0, z: BLD.h + 1 };
  const HEAR = 40, SPEED = 11, DROP_S = 6;
  // surrounding blocks [x0, y0, x1, y1, h]; the gaps between them are the streets
  const BLOCKS = [[-130, -110, -60, -50, 24], [-50, -110, -12, -50, 30], [12, -110, 50, -50, 20], [70, -110, 130, -50, 28],
    [-130, -40, -60, 40, 18], [70, -40, 130, 40, 22],
    [-130, 50, -60, 110, 26], [-50, 50, -12, 110, 16], [12, 50, 50, 110, 32], [70, 50, 130, 110, 20]];
  // street canyons: far end (outside the area) and mouth (at the compound)
  const STREETS = [{ far: [0, -170], mouth: [0, -46] }, { far: [0, 170], mouth: [0, 46] },
    { far: [-170, -45], mouth: [-55, -45] }, { far: [170, -45], mouth: [60, -45] },
    { far: [-170, 45], mouth: [-55, 45] }, { far: [170, 45], mouth: [60, 45] },
    { far: [60, -170], mouth: [60, -45] }, { far: [-55, 170], mouth: [-55, 45] }];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "bg hero3d"; canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0019);
  const cam = new THREE.PerspectiveCamera(34, 1, 1, 3000);
  const world = new THREE.Group(); scene.add(world);
  // board coords (x east, y south) -> three (x, up, z)
  const V = (x, y, z = 0) => new THREE.Vector3(x, z, y);
  const add = o => (world.add(o), o);
  const lmat = (c, o = .85) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const fmat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const line = (pts, c, o) => add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat(c, o)));
  const box = (x0, y0, x1, y1, h, c, eo, fo) => {
    const g = new THREE.BoxGeometry(x1 - x0, h, y1 - y0);
    const e = add(new THREE.LineSegments(new THREE.EdgesGeometry(g), lmat(c, eo))); e.position.set((x0 + x1) / 2, h / 2, (y0 + y1) / 2);
    if (fo) add(new THREE.Mesh(g, fmat(c, fo))).position.copy(e.position);
  };

  // ground grid
  const g = [];
  for (let k = -140; k <= 140; k += 10) { g.push(V(k, -120), V(k, 120)); if (Math.abs(k) <= 120) g.push(V(-140, k), V(140, k)); }
  add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(g), lmat(C.holo, .1)));

  // city blocks, compound wall (gate on the south side), defended building
  for (const [x0, y0, x1, y1, h] of BLOCKS) box(x0, y0, x1, y1, h, C.holo, .2, .015);
  const WALLS = [[WALL.x0, WALL.y0, WALL.x1, WALL.y0], [WALL.x1, WALL.y0, WALL.x1, WALL.y1], [WALL.x0, WALL.y0, WALL.x0, WALL.y1],
    [WALL.x0, WALL.y1, -6, WALL.y1], [6, WALL.y1, WALL.x1, WALL.y1]]
    .map(([x0, y0, x1, y1]) => [Math.min(x0, x1) - .3, Math.min(y0, y1) - .3, Math.max(x0, x1) + .3, Math.max(y0, y1) + .3, WALL.h]);
  for (const w of WALLS) box(...w, C.holo, .5, .05);
  box(BLD.x0, BLD.y0, BLD.x1, BLD.y1, BLD.h, C.holo, .9, .08);
  for (let z = 3.5; z < BLD.h; z += 3.5) line([V(BLD.x0, BLD.y0, z), V(BLD.x1, BLD.y0, z), V(BLD.x1, BLD.y1, z), V(BLD.x0, BLD.y1, z), V(BLD.x0, BLD.y0, z)], C.holo, .22);
  const OBST = [...BLOCKS, ...WALLS];

  // acoustic nodes
  const nodes = NODES.map(([x, y, z]) => {
    const m = add(new THREE.Mesh(new THREE.OctahedronGeometry(1.6), fmat(C.amber, .9))); m.position.copy(V(x, y, z));
    line([V(x, y, z - 1.6), V(x, y, z)], C.amber, .6);
    return { x, y, z, m, last: -1 };
  });

  // radars on the roof edges, each with its ±60° coverage fan at roof height
  for (const r of RADARS) {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 3.4), fmat(C.radar, .8)));
    m.position.copy(V(r.x - Math.cos(r.yaw) * 1.2, r.y - Math.sin(r.yaw) * 1.2, r.z)); m.rotation.y = -r.yaw;
    const arc = Array.from({ length: 41 }, (_, i) => { const a = r.yaw - HALF + (2 * HALF) * i / 40; return V(r.x + Math.cos(a) * RANGE, r.y + Math.sin(a) * RANGE, r.z); });
    const apex = V(r.x, r.y, r.z), tri = [];
    for (let i = 0; i < 40; i++) tri.push(apex, arc[i], arc[i + 1]);
    r.fan = add(new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(tri), fmat(C.radar, .05)));
    line([apex, ...arc, apex], C.radar, .4);
    r.beam = line([V(0, 0), V(1, 1)], C.radar, .9);
  }
  // base receiver on the roof
  const rx = new THREE.BoxGeometry(4, 1.6, 3);
  const re = add(new THREE.LineSegments(new THREE.EdgesGeometry(rx), lmat(C.white, .8))); re.position.copy(V(BASE.x, BASE.y, BLD.h + .8));
  add(new THREE.Mesh(rx, fmat(C.white, .12))).position.copy(re.position);
  line([V(BASE.x, BASE.y, BLD.h + 1.6), V(BASE.x, BASE.y, BLD.h + 5)], C.white, .7);

  // drone, track
  const drone = add(new THREE.Group());
  drone.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-1.4, -1.4), V(1.4, 1.4), V(-1.4, 1.4), V(1.4, -1.4)]), lmat(C.white, 1)));
  for (const [x, y] of [[-1.4, -1.4], [1.4, 1.4], [-1.4, 1.4], [1.4, -1.4]])
    drone.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, .8, 0, Math.PI * 2).getPoints(20).map(p => V(p.x + x, p.y + y))), lmat(C.white, .8)));
  const drop = line([V(0, 0, 0), V(0, 0, 1)], C.white, .25);
  const ell = add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, 1, 0, Math.PI * 2).getPoints(48).map(p => V(p.x, p.y))), lmat(C.amber, .9)));
  const TRAIL = 400, trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  add(new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })));
  let trailN = 0;
  // label: track id and the sources holding it
  const lc = document.createElement("canvas"); lc.width = 640; lc.height = 64;
  const lx = lc.getContext("2d"), tex = new THREE.CanvasTexture(lc);
  const label = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })));
  label.scale.set(40, 4, 1); label.center.set(0, .5);
  let labelText = "";
  const setLabel = (text, css) => {
    if (text === labelText) return; labelText = text;
    lx.clearRect(0, 0, lc.width, lc.height); lx.font = "500 34px IBM Plex Mono, monospace"; lx.fillStyle = css; lx.fillText(text, 8, 44);
    tex.needsUpdate = true;
  };

  // packets and pulses
  const pulses = [], packets = [];
  const pktGeo = new THREE.SphereGeometry(.9, 10, 8);
  let now = 0;
  function pulse(x, y, z, col, r1, life) {
    const m = add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, 1, 0, Math.PI * 2).getPoints(40).map(p => V(p.x, p.y))), lmat(col, .8)));
    m.position.copy(V(x, y, z)); pulses.push({ m, r1, life, t0: now });
  }
  function packet(ax, ay, az, col, dur, lift = 6) {
    const m = add(new THREE.Mesh(pktGeo, fmat(col, 1)));
    packets.push({ m, a: V(ax, ay, az), b: V(BASE.x, BASE.y, BASE.z + 4), lift, dur, t0: now });
  }

  // line of sight: segment a-b against box obstacles (slab test)
  const clear = (a, b) => {
    for (const [x0, y0, x1, y1, h] of OBST) {
      let t0 = 0, t1 = 1, hit = true;
      for (const [p, lo, hi] of [[0, x0, x1], [1, y0, y1], [2, 0, h]]) {
        const d = b[p] - a[p];
        if (Math.abs(d) < 1e-9) { if (a[p] < lo || a[p] > hi) { hit = false; break; } continue; }
        let u = (lo - a[p]) / d, v = (hi - a[p]) / d; if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) { hit = false; break; }
      }
      if (hit) return false;
    }
    return true;
  };
  const radarSees = (r, d) => {
    const dx = d.x - r.x, dy = d.y - r.y, h = Math.hypot(dx, dy);
    if (h > RANGE || h < 1) return false;
    const a = Math.atan2(dy, dx) - r.yaw;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > HALF) return false;
    if (Math.abs(Math.atan2(d.z - r.z, h)) > EL) return false; // under (or over) the beam
    return clear([r.x + Math.cos(r.yaw) * 1.5, r.y + Math.sin(r.yaw) * 1.5, r.z], [d.x, d.y, d.z]);
  };

  // one episode: in along a street, surveil, duck behind the wall, escape along another street
  const R = (a, b) => a + Math.random() * (b - a);
  let route, routeLen, s, ending;
  function episode() {
    const inS = STREETS[Math.floor(Math.random() * STREETS.length)];
    let outS; do outS = STREETS[Math.floor(Math.random() * STREETS.length)]; while (outS === inS);
    const P = [[...inS.far, R(18, 28)], [...inS.mouth, R(14, 22)]];
    const dir = Math.random() < .5 ? 1 : -1;
    let a = Math.atan2(inS.mouth[1], inS.mouth[0]);
    const loops = Math.round(R(8, 14));
    for (let i = 0; i < loops; i++) { a += dir * R(.45, .9); const r = R(.8, 1.05); P.push([Math.cos(a) * 42 * r, Math.sin(a) * 32 * r, R(6, 22)]); }
    // duck: drop inside the wall and creep along it
    for (let i = 0; i < 4; i++) { a += dir * R(.25, .45); P.push([Math.cos(a) * 39, Math.sin(a) * 29.5, i === 0 ? 5 : R(1.2, 2)]); }
    // stay low inside the wall around to the exit street's side, then out
    const aOut = Math.atan2(outS.mouth[1], outS.mouth[0]);
    let da = Math.atan2(Math.sin(aOut - a), Math.cos(aOut - a));
    const steps = Math.ceil(Math.abs(da) / .5);
    for (let i = 1; i <= steps; i++) { const b = a + da * i / steps; P.push([Math.cos(b) * 39, Math.sin(b) * 29.5, R(1.5, 3)]); }
    P[P.length - 1][2] = 4; // hop the wall
    P.push([...outS.mouth, R(5, 7)], [...outS.far, R(5, 9)]);
    route = new THREE.CatmullRomCurve3(P.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal", .4);
    routeLen = route.getLength(); s = 0; ending = -1;
    est = null; vel = { x: 0, y: 0 }; lastSeenT = -99; prevD = null; trailN = 0; trailGeo.setDrawRange(0, 0);
  }

  let est = null, vel = { x: 0, y: 0 }, lastSeenT = -99, prevD = null;
  episode();
  function sim(t, dt) {
    s = Math.min(routeLen, s + SPEED * dt);
    const q = route.getPointAt(s / routeLen), d = { x: q.x, y: q.y, z: q.z };
    if (s >= routeLen) { if (ending < 0) ending = t; if (t - ending > 3) episode(); }
    const seeing = RADARS.filter(r => radarSees(r, d)), seen = seeing.length > 0;
    const hearing = nodes.filter(n => Math.hypot(n.x - d.x, n.y - d.y, n.z - d.z) < HEAR);
    const ahead = route.getPointAt(Math.min(1, (s + 2) / routeLen));
    drone.position.copy(V(d.x, d.y, d.z)); drone.rotation.y = Math.atan2(ahead.x - q.x, ahead.y - q.y);
    drop.geometry.setFromPoints([V(d.x, d.y, 0), V(d.x, d.y, d.z)]);
    // radar at 5 Hz
    for (const r of RADARS) {
      const on = seeing.includes(r);
      r.beam.visible = on; r.fan.material.opacity = on ? .1 : .035;
      if (on) r.beam.geometry.setFromPoints([V(r.x, r.y, r.z), V(d.x, d.y, d.z)]);
      if (on && t - r.last >= 0.2) { r.last = t; packet(r.x, r.y, r.z, C.radar, .5, 2); }
    }
    // each hearing node reports every 0.5 s over LoRa
    for (const n of hearing) if (t - n.last >= 0.5) { n.last = t + Math.random() * 0.05; pulse(n.x, n.y, n.z, C.amber, 6, .9); packet(n.x, n.y, n.z, C.amber, 1.0); }
    nodes.forEach(n => n.m.material.opacity = hearing.includes(n) ? 1 : .35);
    // track: radar position when seen, acoustic estimate otherwise, coast with no data, drop after DROP_S
    const acoustic = hearing.length >= 2;
    let tgt, sigma, col, src;
    if (seen) { tgt = d; sigma = acoustic ? 1.6 : 2.2; col = C.radar; src = acoustic ? "RADAR + ACOUSTIC" : "RADAR"; lastSeenT = t; }
    else if (acoustic) {
      let wx = 0, wy = 0, ws = 0;
      for (const n of hearing) { const w = 1 / Math.max(4, Math.hypot(n.x - d.x, n.y - d.y)) ** 2; wx += n.x * w; wy += n.y * w; ws += w; }
      tgt = { x: d.x * .85 + wx / ws * .15, y: d.y * .85 + wy / ws * .15, z: d.z }; sigma = 4.5; col = C.amber; src = "ACOUSTIC"; lastSeenT = t;
    } else if (est) { tgt = { x: est.x + vel.x * dt, y: est.y + vel.y * dt, z: est.z }; sigma = Math.min(14, 3 + (t - lastSeenT) * 2); col = C.grey; src = "COAST"; }
    if (!tgt) { ell.visible = label.visible = false; return; } // not detected yet
    if (src === "COAST" && t - lastSeenT > DROP_S) { ell.visible = false; label.visible = true; setLabel("TRK-01 · DROPPED", "#ff9c85"); return; }
    ell.visible = label.visible = true;
    if (!est) est = { ...tgt };
    const k = Math.min(1, dt * 5);
    const nx = est.x + (tgt.x - est.x) * k, ny = est.y + (tgt.y - est.y) * k, nz = est.z + (tgt.z - est.z) * k;
    if (dt > 0 && src !== "COAST") vel = { x: (nx - est.x) / dt, y: (ny - est.y) / dt };
    est = { x: nx, y: ny, z: nz };
    ell.position.copy(V(est.x, est.y, est.z)); ell.scale.setScalar(sigma); ell.material.color.setHex(col);
    label.position.copy(V(est.x + 4, est.y, est.z + 5));
    setLabel(`TRK-01 · ${src}`, col === C.radar ? "#a9ccff" : col === C.amber ? "#ffcf85" : "#b9bec5");
    // trail
    if (!prevD || Math.hypot(prevD.x - est.x, prevD.y - est.y, prevD.z - est.z) > .8) {
      prevD = { ...est };
      trailPos.copyWithin(3, 0, (TRAIL - 1) * 3); trailCol.copyWithin(3, 0, (TRAIL - 1) * 3);
      const c3 = new THREE.Color(col);
      trailPos.set([est.x, est.z, est.y], 0); trailCol.set([c3.r, c3.g, c3.b], 0);
      trailN = Math.min(TRAIL, trailN + 1);
      trailGeo.setDrawRange(0, trailN); trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
    }
  }

  function animate(t) {
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i], f = (t - p.t0) / p.life;
      if (f >= 1) { world.remove(p.m); p.m.geometry.dispose(); pulses.splice(i, 1); continue; }
      p.m.scale.setScalar(1 + f * p.r1); p.m.material.opacity = .8 * (1 - f);
    }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i], f = (t - p.t0) / p.dur;
      if (f >= 1) { world.remove(p.m); packets.splice(i, 1); continue; }
      p.m.position.lerpVectors(p.a, p.b, f); p.m.position.y += Math.sin(f * Math.PI) * p.lift;
    }
  }

  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    // wide screens: scene sits right of the heading
    if (w > 900) cam.setViewOffset(w, h, -w * 0.23, h * 0.04, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(host); size();

  let live = true, last = performance.now();
  new IntersectionObserver(([e]) => { live = e.isIntersecting; if (live) { last = performance.now(); requestAnimationFrame(frame); } }).observe(host);
  // warm up: start with the drone already inbound along its street
  for (let i = 0; i < 300; i++) { now = i / 30; sim(now, 1 / 30); animate(now); }
  function frame(ms) {
    if (!live) return;
    const dt = Math.min(.05, (ms - last) / 1000); last = ms;
    if (!reduce) { now += dt; sim(now, dt); animate(now); }
    const a = reduce ? -0.7 : -0.7 + now * 0.03;
    const Rc = innerWidth < 700 ? 330 : 260;
    cam.position.set(Math.sin(a) * Rc, Rc * 0.6, Math.cos(a) * Rc); cam.lookAt(6, 6, 0);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
