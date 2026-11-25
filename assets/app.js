(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- header + menu ----------
  const nav = document.getElementById("nav");
  const menuBtn = document.getElementById("menu-btn");
  menuBtn.addEventListener("click", () => menuBtn.setAttribute("aria-expanded", nav.classList.toggle("open")));
  document.querySelectorAll("#menu a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }));

  // ---------- section dots ----------
  const secs = [...document.querySelectorAll("[data-sec]")];
  const dotsEl = document.getElementById("dots");
  dotsEl.innerHTML = secs.map(s => `<a href="#${s.id || ""}" data-for="${s.dataset.sec}"><span>${s.dataset.sec}</span></a>`).join("");
  const dots = [...dotsEl.children];
  secs.forEach((s, i) => { if (!s.id) { s.id = "s" + i; dots[i].href = "#s" + i; } });
  const menuLinks = [...document.querySelectorAll("#menu a")];
  const secIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const i = secs.indexOf(e.target);
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    menuLinks.forEach(l => l.classList.toggle("on", l.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-48% 0px -48% 0px" });
  secs.forEach(s => secIO.observe(s));

  // ---------- headline letter reveal ----------
  const heads = [...document.querySelectorAll("[data-scramble]")];
  heads.forEach(h => {
    h.setAttribute("aria-label", h.textContent.replace(/\s+/g, " ").trim());
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.append(" "); return; }
          const word = document.createElement("span");
          word.style.whiteSpace = "nowrap"; word.setAttribute("aria-hidden", "true");
          word.innerHTML = [...w].map(c => `<span class="ch">${c}</span>`).join("");
          frag.append(word);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(h);
  });
  const play = h => {
    const chs = [...h.querySelectorAll(".ch")];
    if (reduce) { chs.forEach(c => c.className = "ch on"); return; }
    const order = chs.map(c => [Math.random(), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const step = Math.min(55, 1100 / chs.length);
    order.forEach((c, i) => {
      const t0 = i * step;
      const outline = Math.random() < 0.45;
      if (outline) setTimeout(() => c.className = "ch o", t0);
      setTimeout(() => c.className = "ch g", t0 + (outline ? 260 : 0));
      setTimeout(() => c.className = "ch on", t0 + 420 + Math.random() * 380);
    });
  };
  const headIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { play(e.target); headIO.unobserve(e.target); } }), { threshold: 0.35 });
  heads.forEach(h => headIO.observe(h));

  const revIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revIO.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".slide .wrap > :not([data-scramble]):not(.eyebrow), .slide .two > *, footer .wrap").forEach(el => { el.classList.add("reveal"); revIO.observe(el); });

  // ---------- canvas effects ----------
  const rand = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
  const FX = {};

  // hero: expanding acoustic wavefronts around a source
  FX.field = (() => {
    const P = Array.from({ length: 4200 }, () => ({ a: rand() * Math.PI * 2, ring: Math.floor(rand() * 5), j: (rand() - 0.5) * 2 }));
    const RINGS = 5;
    return (c, w, h, t) => {
      c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
      const cx = w > 900 ? w * 0.7 : w * 0.6, cy = h * 0.52, R = Math.max(w, h) * 0.6;
      c.globalCompositeOperation = "lighter";
      const wob = (a, f) => 1 + Math.sin(a * 5 + t * 0.5 + f * 4) * 0.04 + Math.sin(a * 9 - t * 0.35) * 0.02;
      for (let k = 0; k < RINGS; k++) {
        const f = ((k / RINGS) + t * 0.028) % 1, al = Math.sin(f * Math.PI);
        const r = f * R;
        c.lineWidth = 1 + 10 * (1 - f);
        c.strokeStyle = `rgba(120,190,210,${al * 0.06})`;
        c.beginPath();
        for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2, rr = r * wob(a, f); i ? c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.82) : c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.82); }
        c.stroke();
        c.lineWidth = 1; c.strokeStyle = `rgba(200,230,240,${al * 0.28})`; c.stroke();
      }
      for (const p of P) {
        const f = ((p.ring / RINGS) + t * 0.028) % 1;
        const r = f * R * wob(p.a, f) + p.j * (6 + 30 * f);
        const al = Math.sin(f * Math.PI) * (0.35 + 0.5 * Math.abs(Math.sin(p.a * 3 + t * 0.25))) * (1 - Math.abs(p.j) * 0.6);
        c.fillStyle = p.ring === 0 ? `rgba(255,181,71,${al})` : `rgba(170,215,228,${al})`;
        c.fillRect(cx + Math.cos(p.a) * r, cy + Math.sin(p.a) * r * 0.82, 1.6, 1.6);
      }
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.25);
      g.addColorStop(0, "rgba(255,190,90,0.3)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      c.fillStyle = "#ffcf85"; c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = "source-over";
    };
  })();

  // streaks: iridescent arcs revealed column by column with scroll
  const streakSec = document.getElementById("streaks");
  const colOrder = [4, 1, 7, 2, 6, 0, 8, 3, 5];
  FX.streaks = (c, w, h, t) => {
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    const r = streakSec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - h)));
    const top = 74, cw = w / 9;
    c.save();
    c.beginPath();
    colOrder.forEach((col, i) => {
      const v = Math.min(1, Math.max(0, p * 11 - i));
      if (v <= 0) return;
      const ch = (h - top) * (p > 0.95 ? 1 : v);
      c.rect(col * cw, top, cw, ch);
    });
    c.clip();
    c.globalCompositeOperation = "lighter";
    const cx = w * 1.05, cy = h * 1.55, rot = Math.sin(t * 0.05) * 0.06;
    for (let b = 0; b < 4; b++) {
      const r0 = h * (1.0 + b * 0.2) + Math.sin(t * 0.3 + b) * 14;
      const a0 = Math.PI * 1.02 + rot + b * 0.05, a1 = Math.PI * 1.5 + rot * 0.5;
      c.strokeStyle = `hsla(${(230 + b * 60 + t * 10) % 360},80%,55%,0.08)`; c.lineWidth = 80;
      c.beginPath(); c.arc(cx, cy, r0 + 40, a0, a1); c.stroke();
      for (let i = 0; i < 48; i++) {
        const bell = Math.exp(-((i - 24) ** 2) / 120);
        const hue = (190 + i * 7 + b * 70 + t * 12) % 360;
        c.strokeStyle = `hsla(${hue},85%,${50 + bell * 30}%,${0.025 + bell * 0.26})`;
        c.lineWidth = 2.6;
        c.beginPath(); c.arc(cx, cy, r0 + i * 1.8, a0, a1); c.stroke();
      }
      c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.6;
      c.beginPath(); c.arc(cx, cy, r0 + 44, a0 + 0.02, a1 - 0.02); c.stroke();
    }
    c.restore();
    c.globalCompositeOperation = "source-over";
  };

  // fusion: rotating particle torus
  FX.torus = (() => {
    const P = Array.from({ length: 6500 }, () => ({ u: rand() * Math.PI * 2, v: rand() * Math.PI * 2, n: rand() }));
    return (c, w, h, t) => {
      c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
      const cx = w > 900 ? w * 0.68 : w * 0.55, cy = h * 0.52, S = Math.min(w, h) * 0.34;
      const ay = t * 0.18, ax = 1.15 + Math.sin(t * 0.13) * 0.15;
      const ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
      c.globalCompositeOperation = "lighter";
      for (const p of P) {
        const rr = 0.32 + 0.06 * Math.sin(p.u * 4 + t * 0.8) + p.n * 0.03;
        let x = (1 + rr * Math.cos(p.v)) * Math.cos(p.u), y = (1 + rr * Math.cos(p.v)) * Math.sin(p.u), z = rr * Math.sin(p.v);
        let x1 = x * ca - y * sa, y1 = x * sa + y * ca;
        let y2 = y1 * cb - z * sb, z2 = y1 * sb + z * cb;
        const depth = 1 / (2.6 - z2 * 0.6);
        const sx = cx + x1 * S * depth * 2.2, sy = cy + y2 * S * depth * 2.2;
        const al = 0.4 + 0.6 * (z2 + 1.3) / 2.6;
        c.fillStyle = `rgba(90,170,255,${al})`;
        c.fillRect(sx, sy, 1.8, 1.8);
      }
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, S * 1.4);
      g.addColorStop(0, "rgba(40,120,255,0.22)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = "source-over";
    };
  })();

  // sensors: perspective dot field with an acoustic wave
  FX.dots = (c, w, h, t) => {
    c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
    const f = h * 0.9, hz = h * 0.3, cam = 3.2, sx0 = w * 0.62;
    for (let z = 2; z < 46; z += 0.9) {
      for (let x = -40; x <= 40; x += 1.1) {
        const d = Math.hypot(x - 6, z - 16);
        const y = Math.sin(d * 0.7 - t * 2.2) * 0.9 / (1 + d * 0.12);
        const sx = sx0 + (x / z) * f, sy = hz + ((cam - y) / z) * f;
        if (sx < -4 || sx > w + 4 || sy > h + 4) continue;
        const s = Math.max(0.6, 2.6 * f / (z * 260));
        const al = Math.min(0.9, 0.3 + 5 / z) * (0.6 + y * 0.5);
        c.fillStyle = `rgba(230,232,235,${al})`;
        c.fillRect(sx, sy, s, s);
      }
    }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#000"); g.addColorStop(0.3, "rgba(0,0,0,0.2)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const g2 = c.createLinearGradient(0, 0, w, 0);
    g2.addColorStop(0, "rgba(0,0,0,0.75)"); g2.addColorStop(0.5, "rgba(0,0,0,0.2)"); g2.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g2; c.fillRect(0, 0, w, h);
  };

  // team: starfield over a horizon glow
  FX.stars = (() => {
    const S = Array.from({ length: 900 }, () => ({ x: rand(), y: rand(), m: rand() ** 3, p: rand() * 6 }));
    return (c, w, h, t) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#000"); g.addColorStop(0.7, "#04070d"); g.addColorStop(0.92, "#1a1410"); g.addColorStop(1, "#2a1a0c");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (const s of S) {
        const tw = 0.55 + 0.45 * Math.sin(t * (0.6 + s.m) + s.p);
        c.fillStyle = `rgba(255,255,255,${(0.2 + s.m * 0.8) * tw})`;
        const r = 0.6 + s.m * 1.4;
        c.fillRect(((s.x + t * 0.002) % 1) * w, s.y * h * 0.92, r, r);
      }
      c.fillStyle = "#000";
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.9 - Math.abs(Math.sin(x * 0.004) * 50 + Math.sin(x * 0.011 + 1) * 26 + Math.sin(x * 0.031) * 8));
      c.lineTo(w, h); c.closePath(); c.fill();
    };
  })();

  // ---------- pinned steppers: progress through a tall section drives the step ----------
  const pins = [...document.querySelectorAll(".pin")].map(sec => ({
    sec, n: +sec.dataset.steps, bar: sec.querySelector(".pbar i"),
    items: [...sec.querySelectorAll(".steps li")], bodies: [...sec.querySelectorAll(".step-body > *")],
    p: 0, step: -1, bounds: null,
  }));
  const pinProgress = sec => { const r = sec.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight))); };
  const setStep = (pn, k) => {
    if (k === pn.step) return; pn.step = k;
    pn.items.forEach((el, i) => el.classList.toggle("on", i === k));
    pn.bodies.forEach((el, i) => el.classList.toggle("on", i === k));
  };
  const updatePins = () => pins.forEach(pn => {
    pn.p = pinProgress(pn.sec);
    if (pn.bar) pn.bar.style.transform = `scaleX(${pn.p})`;
    let k;
    if (pn.bounds) { k = pn.bounds.findIndex(b => pn.p < b); if (k < 0) k = pn.n - 1; }
    else k = Math.min(pn.n - 1, Math.floor(pn.p * pn.n));
    setStep(pn, k);
  });
  addEventListener("scroll", updatePins, { passive: true });
  addEventListener("resize", updatePins);
  pins.forEach(pn => pn.items.forEach((li, i) => {
    li.style.cursor = "pointer";
    li.addEventListener("click", () => {
      const lo = i === 0 ? 0 : (pn.bounds ? pn.bounds[i - 1] : i / pn.n), hi = pn.bounds ? (pn.bounds[i] ?? 1) : (i + 1) / pn.n;
      const top = pn.sec.offsetTop + ((lo + hi) / 2) * (pn.sec.offsetHeight - innerHeight);
      scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    });
  }));

  // track custody: simulation state is a function of scroll progress (scrubbed, smoothed)
  FX.sim = (() => {
    const pin = pins.find(pn => pn.sec.id === "capability");
    const BLD = { x0: -20, x1: 20, y0: -15, y1: 15 };
    const NODES = [[-20, -15], [20, -15], [20, 15], [-20, 15]].map(([x, y], i) => ({ x, y, n: `N${i + 1}` }));
    const RADAR = { x: 50, y: 0, yaw: Math.PI, half: Math.PI / 3, range: 76 };
    const HEAR = 46;
    const PATH = [[16, -40], [2, -34], [-14, -31], [-32, -24], [-42, -4], [-38, 18], [-18, 31], [4, 33], [24, 30]];
    const segLen = []; let total = 0;
    for (let i = 0; i < PATH.length - 1; i++) { const l = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]); segLen.push(l); total += l; }
    const posAt = q => {
      let d = Math.min(1, Math.max(0, q)) * total;
      for (let i = 0; i < segLen.length; i++) {
        if (d <= segLen[i]) { const f = d / segLen[i]; return { x: PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * f, y: PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * f }; }
        d -= segLen[i];
      }
      const e = PATH[PATH.length - 1]; return { x: e[0], y: e[1] };
    };
    const blocked = (ax, ay, bx, by) => {
      let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
      for (const [p, q] of [[-dx, ax - BLD.x0], [dx, BLD.x1 - ax], [-dy, ay - BLD.y0], [dy, BLD.y1 - ay]]) {
        if (p === 0) { if (q < 0) return false; continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      }
      return t0 < t1;
    };
    const radarSees = p => {
      const dx = p.x - RADAR.x, dy = p.y - RADAR.y;
      if (Math.hypot(dx, dy) > RADAR.range) return false;
      const a = Math.atan2(dy, dx) - RADAR.yaw;
      return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= RADAR.half && !blocked(RADAR.x, RADAR.y, p.x, p.y);
    };
    const hearingAt = d => NODES.filter(n => Math.hypot(n.x - d.x, n.y - d.y) < HEAR);
    // drone path occupies 0.06..0.94 of the pinned scroll
    const Q = p => (p - 0.06) / 0.88;
    // acoustic localization needs several LoRa reports before it updates the target: coast in between
    const RES = 800, seenTab = new Uint8Array(RES + 1), lastSeen = new Float32Array(RES + 1);
    for (let i = 0, ls = -1; i <= RES; i++) { const pp = i / RES; seenTab[i] = radarSees(posAt(Q(pp))) ? 1 : 0; if (seenTab[i]) ls = pp; lastSeen[i] = ls; }
    const ACQ = 0.07;
    let firstLost = 1; for (let i = 0; i <= RES; i++) if (!seenTab[i] && i / RES > 0.06) { firstLost = i / RES; break; }
    const state = p => {
      const d = posAt(Q(p)), seen = radarSees(d), hearing = hearingAt(d);
      const i = Math.max(0, Math.min(RES, Math.round(p * RES)));
      // once the acoustic track is established, nodes in range keep reporting after radar reacquires
      const acoustic = hearing.length >= 2 && (seen ? p > firstLost + ACQ : lastSeen[i] >= 0 && p - lastSeen[i] > ACQ);
      let est = { x: d.x, y: d.y }, sigma = seen && acoustic ? 0.9 : 1.3;
      if (!seen) {
        if (acoustic) {
          let wx = 0, wy = 0, ws = 0;
          for (const n of hearing) { const w = 1 / Math.max(4, Math.hypot(n.x - d.x, n.y - d.y)) ** 2; wx += n.x * w; wy += n.y * w; ws += w; }
          est = { x: d.x * 0.82 + (wx / ws) * 0.18, y: d.y * 0.82 + (wy / ws) * 0.18 }; sigma = 4.5;
        } else if (lastSeen[i] >= 0) {
          const pL = lastSeen[i], a = posAt(Q(pL)), b = posAt(Q(pL - 0.01)), k = (p - pL) / 0.01;
          est = { x: a.x + (a.x - b.x) * k, y: a.y + (a.y - b.y) * k }; sigma = 3 + (p - pL) * 60;
        } else sigma = 7;
      }
      return { d, seen, hearing, est, sigma, acoustic };
    };
    // step boundaries from the simulation itself: radar lost, acoustic holding, radar back
    if (pin) {
      let lost = null, held = null, back = null;
      for (let i = 0; i <= 400; i++) {
        const p = i / 400, s = state(p);
        if (lost === null && !s.seen && p > 0.06) lost = p;
        if (lost !== null && held === null && s.acoustic) held = p;
        if (held !== null && back === null && s.seen) back = p;
      }
      pin.bounds = [lost ?? 0.25, held ?? 0.4, back ?? 0.8];
    }
    const ro = { src: document.getElementById("ro-src"), nodes: document.getElementById("ro-nodes"), radar: document.getElementById("ro-radar") };
    const ACC = "255,181,71", RAD = "127,178,255";
    let shown = 0, lastKey = "";

    return (c, w, h, t) => {
      const target = pin ? pin.p : 0;
      shown += (target - shown) * (reduce ? 1 : 0.14);
      const p = shown;
      const wide = w > 760;
      const s = wide ? Math.min(w * 0.5 / 115, (h - 200) / 82) : Math.min(w * 0.92 / 100, h * 0.44 / 80);
      const cx = wide ? w * 0.66 : w * 0.5, cy = wide ? h * 0.52 : h * 0.27;
      const X = x => cx + x * s, Y = y => cy + y * s;
      const st = state(p);
      const src = [st.seen && "Radar", st.acoustic && "Acoustic"].filter(Boolean).join(" + ") || (Q(p) < 0 ? "—" : "Coast");
      const col = st.seen ? RAD : st.acoustic ? ACC : "190,196,204";

      c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(255,255,255,0.04)"; c.lineWidth = 1;
      const gs = 10 * s;
      for (let x = cx % gs; x < w; x += gs) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = cy % gs; y < h; y += gs) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }

      // radar coverage and building shadow
      c.fillStyle = `rgba(${RAD},${st.seen ? 0.12 : 0.05})`; c.strokeStyle = `rgba(${RAD},0.45)`;
      c.beginPath(); c.moveTo(X(RADAR.x), Y(RADAR.y)); c.arc(X(RADAR.x), Y(RADAR.y), RADAR.range * s, RADAR.yaw - RADAR.half, RADAR.yaw + RADAR.half); c.closePath(); c.fill(); c.stroke();
      const corners = [[BLD.x1, BLD.y0], [BLD.x1, BLD.y1], [BLD.x0, BLD.y0], [BLD.x0, BLD.y1]];
      const ang = ([x, y]) => Math.atan2(y - RADAR.y, x - RADAR.x);
      const sorted = corners.slice().sort((A, B) => { const a = ang(A), b = ang(B); return (a < 0 ? a + 2 * Math.PI : a) - (b < 0 ? b + 2 * Math.PI : b); });
      const A = sorted[0], B = sorted[3], far = 200;
      const ext = ([x, y]) => { const a = ang([x, y]); return [x + Math.cos(a) * far, y + Math.sin(a) * far]; };
      c.save(); c.beginPath(); c.moveTo(X(RADAR.x), Y(RADAR.y)); c.arc(X(RADAR.x), Y(RADAR.y), RADAR.range * s, RADAR.yaw - RADAR.half, RADAR.yaw + RADAR.half); c.closePath(); c.clip();
      c.fillStyle = "rgba(0,0,0,0.75)"; c.beginPath(); c.moveTo(X(A[0]), Y(A[1])); c.lineTo(X(ext(A)[0]), Y(ext(A)[1])); c.lineTo(X(ext(B)[0]), Y(ext(B)[1])); c.lineTo(X(B[0]), Y(B[1])); c.closePath(); c.fill();
      c.restore();
      if (!reduce) {
        const sw = RADAR.yaw - RADAR.half + ((t * 0.9) % 1) * 2 * RADAR.half;
        c.strokeStyle = `rgba(${RAD},0.3)`; c.beginPath(); c.moveTo(X(RADAR.x), Y(RADAR.y));
        c.lineTo(X(RADAR.x + Math.cos(sw) * RADAR.range), Y(RADAR.y + Math.sin(sw) * RADAR.range)); c.stroke();
      }

      c.fillStyle = "#07080a"; c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1.5;
      c.fillRect(X(BLD.x0), Y(BLD.y0), 40 * s, 30 * s); c.strokeRect(X(BLD.x0), Y(BLD.y0), 40 * s, 30 * s); c.lineWidth = 1;
      const fs = Math.max(10, Math.round(1.15 * s));
      c.font = `500 ${fs}px 'IBM Plex Mono', monospace`; c.textAlign = "center";
      c.fillStyle = "rgba(255,255,255,0.5)"; c.fillText("STRUCTURE", X(0), Y(0) + fs / 3);

      const live = Q(p) >= 0;
      if (live) {
        c.setLineDash([3, 5]);
        if (st.acoustic) for (const n of st.hearing) { c.strokeStyle = `rgba(${ACC},0.35)`; c.beginPath(); c.moveTo(X(n.x), Y(n.y)); c.lineTo(X(st.est.x), Y(st.est.y)); c.stroke(); }
        if (st.seen) { c.strokeStyle = `rgba(${RAD},0.45)`; c.beginPath(); c.moveTo(X(RADAR.x), Y(RADAR.y)); c.lineTo(X(st.est.x), Y(st.est.y)); c.stroke(); }
        c.setLineDash([]);
      }
      for (const n of NODES) {
        const on = live && st.acoustic && st.hearing.includes(n);
        if (on && !reduce) for (let k = 0; k < 2; k++) {
          const ph = (t * 0.8 + k * 0.5) % 1;
          c.strokeStyle = `rgba(${ACC},${0.5 * (1 - ph)})`; c.beginPath(); c.arc(X(n.x), Y(n.y), (1 + ph * 9) * s, 0, Math.PI * 2); c.stroke();
        }
        c.fillStyle = "#000"; c.strokeStyle = on ? `rgb(${ACC})` : "#5a6068"; c.lineWidth = 2;
        c.beginPath(); c.arc(X(n.x), Y(n.y), Math.max(5, 0.75 * s), 0, Math.PI * 2); c.fill(); c.stroke(); c.lineWidth = 1;
        c.fillStyle = on ? `rgb(${ACC})` : "#8a9098";
        c.fillText(n.n, X(n.x + (n.x < 0 ? -3 : 3)), Y(n.y + (n.y < 0 ? -2.4 : 3.8)));
      }
      c.fillStyle = `rgb(${RAD})`; c.fillRect(X(RADAR.x) - 5, Y(RADAR.y) - 5, 10, 10);
      c.fillStyle = `rgba(${RAD},0.85)`; c.fillText("RADAR", X(RADAR.x + 4), Y(RADAR.y) + 3.6 * s);

      if (live) {
        // trail: deterministic history over the last part of the path
        c.lineWidth = 2;
        const N = 70, span = 0.16;
        let prev = null;
        for (let i = 0; i <= N; i++) {
          const pp = p - span + (span * i) / N;
          if (Q(pp) < 0) continue;
          const sp = state(pp);
          if (prev) { c.strokeStyle = sp.seen ? `rgba(${RAD},${0.85 * (i / N)})` : sp.acoustic ? `rgba(${ACC},${0.85 * (i / N)})` : `rgba(160,166,174,${0.6 * (i / N)})`; c.beginPath(); c.moveTo(X(prev.x), Y(prev.y)); c.lineTo(X(sp.est.x), Y(sp.est.y)); c.stroke(); }
          prev = sp.est;
        }
        c.lineWidth = 1;
        c.strokeStyle = `rgba(${col},0.45)`; c.setLineDash(st.seen || st.acoustic ? [] : [4, 4]);
        c.beginPath(); c.arc(X(st.est.x), Y(st.est.y), st.sigma * s, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        c.strokeStyle = `rgb(${col})`; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(X(st.est.x), Y(st.est.y) - 8); c.lineTo(X(st.est.x) + 8, Y(st.est.y)); c.lineTo(X(st.est.x), Y(st.est.y) + 8); c.lineTo(X(st.est.x) - 8, Y(st.est.y)); c.closePath(); c.stroke();
        c.lineWidth = 1; c.textAlign = "left"; c.font = `500 ${fs + 1}px 'IBM Plex Mono', monospace`; c.fillStyle = `rgb(${col})`;
        c.fillText(`TRK-01 · ${src.toUpperCase()}`, X(st.est.x) + 14, Y(st.est.y) - 12);
      }
      const key = `${src}|${st.hearing.length}|${st.seen}|${st.acoustic}|${live}`;
      if (key !== lastKey) {
        lastKey = key;
        ro.src.textContent = live ? src : "—"; ro.nodes.textContent = live ? `${st.acoustic ? st.hearing.length : 0} / ${NODES.length}` : "—"; ro.radar.textContent = live ? (st.seen ? "Contact" : "No contact") : "—";
      }
    };
  })();
  updatePins();

  // snap points: one per step inside pinned sections, start and end of the streak section
  const placeSnaps = () => {
    document.querySelectorAll(".snap").forEach(el => el.remove());
    const mark = (sec, y) => { const m = document.createElement("i"); m.className = "snap"; m.style.top = `${Math.round(y)}px`; sec.appendChild(m); };
    pins.forEach(pn => {
      const run = pn.sec.offsetHeight - innerHeight;
      const edges = [0, ...(pn.bounds || Array.from({ length: pn.n - 1 }, (_, i) => (i + 1) / pn.n)), 1];
      for (let k = 0; k < pn.n; k++) mark(pn.sec, ((edges[k] + edges[k + 1]) / 2) * run);
    });
    const sk = document.getElementById("streaks");
    if (sk) { mark(sk, 0); mark(sk, sk.offsetHeight - innerHeight); }
  };
  placeSnaps();
  addEventListener("resize", placeSnaps);


  // engine: draw only visible canvases
  const items = [...document.querySelectorAll("canvas[data-fx]")].map(el => ({ el, ctx: el.getContext("2d"), fx: FX[el.dataset.fx], w: 0, h: 0, vis: false }));
  const size = it => {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = it.el.getBoundingClientRect();
    it.w = r.width; it.h = r.height; it.el.width = Math.round(r.width * dpr); it.el.height = Math.round(r.height * dpr);
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro2 = new ResizeObserver(es => es.forEach(e => { const it = items.find(i => i.el === e.target); size(it); if (reduce || !running) it.fx(it.ctx, it.w, it.h, 6); }));
  const visIO = new IntersectionObserver(es => es.forEach(e => { const it = items.find(i => i.el === e.target); it.vis = e.isIntersecting; }));
  items.forEach(it => { size(it); ro2.observe(it.el); visIO.observe(it.el); });
  const T0 = performance.now();
  let running = !reduce;
  const loop = now => {
    const t = (now - T0) / 1000;
    for (const it of items) if (it.vis && it.w) it.fx(it.ctx, it.w, it.h, t);
    requestAnimationFrame(loop);
  };
  if (running) requestAnimationFrame(loop);
  else {
    items.forEach(it => it.fx(it.ctx, it.w, it.h, 6));
    addEventListener("scroll", () => items.forEach(s => { if (s.vis && (s.el.dataset.fx === "streaks" || s.el.dataset.fx === "sim")) s.fx(s.ctx, s.w, s.h, 6); }), { passive: true });
  }

  // ---------- Data ----------
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const day = 864e5;
  const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const getJSON = p => fetch(p, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(p); return r.json(); });

  getJSON("data/milestones.json").then(m => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const left = iso => Math.max(0, Math.round((new Date(iso + "T00:00:00") - today) / day));
    $("cd-target").innerHTML = `${left(m.target)}<span>days</span>`;
    $("cd-deadline").innerHTML = `${left(m.deadline)}<span>days</span>`;
    const label = { done: "Complete", active: "In progress", planned: "Planned" };
    $("timeline").innerHTML = m.items.map(i => `
      <li class="${esc(i.status)}">
        <span class="meta"><span>${fmtDate(i.date)}</span><span class="st">${label[i.status] || ""}</span></span>
        <h4>${esc(i.title)}</h4><p>${esc(i.detail)}</p>
      </li>`).join("");
  }).catch(() => { $("timeline").innerHTML = "<li><p>Milestones unavailable.</p></li>"; });

  getJSON("data/activity.json").then(a => {
    $("st-7").textContent = a.totals.commits_7d;
    $("st-60").textContent = a.totals.commits_60d;
    $("st-pr").textContent = a.totals.merges_60d;
    $("updated").textContent = a.generated_at ? `Updated ${ago(a.generated_at)}` : "Updated hourly";
    $("feed").innerHTML = a.events.slice(0, 40).map(e => `
      <li><a href="${esc(e.url)}" target="_blank" rel="noopener">
        <span class="repo">${esc(e.repo)}</span>
        <span class="t">${e.type === "merge" ? "<em>Merged</em>" : ""}${esc(e.title)}</span>
        <span class="when">${ago(e.date)}</span>
      </a></li>`).join("");
    $("repos").innerHTML = a.repos.map(r => `
      <a href="${esc(r.url)}" target="_blank" rel="noopener"><b>${esc(r.name)}</b><span>${r.commits_7d} commits this week · pushed ${ago(r.pushed_at)}</span></a>`).join("");
  }).catch(() => { $("updated").textContent = "Activity unavailable"; });

  getJSON("data/briefings.json").then(b => {
    const items = b.items.slice().sort((x, y) => y.date.localeCompare(x.date));
    const latest = items[0];
    const base = id => `https://docs.google.com/presentation/d/${id}`;
    $("latest-date").textContent = new Date(latest.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    $("latest-label").textContent = "Latest briefing";
    $("present").href = `${base(latest.id)}/present`;
    const embed = latest.published || `${base(latest.id)}/embed?start=false&loop=false&delayms=5000`;
    const load = () => {
      const f = document.createElement("iframe");
      f.src = embed; f.allowFullscreen = true; f.title = latest.title; f.loading = "lazy";
      $("screen").replaceChildren(f);
    };
    $("load-deck").addEventListener("click", load);
    if (latest.published) load();
    $("archive").innerHTML = items.map((i, k) => `
      <li class="${k === 0 ? "current" : ""}">
        <div><b>${esc(fmtDate(i.date))}</b></div>
        <div class="links"><a href="${base(i.id)}/present" target="_blank" rel="noopener">Present</a><a href="${base(i.id)}/edit" target="_blank" rel="noopener">Open</a></div>
      </li>`).join("");
  }).catch(() => { $("archive").innerHTML = "<li>Briefings unavailable.</li>"; });
})();
