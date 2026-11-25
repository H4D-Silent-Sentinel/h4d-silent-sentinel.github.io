(() => {
  "use strict";

  // ---------- Hero: fused-track simulation ----------
  const W = 1000, H = 600;
  const COL = [[40, 150], [190, 320], [360, 490], [530, 660], [700, 830], [870, 980]];
  const ROW = [[30, 150], [190, 300], [340, 450], [490, 590]];
  const RADAR = { x: 18, y: 320, yaw: 0, half: Math.PI / 3, range: 560 };
  const NODES = [[170, 170], [510, 170], [850, 170], [170, 470], [510, 470], [850, 470]].map(([x, y]) => ({ x, y }));
  const HEAR = 250;
  const PATH = [[40, 320], [515, 320], [515, 170], [850, 170], [850, 470], [345, 470], [345, 320], [40, 320]];
  const SPEED = 62;

  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const BUILD = [];
  for (const [x0, x1] of COL) for (const [y0, y1] of ROW) {
    const split = rnd() < 0.55;
    if (split) {
      const m = x0 + (x1 - x0) * (0.4 + rnd() * 0.2);
      BUILD.push({ x: x0, y: y0, w: m - x0 - 6, h: y1 - y0, hgt: rnd() });
      BUILD.push({ x: m + 6, y: y0, w: x1 - m - 6, h: y1 - y0, hgt: rnd() });
    } else BUILD.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, hgt: rnd() });
  }

  const segLen = [];
  let total = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const l = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]);
    segLen.push(l); total += l;
  }
  function at(d) {
    d = ((d % total) + total) % total;
    for (let i = 0; i < segLen.length; i++) {
      if (d <= segLen[i]) {
        const f = d / segLen[i], a = PATH[i], b = PATH[i + 1];
        return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
      }
      d -= segLen[i];
    }
    return { x: PATH[0][0], y: PATH[0][1] };
  }

  function segHitsRect(x1, y1, x2, y2, r) {
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function radarSees(p) {
    const dx = p.x - RADAR.x, dy = p.y - RADAR.y, r = Math.hypot(dx, dy);
    if (r > RADAR.range) return false;
    const ang = Math.atan2(dy, dx) - RADAR.yaw;
    if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) > RADAR.half) return false;
    return !BUILD.some(b => segHitsRect(RADAR.x, RADAR.y, p.x, p.y, b));
  }

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const ro = { src: document.getElementById("ro-src"), nodes: document.getElementById("ro-nodes"), radar: document.getElementById("ro-radar") };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let view = { s: 1, ox: 0, oy: 0 }, cw = 0, ch = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.min(cw / W, ch / H);
    view = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2 };
  }
  const X = x => view.ox + x * view.s, Y = y => view.oy + y * view.s;

  const trail = [];
  let est = null, lastSrc = "", lastRO = 0;

  function frame(tms) {
    const t = tms / 1000;
    const d = at(t * SPEED);
    const seen = radarSees(d);
    const hearing = NODES.filter(n => Math.hypot(n.x - d.x, n.y - d.y) < HEAR);
    const src = seen ? "radar" : hearing.length ? "acoustic" : "coast";
    const sigma = seen ? 2 : hearing.length >= 2 ? 9 : 16;
    const nx = d.x + Math.sin(t * 3.1) * sigma * 0.5, ny = d.y + Math.cos(t * 2.3) * sigma * 0.5;
    est = est ? { x: est.x + (nx - est.x) * 0.18, y: est.y + (ny - est.y) * 0.18 } : { x: nx, y: ny };
    trail.push({ x: est.x, y: est.y, src, t });
    while (trail.length && t - trail[0].t > 7) trail.shift();

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch);

    // grid
    ctx.strokeStyle = "rgba(220,230,240,0.035)"; ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 25) { ctx.beginPath(); ctx.moveTo(X(gx), Y(0)); ctx.lineTo(X(gx), Y(H)); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += 25) { ctx.beginPath(); ctx.moveTo(X(0), Y(gy)); ctx.lineTo(X(W), Y(gy)); ctx.stroke(); }

    // radar coverage wedge
    const wedge = () => { ctx.beginPath(); ctx.moveTo(X(RADAR.x), Y(RADAR.y)); ctx.arc(X(RADAR.x), Y(RADAR.y), RADAR.range * view.s, RADAR.yaw - RADAR.half, RADAR.yaw + RADAR.half); ctx.closePath(); };
    const g = ctx.createRadialGradient(X(RADAR.x), Y(RADAR.y), 0, X(RADAR.x), Y(RADAR.y), RADAR.range * view.s);
    g.addColorStop(0, "rgba(127,178,255,0.16)"); g.addColorStop(1, "rgba(127,178,255,0.02)");
    wedge(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(127,178,255,0.22)"; ctx.stroke();
    const sw = RADAR.yaw + Math.sin(t * 1.4) * RADAR.half;
    ctx.strokeStyle = "rgba(127,178,255,0.45)"; ctx.beginPath(); ctx.moveTo(X(RADAR.x), Y(RADAR.y));
    ctx.lineTo(X(RADAR.x + Math.cos(sw) * RADAR.range), Y(RADAR.y + Math.sin(sw) * RADAR.range)); ctx.stroke();

    // buildings
    for (const b of BUILD) {
      ctx.fillStyle = `rgba(14,18,24,${0.92 + b.hgt * 0.08})`;
      ctx.fillRect(X(b.x), Y(b.y), b.w * view.s, b.h * view.s);
      ctx.strokeStyle = "rgba(220,230,240,0.07)";
      ctx.strokeRect(X(b.x) + 0.5, Y(b.y) + 0.5, b.w * view.s - 1, b.h * view.s - 1);
    }

    // node links to estimate
    for (const n of hearing) {
      ctx.strokeStyle = "rgba(255,181,71,0.22)"; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(X(n.x), Y(n.y)); ctx.lineTo(X(est.x), Y(est.y)); ctx.stroke();
    }
    ctx.setLineDash([]);

    // nodes
    for (const n of NODES) {
      const on = hearing.includes(n);
      if (on) {
        const ph = (t * 0.9 + n.x * 0.001) % 1;
        ctx.strokeStyle = `rgba(255,181,71,${0.55 * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(X(n.x), Y(n.y), (8 + ph * 46) * view.s, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = on ? "#ffb547" : "#56616c";
      ctx.beginPath(); ctx.arc(X(n.x), Y(n.y), 3.6 * view.s, 0, Math.PI * 2); ctx.fill();
    }

    // radar head
    ctx.fillStyle = "#7fb2ff"; ctx.fillRect(X(RADAR.x) - 4, Y(RADAR.y) - 4, 8, 8);
    ctx.font = `500 ${Math.max(9, Math.round(10 * view.s))}px 'IBM Plex Mono', monospace`; ctx.fillStyle = "rgba(127,178,255,0.8)"; ctx.fillText("RADAR", X(RADAR.x) - 2, Y(RADAR.y) + 20);
    ctx.fillStyle = "rgba(139,150,161,0.8)"; NODES.forEach((n, k) => ctx.fillText(`N${k + 1}`, X(n.x) + 8, Y(n.y) + 14));

    // trail
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], age = (t - b.t) / 7;
      ctx.strokeStyle = b.src === "radar" ? `rgba(127,178,255,${0.9 * (1 - age)})` : `rgba(255,181,71,${0.9 * (1 - age)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
    }
    ctx.lineWidth = 1;

    // uncertainty + track symbol
    const color = src === "radar" ? "#7fb2ff" : "#ffb547";
    ctx.strokeStyle = color; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(X(est.x), Y(est.y), (sigma * 1.6 + 4) * view.s, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    const s = 7;
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(X(est.x), Y(est.y) - s); ctx.lineTo(X(est.x) + s, Y(est.y)); ctx.lineTo(X(est.x), Y(est.y) + s); ctx.lineTo(X(est.x) - s, Y(est.y)); ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.font = `500 ${Math.max(10, Math.round(12 * view.s))}px 'IBM Plex Mono', monospace`; ctx.fillStyle = color;
    ctx.fillText(`TRK-01 · ${src === "radar" ? "RADAR" : "ACOUSTIC"}`, X(est.x) + 12, Y(est.y) - 10);

    if (seen) { ctx.fillStyle = "rgba(127,178,255,0.9)"; ctx.beginPath(); ctx.arc(X(d.x), Y(d.y), 2.2, 0, Math.PI * 2); ctx.fill(); }

    if (tms - lastRO > 200 || src !== lastSrc) {
      lastRO = tms; lastSrc = src;
      ro.src.textContent = src === "radar" ? "Radar" : "Acoustic";
      ro.src.className = src === "radar" ? "src-radar" : "src-acoustic";
      ro.nodes.textContent = `${hearing.length} / ${NODES.length}`;
      ro.radar.textContent = seen ? "Contact" : "No line of sight";
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  new ResizeObserver(resize).observe(canvas);
  if (reduce) frame((segLen[0] + 60) / SPEED * 1000); else requestAnimationFrame(frame);

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
