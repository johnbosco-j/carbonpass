"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createHeroScene, type HeroScene } from "./scene/create-scene";
import type { HeroStore } from "./types";

/** WebGL layer of the hero. Loaded with next/dynamic (ssr: false); renders only while on screen. */
export default function SceneCanvas({ store, onFail }: { store: RefObject<HeroStore>; onFail: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    // A fresh canvas per mount: a disposed renderer leaves its canvas with a lost context (Strict Mode remounts).
    const canvas = document.createElement("canvas");
    canvas.className = "cp-hero-canvas absolute inset-0 block h-full w-full";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);
    const small = window.matchMedia("(max-width: 640px)").matches;
    let scene: HeroScene;
    try {
      scene = createHeroScene(canvas, { particles: small ? 2800 : 5600, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });
    } catch {
      canvas.remove();
      onFail();
      return;
    }

    let raf = 0;
    let last = 0;
    let onScreen = true;
    let shown = false;
    const draw = (dt: number) => {
      const s = store.current;
      scene.frame(s.value, s.px, s.py, dt);
      if (!shown) {
        shown = true;
        canvas.dataset.ready = "1";
      }
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      draw(Math.min((now - last) / 1000, 0.05));
      last = now;
    };
    const start = () => {
      if (raf || !onScreen || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    scene.resize(box.clientWidth, box.clientHeight);
    const ro = new ResizeObserver(() => {
      scene.resize(box.clientWidth, box.clientHeight);
      draw(0);
    });
    ro.observe(box);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      onFail();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    document.fonts?.ready.then(() => scene.refreshText());

    if (process.env.NODE_ENV !== "production") {
      // Dev-only: render progress p synchronously (intro finished); with `capture` returns a WebP data URL.
      // Used to export the reduced-motion poster and to check frames when rAF is throttled.
      (window as unknown as { __hero?: (p: number, capture?: boolean) => string | void }).__hero = (p, capture) => {
        store.current.value = p;
        store.current.target = p;
        scene.frame(p, 0, 0, 3);
        scene.frame(p, 0, 0, 0.016);
        canvas.dataset.ready = "1";
        if (capture) return canvas.toDataURL("image/webp", 0.8);
      };
    }

    start();
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      scene.dispose();
      canvas.remove();
    };
  }, [store, onFail]);

  return <div ref={ref} className="absolute inset-0" />;
}
