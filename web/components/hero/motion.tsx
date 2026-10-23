"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/components/ui";

const REDUCE = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

const prefersReduced = () => typeof window !== "undefined" && window.matchMedia(REDUCE).matches;

/** Fades children up 8px the first time they scroll into view (design.md: 60ms stagger via `delay`). */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.shown = "1";
        io.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx("cp-reveal", className)} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/** Drifts its children against the scroll by `speed` × distance from the viewport centre. */
export function Parallax({ children, speed = 0.06, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    let raf = 0;
    let near = false;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const off = (r.top + r.height / 2 - window.innerHeight / 2) * -speed;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (near && !raf) raf = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        onScroll();
      },
      { rootMargin: "25% 0px" },
    );
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [speed]);
  return (
    <div ref={ref} className={cx("will-change-transform", className)}>
      {children}
    </div>
  );
}

const fmtInt = (x: number) => Math.round(x).toLocaleString("en-US");

/** Counts up to `value` (600ms) when first visible, and from the old value when it changes. `format` must be stable. */
export function CountUp({ value, format = fmtInt }: { value: number | null; format?: (x: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || value === null) return;
    const start = from.current;
    if (prefersReduced() || start === value) {
      el.textContent = format(value);
      from.current = value;
      return;
    }
    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - t0) / 600, 1);
        const e = 1 - (1 - t) ** 3;
        el.textContent = format(start + (value - start) * e);
        if (t < 1) raf = requestAnimationFrame(step);
        else from.current = value;
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      run();
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, format]);
  return (
    <span ref={ref} className="tnum">
      {value === null ? "—" : format(0)}
    </span>
  );
}
