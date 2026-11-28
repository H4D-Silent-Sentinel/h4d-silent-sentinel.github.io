// Briefing deck: scales 1600x900 slides, imports shared figures from the home page,
// numbers slides, and runs present mode (fullscreen, one slide, arrow keys).
(() => {
  const deck = document.querySelector(".deck");
  const slides = [...deck.querySelectorAll(".sl")];
  slides.forEach((s, i) => { const n = document.createElement("div"); n.className = "num"; n.textContent = `${i + 1} / ${slides.length}`; s.querySelector(".in").appendChild(n); });

  // shared figures: <div class="imp" data-import="#system figure.diagram" data-wrap="system">
  const imps = [...deck.querySelectorAll("[data-import]")];
  if (imps.length) fetch("../index.html").then(r => r.text()).then(html => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const el of imps) {
      const src = doc.querySelector(el.dataset.import); if (!src) continue;
      const node = document.importNode(src, true);
      node.querySelectorAll("a[href^='#']").forEach(a => a.setAttribute("href", "../index.html" + a.getAttribute("href")));
      const w = document.createElement("div"); w.className = el.dataset.wrap || ""; w.appendChild(node); el.appendChild(w);
      // shrink to fit the slide body (slide units, independent of window size)
      if (node.classList.contains("mmc")) {
        node.style.height = "auto"; node.style.transformOrigin = "0 0";
        // largest scale at which the widened canvas still fits the slide body
        let k = 1;
        for (; k > 0.4; k -= 0.01) {
          node.style.width = `${100 / k}%`;
          if (node.scrollHeight * k <= el.clientHeight) break;
        }
        node.style.transform = `scale(${k})`;
      }
    }
  });

  const fit = () => {
    const present = deck.classList.contains("present");
    for (const s of slides) {
      const inn = s.querySelector(".in");
      if (present) {
        const k = Math.min(innerWidth / 1600, innerHeight / 900);
        Object.assign(s.style, { width: 1600 * k + "px", height: 900 * k + "px", left: (innerWidth - 1600 * k) / 2 + "px", top: (innerHeight - 900 * k) / 2 + "px" });
        inn.style.transform = `scale(${k})`;
      } else {
        s.style.cssText = "";
        inn.style.transform = `scale(${s.clientWidth / 1600})`;
      }
    }
  };
  addEventListener("resize", fit); new ResizeObserver(fit).observe(deck);

  let cur = 0;
  const show = i => {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => s.classList.toggle("on", k === cur));
    history.replaceState(null, "", `#${cur + 1}`);
  };
  const enter = () => {
    const vis = slides.findIndex(s => s.getBoundingClientRect().bottom > innerHeight * .4);
    deck.classList.add("present"); show(location.hash.match(/^#\d+$/) ? +location.hash.slice(1) - 1 : Math.max(0, vis)); fit();
    deck.requestFullscreen?.().catch(() => {});
  };
  const exit = () => {
    deck.classList.remove("present"); fit();
    if (document.fullscreenElement) document.exitFullscreen();
    slides[cur].scrollIntoView({ block: "center" });
  };
  document.getElementById("present").addEventListener("click", enter);
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && deck.classList.contains("present")) exit(); fit(); });
  document.addEventListener("keydown", e => {
    if (!deck.classList.contains("present")) { if (e.key === "p" || e.key === "P") enter(); return; }
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); show(cur + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); show(cur - 1); }
    else if (e.key === "Home") show(0); else if (e.key === "End") show(slides.length - 1);
    else if (e.key === "Escape") exit();
    else if (e.key === "f" || e.key === "F") deck.requestFullscreen?.().catch(() => {});
  });
  deck.addEventListener("click", e => {
    if (!deck.classList.contains("present") || e.target.closest("a, iframe, video, button")) return;
    show(cur + (e.clientX > innerWidth / 3 ? 1 : -1));
  });

  // prior weeks
  const arch = document.getElementById("archive");
  if (arch) fetch("../data/briefings.json").then(r => r.json()).then(b => {
    arch.innerHTML = b.items.slice().sort((x, y) => y.date.localeCompare(x.date)).map(i => {
      const g = `https://docs.google.com/presentation/d/${i.id}`;
      const page = i.page ? `<a href="../${i.page}">Web</a>` : "";
      return `<li><span>${i.title}</span>${page}<a href="${g}/present" target="_blank" rel="noopener">Google Slides</a></li>`;
    }).join("");
  });

  fit();
})();
