/* ============================================================
   PROVENANCE landing — motion
   Lenis smooth scroll + GSAP ScrollTrigger
============================================================ */
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !window.gsap) { document.body.classList.add("no-js"); return; }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis smooth scroll ---------- */
  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.05 });
  window.lenis = lenis;
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // anchor links through lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        lenis.scrollTo(id, { offset: 0, duration: 1.4 });
      }
    });
  });

  /* ---------- nav hide/show ---------- */
  const nav = document.getElementById("nav");
  let lastY = 0;
  lenis.on("scroll", ({ scroll }) => {
    nav.classList.toggle("nav-hidden", scroll > lastY && scroll > 140);
    lastY = scroll;
  });

  const EASE = "expo.out";

  /* ---------- hero intro timeline ---------- */
  const intro = gsap.timeline({ defaults: { ease: EASE } });
  intro
    .from(".hero h1 .line > span", { yPercent: 110, duration: 1.4, stagger: 0.12 }, 0.15)
    .to(".hero .eyebrow", { opacity: 1, y: 0, duration: 1 }, 0.5)
    .to(".hero .sub", { opacity: 1, y: 0, duration: 1 }, 0.65)
    .to(".hero .cta-row", { opacity: 1, y: 0, duration: 1 }, 0.8)
    .from(".hero-seal", { scale: 0.85, opacity: 0, rotate: -14, duration: 1.8, ease: "power3.out" }, 0.3)
    .from("nav .inner", { y: -24, opacity: 0, duration: 1 }, 0.9);

  /* hero seal parallax */
  gsap.to(".hero-seal", {
    yPercent: 26, rotate: 10, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  /* hero headline drifts up slightly faster than scroll */
  gsap.to(".hero h1", {
    yPercent: -18, opacity: 0.25, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 30%", scrub: true },
  });

  /* ---------- generic reveals ---------- */
  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.closest(".hero")) return; // hero handled by intro
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.2, ease: EASE,
      scrollTrigger: { trigger: el, start: "top 86%" },
    });
  });

  /* line-mask reveals (manifesto + footer) */
  document.querySelectorAll(".reveal-lines, .footer-cta").forEach((block) => {
    gsap.from(block.querySelectorAll(".line > span"), {
      yPercent: 110, duration: 1.3, stagger: 0.1, ease: EASE,
      scrollTrigger: { trigger: block, start: "top 82%" },
    });
  });

  /* ---------- 03 · dossier cards ---------- */
  gsap.from(".dossier-card", {
    y: 90, opacity: 0, duration: 1.3, stagger: 0.12, ease: EASE,
    scrollTrigger: { trigger: ".dossier-grid", start: "top 80%" },
  });

  /* score counters */
  document.querySelectorAll(".count").forEach((el) => {
    const target = parseFloat(el.dataset.target);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.8, ease: "power2.out",
      onUpdate: () => { el.textContent = obj.v.toFixed(1); },
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  /* coin micro-tilt on pointer */
  document.querySelectorAll(".dossier-card").forEach((card) => {
    const coin = card.querySelector(".coin");
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(coin, { x: dx * 14, y: dy * 14, duration: 0.5, ease: "power2.out" });
      gsap.to(card, { y: -6, duration: 0.4, ease: "power2.out" });
    });
    card.addEventListener("pointerleave", () => {
      gsap.to(coin, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.5)" });
      gsap.to(card, { y: 0, duration: 0.6, ease: "power2.out" });
    });
  });

  /* ghost letters parallax */
  document.querySelectorAll(".ghost-letter").forEach((g) => {
    gsap.fromTo(g, { yPercent: 18 }, {
      yPercent: -14, ease: "none",
      scrollTrigger: { trigger: g.parentElement, start: "top bottom", end: "bottom top", scrub: true },
    });
  });

  /* ---------- 04 · bento ---------- */
  gsap.from(".cell", {
    y: 50, opacity: 0, duration: 1.1, stagger: 0.09, ease: EASE,
    scrollTrigger: { trigger: ".bento", start: "top 82%" },
  });
  document.querySelectorAll(".cell").forEach((cell) => {
    const w = cell.style.getPropertyValue("--w");
    gsap.to(cell.querySelector(".cell-bar"), {
      width: `${w * 4}%`, duration: 1.4, ease: EASE,
      scrollTrigger: { trigger: cell, start: "top 80%" },
    });
  });

  /* ---------- 05 · terminal card ---------- */
  gsap.to(".reveal-card", {
    opacity: 1, y: 0, rotate: 0, duration: 1.4, ease: EASE,
    scrollTrigger: { trigger: ".terminal", start: "top 82%" },
  });
  /* type-in effect for terminal rows */
  gsap.from(".registry .term-body p", {
    opacity: 0, x: -14, duration: 0.6, stagger: 0.1, ease: "power2.out",
    scrollTrigger: { trigger: ".registry .term-body", start: "top 78%" },
  });

  /* ---------- 06 · validation marks ---------- */
  const proofTl = gsap.timeline({
    scrollTrigger: { trigger: ".proof", start: "top 75%" },
    defaults: { ease: EASE },
  });
  proofTl
    .from(".proof-text", { opacity: 0, y: 40, duration: 1.1 })
    .add(() => {
      document.querySelectorAll(".proof-text mark").forEach((m, i) => {
        setTimeout(() => m.classList.add("show-note"), i * 220);
        setTimeout(() => m.classList.remove("show-note"), i * 220 + 2400);
      });
    }, "-=0.2")
    .from(".proof-rule", { scaleX: 0, transformOrigin: "left", duration: 1 }, "-=0.5")
    .from(".proof-caption", { opacity: 0, y: 16, duration: 0.8 }, "-=0.6");

  /* ---------- 07 · surfaces stack ---------- */
  const stackCards = gsap.utils.toArray(".ui-card");
  gsap.from(stackCards, {
    y: 110, opacity: 0, duration: 1.3, stagger: 0.15, ease: EASE,
    scrollTrigger: { trigger: ".stack", start: "top 80%" },
  });
  /* depth parallax inside stack */
  stackCards.forEach((card) => {
    const depth = Number(card.dataset.depth || 1);
    gsap.to(card, {
      y: depth * -26, ease: "none",
      scrollTrigger: { trigger: ".stack", start: "top bottom", end: "bottom top", scrub: true },
    });
  });

  /* ---------- 08 · footer ---------- */
  gsap.from(".footer-rule", {
    scaleX: 0, transformOrigin: "left", duration: 1.4, ease: EASE,
    scrollTrigger: { trigger: ".footer-rule", start: "top 90%" },
  });
  gsap.from(".footer-grid > *", {
    y: 30, opacity: 0, duration: 1, stagger: 0.08, ease: EASE,
    scrollTrigger: { trigger: ".footer-grid", start: "top 92%" },
  });
})();
