"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { FrameManifest, HeroStore } from "./types";

const frameUrl = (m: FrameManifest, i: number) =>
  m.pattern.replace(/%0?(\d*)d/, (_, pad: string) => String(i + (m.start ?? 1)).padStart(Number(pad) || 0, "0"));

/**
 * Apple-style scroll scrubbing over a pre-rendered frame sequence (e.g. a Google Flow clip run through
 * scripts/flow-to-frames.sh). Frame 0 loads first, the rest stream in; until a frame arrives the nearest loaded one is drawn.
 */
export default function FrameSequence({ manifest, store }: { manifest: FrameManifest; store: RefObject<HeroStore> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const n = manifest.count;
    const images: (HTMLImageElement | null)[] = new Array(n).fill(null);
    let cancelled = false;
    let drawn = -1;
    let dirty = true;

    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.src = frameUrl(manifest, i);
        img.onload = () => {
          if (!cancelled) {
            images[i] = img;
            dirty = true;
          }
          resolve();
        };
        img.onerror = () => resolve();
      });

    (async () => {
      await load(0);
      let next = 1;
      const worker = async () => {
        while (!cancelled && next < n) await load(next++);
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    })();

    const nearest = (i: number) => {
      for (let d = 0; d < n; d++) {
        if (images[i - d]) return i - d;
        if (images[i + d]) return i + d;
      }
      return -1;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    let onScreen = true;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const want = Math.round(store.current.value * (n - 1));
      const k = nearest(want);
      if (k < 0 || (k === drawn && !dirty)) return;
      const img = images[k]!;
      const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      drawn = k;
      dirty = false;
      canvas.dataset.ready = "1";
    };
    const start = () => {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      cancelled = true;
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [manifest, store]);

  return <canvas ref={ref} aria-hidden className="cp-hero-canvas absolute inset-0 block h-full w-full" />;
}
