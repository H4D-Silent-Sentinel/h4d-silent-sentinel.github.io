// Diagrams: scan-in reveal, packets moving along links at their real rates, and a
// tooltip with each link's protocol and rate. A link is marked in the SVG with
// data-link="Label" and optionally data-hz (packets per second); data-rev reverses flow.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const figs = [...document.querySelectorAll("figure.diagram, .tile.diagram")];

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("scanned"); io.unobserve(e.target); } }), { threshold: .25 });
  figs.forEach(f => { f.classList.add("scan"); io.observe(f); });

  const tip = document.createElement("div"); tip.className = "link-tip"; tip.hidden = true; document.body.appendChild(tip);

  for (const svg of document.querySelectorAll(".diagram svg")) {
    for (const el of svg.querySelectorAll("[data-link]")) {
      const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map(a => +el.getAttribute(a));
      const [ax, ay, bx, by] = el.hasAttribute("data-rev") ? [x2, y2, x1, y1] : [x1, y1, x2, y2];
      const color = getComputedStyle(el).stroke;
      // wide invisible hit area for the tooltip
      const hit = document.createElementNS(NS, "line");
      Object.entries({ x1, y1, x2, y2, class: "hit" }).forEach(([k, v]) => hit.setAttribute(k, v));
      el.after(hit);
      hit.addEventListener("pointerenter", () => { tip.textContent = el.dataset.link; tip.hidden = false; el.classList.add("hot"); });
      hit.addEventListener("pointermove", e => { tip.style.left = e.clientX + 14 + "px"; tip.style.top = e.clientY + 14 + "px"; });
      hit.addEventListener("pointerleave", () => { tip.hidden = true; el.classList.remove("hot"); });
      if (reduce) continue;
      // packets: N in flight, each crossing in `travel` s, spaced so the arrival rate is data-hz
      const hz = +el.dataset.hz || 1, travel = Math.max(0.6, Math.min(1.6, Math.hypot(bx - ax, by - ay) / 160));
      const n = Math.max(1, Math.round(hz * travel));
      for (let k = 0; k < n; k++) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("r", "3.2"); c.setAttribute("class", "pkt"); c.style.fill = color; c.style.color = color;
        const m = document.createElementNS(NS, "animateMotion");
        m.setAttribute("dur", (n / hz).toFixed(3) + "s");
        m.setAttribute("begin", (-k / hz).toFixed(3) + "s");
        m.setAttribute("repeatCount", "indefinite");
        m.setAttribute("keyPoints", "0;1;1"); m.setAttribute("keyTimes", `0;${Math.min(.999, travel / (n / hz)).toFixed(3)};1`); m.setAttribute("calcMode", "linear");
        m.setAttribute("path", `M${ax},${ay} L${bx},${by}`);
        const o = document.createElementNS(NS, "animate");
        o.setAttribute("attributeName", "opacity"); o.setAttribute("calcMode", "discrete");
        o.setAttribute("values", "1;0"); o.setAttribute("keyTimes", `0;${Math.min(.999, travel / (n / hz)).toFixed(3)}`);
        o.setAttribute("dur", m.getAttribute("dur")); o.setAttribute("begin", m.getAttribute("begin")); o.setAttribute("repeatCount", "indefinite");
        c.append(m, o); hit.before(c);
      }
    }
  }
})();
