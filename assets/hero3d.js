// Hero: 3D view of one defended building, full layout. 8 listening nodes (every corner,
// street level and roof), the base receiver on the roof, and 4 radars on the roof edges
// facing out (±60° each, 360° together). A drone circles the building, climbing and
// descending and swinging out past radar range; radars hold it inside their range, the
// nodes in range keep reporting (one LoRa report per node every 0.5 s, radar at 5 Hz),
// all to the roof receiver. The track estimate follows the fused sources.
import * as THREE from "three";

const host = document.querySelector(".hero");
const fallback = host && host.querySelector('canvas[data-fx="field"]');
if (host) {
  try { start(); if (fallback) fallback.style.display = "none"; } catch (e) { /* keep the 2D canvas */ }
}

function start() {
  const C = { holo: 0x7fd4ff, amber: 0xffb547, radar: 0x7fb2ff, net: 0x6fd3a8, white: 0xe8f6ff, grey: 0x8b9096 };
  const BLD = { x0: -20, x1: 20, y0: -15, y1: 15, h: 14 };
  const ROOF = BLD.h + 1.6;
  const NODES = [[-20, -15], [20, -15], [20, 15], [-20, 15]].flatMap(([x, y]) => [[x, y, 1.6], [x, y, ROOF]]);
  const RZ = BLD.h + 1.2, RANGE = 38, HALF = Math.PI / 3;
  const RADARS = [[20, 0, 0], [0, 15, Math.PI / 2], [-20, 0, Math.PI], [0, -15, -Math.PI / 2]]
    .map(([x, y, yaw]) => ({ x, y, z: RZ, yaw, last: -1 }));
  const BASE = { x: 0, y: 0, z: BLD.h + 1 };
  const HEAR = 40, LAP = 30; // s per lap
  const alt = t => 10 + 7 * Math.sin(t / LAP * Math.PI * 4); // 3 to 17: below and above the roof
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "bg hero3d"; canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0016);
  const cam = new THREE.PerspectiveCamera(34, 1, 1, 3000);
  const world = new THREE.Group(); scene.add(world);
  // board coords (x east, y south) -> three (x, up, z)
  const V = (x, y, z = 0) => new THREE.Vector3(x, z, y);
  const add = o => (world.add(o), o);
  const lmat = (c, o = .85) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const fmat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const line = (pts, c, o) => add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat(c, o)));

  // ground grid
  const g = [];
  for (let k = -120; k <= 120; k += 10) { g.push(V(k, -90), V(k, 90)); if (Math.abs(k) <= 90) g.push(V(-120, k), V(120, k)); }
  add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(g), lmat(C.holo, .12)));
  // range rings around the building
  for (const r of [30, 60, 90]) line(new THREE.Path().absarc(0, 0, r, 0, Math.PI * 2).getPoints(180).map(p => V(p.x, p.y)), C.holo, r === 60 ? .3 : .16);

  // building: wireframe with faint faces and floor lines
  const bg = new THREE.BoxGeometry(BLD.x1 - BLD.x0, BLD.h, BLD.y1 - BLD.y0);
  const bm = add(new THREE.Mesh(bg, fmat(C.holo, .08))); bm.position.set(0, BLD.h / 2, 0);
  const be = add(new THREE.LineSegments(new THREE.EdgesGeometry(bg), lmat(C.holo, .9))); be.position.copy(bm.position);
  for (let z = 3.5; z < BLD.h; z += 3.5) line([V(BLD.x0, BLD.y0, z), V(BLD.x1, BLD.y0, z), V(BLD.x1, BLD.y1, z), V(BLD.x0, BLD.y1, z), V(BLD.x0, BLD.y0, z)], C.holo, .22);

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

  // drone, radar beam, track
  const drone = add(new THREE.Group());
  const arm = new THREE.BufferGeometry().setFromPoints([V(-1.4, -1.4), V(1.4, 1.4), V(-1.4, 1.4), V(1.4, -1.4)]);
  drone.add(new THREE.LineSegments(arm, lmat(C.white, 1)));
  for (const [x, y] of [[-1.4, -1.4], [1.4, 1.4], [-1.4, 1.4], [1.4, -1.4]]) {
    const r = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, .8, 0, Math.PI * 2).getPoints(20).map(p => V(p.x + x, p.y + y))), lmat(C.white, .8)); drone.add(r);
  }
  const drop = line([V(0, 0, 0), V(0, 0, 1)], C.white, .25);
  const ell = add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, 1, 0, Math.PI * 2).getPoints(48).map(p => V(p.x, p.y))), lmat(C.amber, .9)));
  const TRAIL = 220, trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
  add(new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })));
  let trailN = 0;
  // label: the simulation's track id
  const lc = document.createElement("canvas"); lc.width = 256; lc.height = 64;
  const lx = lc.getContext("2d"); lx.font = "500 34px IBM Plex Mono, monospace"; lx.fillStyle = "#ffcf85"; lx.fillText("TRK-01", 8, 44);
  const label = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true, depthWrite: false })));
  label.scale.set(18, 4.5, 1);

  // packets and pulses
  const pulses = [], packets = [];
  const pktGeo = new THREE.SphereGeometry(.9, 10, 8);
  function pulse(x, y, z, col, r1, life) {
    const m = add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, 1, 0, Math.PI * 2).getPoints(40).map(p => V(p.x, p.y))), lmat(col, .8)));
    m.position.copy(V(x, y, z)); pulses.push({ m, r1, life, t0: now });
  }
  function packet(ax, ay, az, bx, by, col, dur, lift = 6) {
    const m = add(new THREE.Mesh(pktGeo, fmat(col, 1)));
    packets.push({ m, a: V(ax, ay, az), b: V(bx, by, BASE.z + 4), lift, dur, t0: now });
  }

  const radarSees = (r, x, y) => {
    const dx = x - r.x, dy = y - r.y;
    if (Math.hypot(dx, dy) > RANGE) return false;
    const a = Math.atan2(dy, dx) - r.yaw;
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= HALF; // on the roof facing out: the building does not block it
  };
  const path = t => { const a = t / LAP * Math.PI * 2, r = 46 + 12 * Math.sin(a * 2 + .6); return { x: Math.cos(a) * r * 1.1, y: Math.sin(a) * r * .85 }; };

  let now = 0, est = null, vel = { x: 0, y: 0 }, lastSeenT = -99, prevD = null;
  function sim(t, dt) {
    const ALT = alt(t), d = path(t), seeing = RADARS.filter(r => radarSees(r, d.x, d.y)), seen = seeing.length > 0;
    const hearing = nodes.filter(n => Math.hypot(n.x - d.x, n.y - d.y, n.z - ALT) < HEAR);
    drone.position.copy(V(d.x, d.y, ALT)); drone.rotation.y = t * 6;
    drop.geometry.setFromPoints([V(d.x, d.y, 0), V(d.x, d.y, ALT)]);
    // radar at 5 Hz
    for (const r of RADARS) {
      const on = seeing.includes(r);
      r.beam.visible = on; r.fan.material.opacity = on ? .1 : .035;
      if (on) r.beam.geometry.setFromPoints([V(r.x, r.y, r.z), V(d.x, d.y, ALT)]);
      if (on && t - r.last >= 0.2) { r.last = t; packet(r.x, r.y, r.z, BASE.x, BASE.y, C.radar, .5, 2); }
    }
    // each hearing node reports every 0.5 s over LoRa
    for (const n of hearing) if (t - n.last >= 0.5) { n.last = t + Math.random() * 0.05; pulse(n.x, n.y, n.z, C.amber, 7, .9); packet(n.x, n.y, n.z, BASE.x, BASE.y, C.amber, 1.0); }
    nodes.forEach(n => n.m.material.opacity = hearing.includes(n) ? 1 : .35);
    // track estimate: radar position when seen, acoustic estimate otherwise, coast with no data
    const acoustic = hearing.length >= 2;
    let tgt, sigma, col;
    if (seen) { tgt = d; sigma = acoustic ? 1.6 : 2.2; col = acoustic ? C.white : C.radar; lastSeenT = t; }
    else if (acoustic) {
      let wx = 0, wy = 0, ws = 0;
      for (const n of hearing) { const w = 1 / Math.max(4, Math.hypot(n.x - d.x, n.y - d.y)) ** 2; wx += n.x * w; wy += n.y * w; ws += w; }
      tgt = { x: d.x * .85 + wx / ws * .15, y: d.y * .85 + wy / ws * .15 }; sigma = 4.5; col = C.amber;
    } else { const e = est || d; tgt = { x: e.x + vel.x * dt, y: e.y + vel.y * dt }; sigma = Math.min(12, 3 + (t - lastSeenT) * 2); col = C.grey; }
    if (!est) est = { ...tgt };
    const k = Math.min(1, dt * 5);
    const nx = est.x + (tgt.x - est.x) * k, ny = est.y + (tgt.y - est.y) * k;
    if (dt > 0) vel = { x: (nx - est.x) / dt, y: (ny - est.y) / dt };
    est = { x: nx, y: ny };
    ell.position.copy(V(est.x, est.y, ALT)); ell.scale.setScalar(sigma); ell.material.color.setHex(col === C.white ? C.amber : col);
    label.position.copy(V(est.x + 7, est.y, ALT + 4));
    // trail
    if (!prevD || Math.hypot(prevD.x - est.x, prevD.y - est.y) > .6) {
      prevD = { ...est };
      trailPos.copyWithin(3, 0, (TRAIL - 1) * 3); trailCol.copyWithin(3, 0, (TRAIL - 1) * 3);
      const c3 = new THREE.Color(col);
      trailPos.set([est.x, ALT, est.y], 0); trailCol.set([c3.r, c3.g, c3.b], 0);
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
  // warm up so the trail and track exist on first paint
  for (let i = 0; i < 240; i++) { now = i / 30; sim(now, 1 / 30); animate(now); }
  function frame(ms) {
    if (!live) return;
    const dt = Math.min(.05, (ms - last) / 1000); last = ms;
    if (!reduce) { now += dt; sim(now, dt); animate(now); }
    const a = reduce ? -0.7 : -0.7 + now * 0.035;
    const R = innerWidth < 700 ? 300 : 235;
    cam.position.set(Math.sin(a) * R, R * 0.62, Math.cos(a) * R); cam.lookAt(6, 6, 0);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
