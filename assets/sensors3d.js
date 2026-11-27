// Sensor modalities: one 3D compound with every sensor at its position (same layout
// and scale as the hero and the Track and Follow simulation, metres). The view starts
// on the street outside the wall; each step flies the camera to that sensor and shows
// what it measures.
import * as THREE from "three";

const sec = document.querySelector(".sensors-pin");
const stage = sec && sec.querySelector(".stage");
const fallback = stage && stage.querySelector('canvas[data-fx]');
if (stage) { try { start(); if (fallback) fallback.style.display = "none"; } catch (e) { /* keep the 2D canvas */ } }

function start() {
  const C = { holo: 0x7fd4ff, amber: 0xffb547, radar: 0x7fb2ff, net: 0x6fd3a8, rf: 0xc58cff, white: 0xe8f6ff, red: 0xff7a5c };
  const BLD = { x0: -20, x1: 20, y0: -15, y1: 15, h: 14 };
  const WALL = { x0: -50, x1: 75, y0: -45, y1: 48, h: 2.6 };
  const NODES = [[-20, -15, "N1"], [20, -15, "N2"], [20, 15, "N3"], [-20, 15, "N4"]];
  const RADAR = { x: 50, y: 0, yaw: Math.PI, half: Math.PI / 3, range: 76 };
  const TABLE = { x: 60, y: 8 }, SDR = { x: 62, y: 10.5 };
  const OPER = { x: -28, y: 62 }; // drone operator on the street
  const HEAR = 46, ALT = 12;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "bg"; canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x000000, 0.006);
  const cam = new THREE.PerspectiveCamera(48, 1, .5, 2000);
  const V = (x, y, z = 0) => new THREE.Vector3(x, z, y);
  const lmat = (c, o = .85) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
  const fmat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const add = (o, g = scene) => (g.add(o), o);
  const line = (pts, c, o, g) => add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lmat(c, o)), g);
  const circle = (r, n = 48) => new THREE.Path().absarc(0, 0, r, 0, Math.PI * 2).getPoints(n).map(p => V(p.x, p.y));
  function wireBox(x0, y0, x1, y1, z0, h, c, lo, fo, g) {
    const geo = new THREE.BoxGeometry(x1 - x0, h, y1 - y0), pos = V((x0 + x1) / 2, (y0 + y1) / 2, z0 + h / 2);
    const e = add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lmat(c, lo)), g); e.position.copy(pos);
    if (fo) add(new THREE.Mesh(geo, fmat(c, fo)), g).position.copy(pos);
    return e;
  }
  function label(text, color, scale = 1) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96;
    const x = cv.getContext("2d"); x.font = "500 52px IBM Plex Mono, monospace"; x.fillStyle = color; x.fillText(text, 6, 66);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
    s.scale.set(.15 * scale, .028 * scale, 1); s.center.set(0, .5); scene.add(s); return s;
  }

  // ---- ground, street, wall, neighbours
  const grid = [];
  for (let k = WALL.x0; k <= WALL.x1; k += 5) grid.push(V(k, WALL.y0), V(k, WALL.y1));
  for (let k = WALL.y0; k <= WALL.y1; k += 5) grid.push(V(WALL.x0, k), V(WALL.x1, k));
  add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), lmat(C.holo, .07)));
  // street along the south wall, sidewalks, centre dashes
  const SY0 = 52, SY1 = 72;
  line([V(-160, SY0), V(180, SY0)], C.holo, .35); line([V(-160, SY1), V(180, SY1)], C.holo, .35);
  line([V(-160, SY0 - 3), V(180, SY0 - 3)], C.holo, .15); line([V(-160, SY1 + 3), V(180, SY1 + 3)], C.holo, .15);
  const dash = []; for (let x = -160; x < 180; x += 8) dash.push(V(x, (SY0 + SY1) / 2), V(x + 4, (SY0 + SY1) / 2));
  add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(dash), lmat(C.amber, .35)));
  // compound wall with a gate on the south side
  const GATE = [0, 14];
  const wallSegs = [[WALL.x0, WALL.y0, WALL.x1, WALL.y0], [WALL.x1, WALL.y0, WALL.x1, WALL.y1], [WALL.x0, WALL.y0, WALL.x0, WALL.y1],
    [WALL.x0, WALL.y1, GATE[0], WALL.y1], [GATE[1], WALL.y1, WALL.x1, WALL.y1]];
  for (const [x0, y0, x1, y1] of wallSegs) wireBox(Math.min(x0, x1) - .3, Math.min(y0, y1) - .3, Math.max(x0, x1) + .3, Math.max(y0, y1) + .3, 0, WALL.h, C.holo, .45, .05);
  // buildings across the street and beside the compound
  for (const [x0, y0, x1, y1, h] of [[-90, 78, -55, 100, 22], [-45, 80, -10, 104, 16], [5, 78, 40, 96, 26], [52, 80, 92, 110, 12], [-110, -30, -70, 20, 18], [95, -40, 130, 10, 20]])
    wireBox(x0, y0, x1, y1, 0, h, C.holo, .16, .015);

  // ---- defended building
  wireBox(BLD.x0, BLD.y0, BLD.x1, BLD.y1, 0, BLD.h, C.holo, .9, .07);
  for (let z = 3.5; z < BLD.h; z += 3.5) line([V(BLD.x0, BLD.y0, z), V(BLD.x1, BLD.y0, z), V(BLD.x1, BLD.y1, z), V(BLD.x0, BLD.y1, z), V(BLD.x0, BLD.y0, z)], C.holo, .2);

  // ---- sensors
  const nodes = NODES.map(([x, y, n]) => {
    const m = add(new THREE.Mesh(new THREE.OctahedronGeometry(1.1), fmat(C.amber, .9))); m.position.copy(V(x, y, 3));
    return { x, y, m, last: -1, lab: label(n, "#ffcf85", .8) };
  });
  nodes.forEach(n => n.lab.position.copy(V(n.x + (n.x < 0 ? -9 : 2), n.y + (n.y < 0 ? -3 : 3), 5)));
  wireBox(RADAR.x - 1, RADAR.y - 1.4, RADAR.x + 1, RADAR.y + 1.4, 0, 2.6, C.radar, 1, .25);
  const radarLab = label("RD-03D radar", "#a9ccff"); radarLab.position.copy(V(RADAR.x - 2, RADAR.y - 4, 5.5));
  wireBox(TABLE.x - 5, TABLE.y - 4, TABLE.x + 5, TABLE.y + 4, .9, .1, C.white, .6, .04);
  for (const [dx, dy] of [[-4.6, -3.6], [4.6, -3.6], [-4.6, 3.6], [4.6, 3.6]]) line([V(TABLE.x + dx, TABLE.y + dy, 0), V(TABLE.x + dx, TABLE.y + dy, .9)], C.white, .4);
  wireBox(SDR.x - .9, SDR.y - .6, SDR.x + .9, SDR.y + .6, 1, .5, C.rf, 1, .3);
  const sdrLab = label("Pluto SDR", "#dcb9ff", .8); sdrLab.position.copy(V(SDR.x + 2, SDR.y + 2, 2.6));
  const c2Lab = label("C2 table", "#e8f6ff", .8); c2Lab.position.copy(V(TABLE.x + 6, TABLE.y - 1, 2.2));

  // ---- drone
  const drone = new THREE.Group(); scene.add(drone);
  drone.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-1, -1), V(1, 1), V(-1, 1), V(1, -1)]), lmat(C.white, 1)));
  for (const [x, y] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) { const r = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(.6, 16)), lmat(C.white, .9)); r.position.copy(V(x, y)); drone.add(r); }
  const tether = line([V(0, 0), V(0, 0, 1)], C.white, .2);

  // ---- per-modality effects
  const G = [0, 1, 2, 3].map(() => add(new THREE.Group()));
  // 0 acoustic: wavefronts from the drone, nodes in range report over LoRa
  // 1 radar: coverage fan, blind zone behind the building, chirps at 5 Hz
  const arcPts = (r, a0, a1, n = 60) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return V(RADAR.x + Math.cos(a) * r, RADAR.y + Math.sin(a) * r, .06); });
  const fanArc = arcPts(RADAR.range, RADAR.yaw - RADAR.half, RADAR.yaw + RADAR.half), apex = V(RADAR.x, RADAR.y, .06), tri = [];
  for (let i = 0; i < 60; i++) tri.push(apex, fanArc[i], fanArc[i + 1]);
  add(new THREE.Mesh(new THREE.BufferGeometry().setFromPoints(tri), fmat(C.radar, .08)), G[1]);
  line([apex, ...fanArc, apex], C.radar, .7, G[1]);
  for (const r of [20, 40, 60]) line(arcPts(r, RADAR.yaw - RADAR.half, RADAR.yaw + RADAR.half), C.radar, .3, G[1]);
  { // radar shadow of the building, clipped to the fan
    const ang = ([x, y]) => Math.atan2(y - RADAR.y, x - RADAR.x);
    const cs = [[BLD.x1, BLD.y0], [BLD.x1, BLD.y1], [BLD.x0, BLD.y0], [BLD.x0, BLD.y1]].map(p => ({ p, a: (ang(p) + Math.PI * 2) % (Math.PI * 2) }));
    cs.sort((a, b) => a.a - b.a); const A = cs[0].p, B = cs[3].p;
    const ext = p => { const a = ang(p), r = RADAR.range; return [RADAR.x + Math.cos(a) * r, RADAR.y + Math.sin(a) * r]; };
    const poly = [[BLD.x0, BLD.y0].map(Number), A, ext(A), ext(B), B].slice(1);
    const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const m = add(new THREE.Mesh(new THREE.ShapeGeometry(sh), fmat(C.red, .07)), G[1]); m.rotation.x = Math.PI / 2; m.position.y = .08;
    line([...poly, poly[0]].map(([x, y]) => V(x, y, .09)), C.red, .35, G[1]);
    const lb = label("radar blind zone", "#ff9c85", .8); lb.position.copy(V(-38, -8, 2)); G[1].add(lb);
  }
  const beam = line([V(0, 0), V(1, 1)], C.radar, .9, G[1]);
  // 2 camera: the chaser drone's camera and onboard Jetson follow the target
  const fov = add(new THREE.Group(), G[2]);
  const chaser = add(new THREE.Group(), G[2]);
  chaser.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-1.3, -1.3), V(1.3, 1.3), V(-1.3, 1.3), V(1.3, -1.3)]), lmat(C.net, 1)));
  for (const [x, y] of [[-1.3, -1.3], [1.3, 1.3], [-1.3, 1.3], [1.3, -1.3]]) { const r = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(.8, 16)), lmat(C.net, 1)); r.position.copy(V(x, y)); chaser.add(r); }
  chaser.add(add(new THREE.Mesh(new THREE.BoxGeometry(1.2, .5, .8), fmat(C.net, .5)), chaser));
  const chaserLab = label("Chaser · onboard Jetson", "#9fe8c6", .8); chaserLab.center.set(1, .5); G[2].add(chaserLab);
  let cpos = { x: 54, y: -4 };
  const boxLines = line(Array(17).fill(V(0, 0)), C.net, 1, G[2]);
  const camTag = label("drone", "#9fe8c6", .8); G[2].add(camTag);
  // 3 RF: operator on the street, control link to the drone, Pluto SDR receives
  const oper = add(new THREE.Group(), G[3]);
  wireBox(OPER.x - .4, OPER.y - .4, OPER.x + .4, OPER.y + .4, 0, 1.8, C.white, .9, .1, oper);
  const opLab = label("operator · 2.4 GHz control", "#dcb9ff", .8); opLab.position.copy(V(OPER.x + 2, OPER.y + 2, 3)); G[3].add(opLab);
  const link = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0), V(1, 1)]), new THREE.LineDashedMaterial({ color: C.rf, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })), G[3]);

  // ---- transient pulses and packets
  const fx = [];
  function ring(group, x, y, z, col, r0, r1, life, o = .8) { const m = add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(1)), lmat(col, o)), group); m.position.copy(V(x, y, z)); fx.push({ m, group, r0, r1, life, o, t0: now }); }
  function packet(group, a, b, col, dur, lift = 4) { const m = add(new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), fmat(col, 1)), group); fx.push({ m, group, a, b, lift, dur, t0: now }); }

  // ---- geometry helpers
  const blocked = (ax, ay, bx, by) => {
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - BLD.x0], [dx, BLD.x1 - ax], [-dy, ay - BLD.y0], [dy, BLD.y1 - ay]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t0 < t1;
  };
  const radarSees = (x, y) => { const dx = x - RADAR.x, dy = y - RADAR.y; if (Math.hypot(dx, dy) > RADAR.range) return false; const a = Math.atan2(dy, dx) - RADAR.yaw; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= RADAR.half && !blocked(RADAR.x, RADAR.y, x, y); };

  // ---- views: street first, then one per modality (camera position, look-at, drone area)
  const VIEWS = [
    { pos: V(-92, -62, 30), look: V(-22, -6, 4), drone: [-38, -6] },     // acoustic: west side, behind the building from the radar
    { pos: V(100, 30, 26), look: V(18, -10, 2), drone: [24, -24] },        // radar: east yard, inside the fan
    { pos: V(66, 50, 15), look: V(40, -16, 12), drone: [32, -26] },    // camera: in the fixed field of view
    { pos: V(-46, 100, 16), look: V(-18, 36, 12), drone: [-10, 30] },      // RF: link from the street to the drone
  ];
  const STREET = { pos: V(-46, 98, 3), look: V(6, 0, 9) };
  const CENTER = new THREE.Vector3(12, 0, 0);
  const toCyl = v => { const d = v.clone().sub(CENTER); return { a: Math.atan2(d.x, d.z), r: Math.hypot(d.x, d.z), y: v.y }; };

  let step = -1, from = { pos: STREET.pos.clone(), look: STREET.look.clone() }, to = from, tw = 1, now = 0;
  let dpos = { x: -38, y: -6 };
  const curPos = STREET.pos.clone(), curLook = STREET.look.clone();
  function go(k) {
    if (k === step) return; step = k;
    from = { pos: curPos.clone(), look: curLook.clone() };
    to = k < 0 ? STREET : VIEWS[k]; tw = reduce ? 1 : 0;
    G.forEach((g, i) => g.visible = i === k);
    nodes.forEach(n => n.lab.material.opacity = k === 0 ? 1 : .45);
    radarLab.material.opacity = k === 1 ? 1 : .45; sdrLab.material.opacity = k === 3 ? 1 : .45;
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function moveCamera(dt) {
    if (tw < 1) tw = Math.min(1, tw + dt / 1.15);
    const e = ease(tw);
    // swing around the compound: interpolate angle, radius and height about its centre
    const A = toCyl(from.pos), B = toCyl(to.pos);
    let da = B.a - A.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    const a = A.a + da * e, r = A.r + (B.r - A.r) * e, y = A.y + (B.y - A.y) * e + Math.sin(e * Math.PI) * 26;
    curPos.set(CENTER.x + Math.sin(a) * r, y, CENTER.z + Math.cos(a) * r);
    curLook.lerpVectors(from.look, to.look, e);
    const sway = reduce ? 0 : Math.sin(now * .25) * .8;
    cam.position.copy(curPos).add(new THREE.Vector3(sway, 0, 0)); cam.lookAt(curLook);
  }

  function sim(dt) {
    const k = Math.max(0, step), A = VIEWS[k].drone;
    const want = { x: A[0] + Math.cos(now * .6) * 5, y: A[1] + Math.sin(now * .9) * 3.5 };
    const f = Math.min(1, dt * 1.4); dpos = { x: dpos.x + (want.x - dpos.x) * f, y: dpos.y + (want.y - dpos.y) * f };
    const D = V(dpos.x, dpos.y, ALT);
    drone.position.copy(D); drone.rotation.y = now * 7;
    tether.geometry.setFromPoints([V(dpos.x, dpos.y, 0), D]);
    if (step === 0) {
      if (now % .4 < dt) ring(G[0], dpos.x, dpos.y, ALT, C.amber, 1, HEAR, 2.4, .85);
      for (const n of nodes) {
        const hear = Math.hypot(n.x - dpos.x, n.y - dpos.y) < HEAR;
        n.m.material.opacity = hear ? 1 : .3;
        if (hear && now - n.last >= .5) { n.last = now; ring(G[0], n.x, n.y, 3, C.amber, .5, 5, .7); packet(G[0], V(n.x, n.y, 3), V(TABLE.x, TABLE.y, 1.2), C.amber, 1.1, 6); }
      }
    } else nodes.forEach(n => n.m.material.opacity = .8);
    if (step === 1) {
      const seen = radarSees(dpos.x, dpos.y);
      beam.visible = seen; if (seen) beam.geometry.setFromPoints([V(RADAR.x, RADAR.y, 2), D]);
      if (now % .2 < dt) { packet(G[1], V(RADAR.x, RADAR.y, 2), D, C.radar, .25, 0); if (seen) ring(G[1], dpos.x, dpos.y, ALT, C.radar, .5, 4, .5); }
    }
    if (step === 2) {
      // chaser holds a stand-off behind the target; its camera stays on the target
      const sw = { x: dpos.x + 18, y: dpos.y + 10 }, cf = Math.min(1, dt * 1.2);
      cpos = { x: cpos.x + (sw.x - cpos.x) * cf, y: cpos.y + (sw.y - cpos.y) * cf };
      const o = V(cpos.x, cpos.y, ALT + 3), aim = D;
      chaser.position.copy(o); chaser.rotation.y = Math.atan2(aim.x - o.x, aim.z - o.z);
      chaserLab.position.copy(o.clone().add(new THREE.Vector3(-1.5, 3, 0)));
      const fwd = aim.clone().sub(o).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
      const dist = Math.max(8, o.distanceTo(aim) * 1.4), hw = Math.tan(.5) * dist, hh = hw * .5625, c0 = o.clone().addScaledVector(fwd, dist);
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => c0.clone().addScaledVector(right, sx * hw).addScaledVector(up, sy * hh));
      fov.children.forEach(c => c.geometry.dispose()); fov.clear();
      add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cs.flatMap(c => [o, c])), lmat(C.net, .45)), fov);
      add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(cs), lmat(C.net, .6)), fov);
      // detection brackets around the drone, facing the camera
      const s = 2.4, br = [];
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const c = D.clone().addScaledVector(right, sx * s).addScaledVector(up, sy * s);
        br.push(c.clone().addScaledVector(right, -sx * 1.2), c, c, c.clone().addScaledVector(up, -sy * 1.2));
      }
      G[2].remove(boxLines); boxLines.geometry.dispose();
      boxLines.geometry = new THREE.BufferGeometry().setFromPoints(br); G[2].add(boxLines);
      camTag.position.copy(D.clone().addScaledVector(right, -s).addScaledVector(up, s + 1.6));
    }
    if (step === 3) {
      link.geometry.setFromPoints([V(OPER.x, OPER.y, 1.6), D]); link.computeLineDistances();
      link.material.dashSize = 1.6; link.material.gapSize = 1.2;
      link.material.opacity = .6 + .4 * Math.sin(now * 12);
      if (now % .5 < dt) { ring(G[3], dpos.x, dpos.y, ALT, C.rf, 1, 70, 2.2, .8); ring(G[3], OPER.x, OPER.y, 1.6, C.rf, .5, 10, 1, .6); }
      if (now % .5 < dt) ring(G[3], SDR.x, SDR.y, 1.6, C.rf, 4, .4, .6, .9);
    }
  }
  function animate() {
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      if (p.dur) { const f = (now - p.t0) / p.dur; if (f >= 1 || !p.group.visible) { p.group.remove(p.m); p.m.geometry.dispose(); fx.splice(i, 1); continue; } p.m.position.lerpVectors(p.a, p.b, f); p.m.position.y += Math.sin(f * Math.PI) * p.lift; }
      else { const f = (now - p.t0) / p.life; if (f >= 1 || !p.group.visible) { p.group.remove(p.m); p.m.geometry.dispose(); fx.splice(i, 1); continue; } p.m.scale.setScalar(p.r0 + (p.r1 - p.r0) * f); p.m.material.opacity = p.o * (1 - f); }
    }
  }

  // linked to the page's pinned steps (".steps li.on")
  const items = [...sec.querySelectorAll(".steps li")];
  const current = () => items.findIndex(li => li.classList.contains("on"));
  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < 700 ? 62 : 48;
    // wide screens: subject sits left of centre and low, clear of the text panel
    if (w > 900) cam.setViewOffset(w, h, w * 0.1, -h * 0.16, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage); size();
  go(-1);
  let live = false, last = 0, enteredAt = -1;
  new IntersectionObserver(([e]) => {
    live = e.isIntersecting;
    if (live) { last = performance.now(); enteredAt = now; step = -2; go(-1); curPos.copy(STREET.pos); curLook.copy(STREET.look); tw = 1; requestAnimationFrame(frame); }
  }).observe(stage);
  function frame(ms) {
    if (!live) return;
    const dt = Math.min(.05, (ms - last) / 1000); last = ms;
    if (!reduce) now += dt;
    const r = sec.getBoundingClientRect();
    // on entry: hold the street view briefly, then fly to the active sensor
    go(r.top > 10 || (!reduce && now - enteredAt < .9) ? -1 : current());
    sim(dt); animate(); moveCamera(dt);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
}
