"use client";

import { useEffect } from "react";

export default function Interactions() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const cleanups: Array<() => void> = [];

    // hero entrance
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.body.classList.add("ready"))
    );

    // marquee build
    const words = ["Regate", "Caño", "Sombrero", "Gambeta", "Túnel", "Rabona", "Pared", "Chilena", "Amago", "Bicicleta"];
    const track = document.getElementById("mqTrack");
    if (track) {
      let html = "";
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < words.length; i++) {
          const cls = i % 3 === 0 ? "ac" : i % 3 === 1 ? "out" : "";
          html += `<b class="${cls}">${words[i]}</b><em>/</em>`;
        }
      }
      track.innerHTML = html;
    }

    // custom cursor (hover + fine pointer only)
    if (window.matchMedia("(hover:hover) and (pointer:fine)").matches && !reduce) {
      document.body.classList.add("has-cursor");
      const cur = document.querySelector<HTMLElement>(".cursor");
      const dot = document.querySelector<HTMLElement>(".cursor-dot");
      let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my, raf = 0;
      const onMove = (e: MouseEvent) => {
        mx = e.clientX;
        my = e.clientY;
        if (dot) dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      };
      window.addEventListener("mousemove", onMove, { passive: true });
      const loop = () => {
        cx += (mx - cx) * 0.18;
        cy += (my - cy) * 0.18;
        if (cur) cur.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
        raf = requestAnimationFrame(loop);
      };
      loop();
      const hot = () => cur?.classList.add("hot");
      const cold = () => cur?.classList.remove("hot");
      const targets = Array.from(document.querySelectorAll("a,button,input,[data-mag]"));
      targets.forEach((el) => {
        el.addEventListener("mouseenter", hot);
        el.addEventListener("mouseleave", cold);
      });
      cleanups.push(() => {
        window.removeEventListener("mousemove", onMove);
        cancelAnimationFrame(raf);
        targets.forEach((el) => {
          el.removeEventListener("mouseenter", hot);
          el.removeEventListener("mouseleave", cold);
        });
        document.body.classList.remove("has-cursor");
      });
    }

    // magnetic buttons
    if (window.matchMedia("(hover:hover)").matches && !reduce) {
      const mags = Array.from(document.querySelectorAll<HTMLElement>("[data-mag]"));
      mags.forEach((btn) => {
        const move = (e: MouseEvent) => {
          const r = btn.getBoundingClientRect();
          const x = e.clientX - r.left - r.width / 2;
          const y = e.clientY - r.top - r.height / 2;
          btn.style.transform = `translate(${x * 0.3}px,${y * 0.4}px)`;
        };
        const leave = () => (btn.style.transform = "");
        btn.addEventListener("mousemove", move);
        btn.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          btn.removeEventListener("mousemove", move);
          btn.removeEventListener("mouseleave", leave);
        });
      });
    }

    // nav stuck
    const nav = document.getElementById("nav");
    const navState = () => nav?.classList.toggle("stuck", window.scrollY > 40);
    window.addEventListener("scroll", navState, { passive: true });
    navState();
    cleanups.push(() => window.removeEventListener("scroll", navState));

    // reveals
    const rvs = Array.from(document.querySelectorAll<HTMLElement>(".rv"));
    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.16 }
      );
      rvs.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    } else {
      rvs.forEach((el) => el.classList.add("in"));
    }

    // count up
    let counted = false;
    const runCounters = () => {
      if (counted) return;
      const s = document.querySelector(".stats");
      if (!s) return;
      if (s.getBoundingClientRect().top < innerHeight * 0.85) {
        counted = true;
        document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
          const t = +(el.getAttribute("data-count") || "0");
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / 900, 1);
            el.textContent = String(Math.round(t * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }
    };

    // parallax + pinned pillars
    const pars = Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
    const wrap = document.getElementById("pilares");
    const panels = Array.from(document.querySelectorAll<HTMLElement>(".panel"));
    const railBtns = Array.from(document.querySelectorAll<HTMLElement>("#pinRail button"));
    let vh = innerHeight, ticking = false, active = -1;
    const setActive = (i: number) => {
      if (i === active) return;
      active = i;
      panels.forEach((p, idx) => p.classList.toggle("on", idx === i));
      railBtns.forEach((b, idx) => b.classList.toggle("on", idx === i));
    };
    const apply = () => {
      const y = window.scrollY;
      for (const el of pars) {
        const sp = parseFloat(el.getAttribute("data-par") || "0");
        const rr = el.getBoundingClientRect();
        const rel = rr.top + rr.height / 2 - vh / 2;
        el.style.transform = `translate3d(0,${(rel * sp).toFixed(1)}px,0)`;
      }
      if (wrap) {
        const prog = (y - wrap.offsetTop) / (wrap.offsetHeight - vh);
        setActive(Math.floor(Math.max(0, Math.min(0.999, prog)) * panels.length));
      }
      runCounters();
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };
    const onResize = () => {
      vh = innerHeight;
      apply();
    };
    if (!reduce) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      cleanups.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      });
    } else {
      setActive(0);
    }
    apply();
    railBtns.forEach((b) => {
      const go = () => {
        const i = +(b.getAttribute("data-go") || "0");
        if (wrap) {
          window.scrollTo({
            top: wrap.offsetTop + (wrap.offsetHeight - vh) * ((i + 0.5) / panels.length),
            behavior: "smooth",
          });
        }
      };
      b.addEventListener("click", go);
      cleanups.push(() => b.removeEventListener("click", go));
    });

    // forms (client-side only, prototype)
    const wire = (id: string, done: (f: HTMLFormElement) => void) => {
      const f = document.getElementById(id) as HTMLFormElement | null;
      if (!f) return;
      const onSubmit = (ev: Event) => {
        ev.preventDefault();
        const inp = f.querySelector<HTMLInputElement>("input[type=email]");
        if (inp && (!inp.value || !inp.validity.valid)) {
          inp.reportValidity();
          return;
        }
        done(f);
      };
      f.addEventListener("submit", onSubmit);
      cleanups.push(() => f.removeEventListener("submit", onSubmit));
    };
    wire("heroForm", (f) => {
      const span = f.querySelector<HTMLElement>("button span") || f.querySelector("button");
      if (span) span.textContent = "¡Apuntado! ⚡";
      const btn = f.querySelector("button");
      if (btn) btn.disabled = true;
      const inp = f.querySelector("input");
      if (inp) inp.disabled = true;
    });
    wire("accessForm", (f) => {
      f.style.display = "none";
      document.getElementById("accessOk")?.classList.add("show");
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
