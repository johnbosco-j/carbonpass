"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CUT_PCT, HERO, RATIO, SAVING_2026, fmtCn } from "./data";
import { useReducedMotion } from "./motion";
import { BEATS, T, activeBeat, beatVisibility, clamp01, lerp, seg, smooth } from "./timeline";
import type { FrameManifest, HeroStore } from "./types";

const SceneCanvas = dynamic(() => import("./scene-canvas"), { ssr: false });
const FrameSequence = dynamic(() => import("./frame-sequence"), { ssr: false });

const TICKS = ["Carbon price", "Default vs verified", "Conservation", "Run it"];
const HEADLINE = "Since 1 January 2026, every tonne of steel entering the EU carries a carbon price.";
const [IMP_A, IMP_B] = HERO.importers;
const fmtT = (x: number) => x.toLocaleString("en-US");
const SHIP_A = 6000;
const SHIP_B = HERO.tonnes - SHIP_A;

export function Hero({ frames }: { frames: FrameManifest | null }) {
  const reduced = useReducedMotion();
  return reduced ? <StaticHero frames={frames} /> : <ScrollHero frames={frames} />;
}

/* ------------------------------------------------------------------ pinned scroll story */

function ScrollHero({ frames }: { frames: FrameManifest | null }) {
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const store = useRef<HeroStore>({ target: 0, value: 0, px: 0, py: 0 });
  const [webglFailed, setWebglFailed] = useState(false);
  const onFail = useCallback(() => setWebglFailed(true), []);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    let top = 0;
    let range = 1;
    let raf = 0;
    let last = 0;
    let lastBeat = -1;
    const beats = Array.from(stage.querySelectorAll<HTMLElement>(".cp-beat"));

    const apply = (p: number) => {
      beats.forEach((el, i) => {
        const v = beatVisibility(p, i);
        el.style.opacity = v.opacity.toFixed(3);
        el.style.setProperty("--shift", `${v.shift.toFixed(1)}px`);
        el.style.pointerEvents = v.opacity > 0.5 ? "auto" : "none";
      });
      const keep = smooth(seg(p, T.keepFrom, T.keepTo));
      stage.style.setProperty("--p", p.toFixed(4));
      stage.style.setProperty("--keep", keep.toFixed(4));
      stage.style.setProperty("--ship", smooth(seg(p, 0.56, 0.64)).toFixed(4));
      if (valueRef.current) valueRef.current.textContent = lerp(HERO.defaultT, HERO.verifiedT, keep).toFixed(3);
      stage.dataset.revert = p > T.revertAt ? "1" : "0";
      const b = activeBeat(p);
      if (b !== lastBeat) {
        lastBeat = b;
        stage.dataset.beat = String(b);
      }
    };

    const tick = (now: number) => {
      const s = store.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      s.value += (s.target - s.value) * (1 - Math.exp(-dt * 7));
      if (Math.abs(s.target - s.value) < 0.0003) s.value = s.target;
      apply(s.value);
      raf = s.value === s.target ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      store.current.target = clamp01((window.scrollY - top) / range);
      kick();
    };
    const measure = () => {
      top = track.getBoundingClientRect().top + window.scrollY;
      range = Math.max(track.offsetHeight - window.innerHeight, 1);
      onScroll();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const px = (e.clientX / window.innerWidth) * 2 - 1;
      const py = (e.clientY / window.innerHeight) * 2 - 1;
      store.current.px = px;
      store.current.py = py;
      stage.style.setProperty("--mx", px.toFixed(3));
      stage.style.setProperty("--my", py.toFixed(3));
    };
    // Keyboard users tabbing into a beat (e.g. the CTA) get scrolled to where that beat is visible.
    const onFocus = (e: FocusEvent) => {
      const i = beats.findIndex((el) => el.contains(e.target as Node));
      if (i < 0) return;
      const b = BEATS[i];
      const want = i === BEATS.length - 1 ? 1 : (b.start + b.end) / 2;
      if (Math.abs(store.current.target - want) > 0.08) window.scrollTo({ top: top + want * range });
    };

    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pointermove", onPointer, { passive: true });
    stage.addEventListener("focusin", onFocus);
    measure();
    store.current.value = store.current.target;
    apply(store.current.value);
    if (process.env.NODE_ENV !== "production") {
      // Dev-only: jump the copy layers to progress p without waiting for rAF.
      (window as unknown as { __heroDom?: (p: number) => void }).__heroDom = (p) => {
        window.scrollTo({ top: top + p * range, behavior: "instant" });
        store.current.target = store.current.value = p;
        apply(p);
      };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onPointer);
      stage.removeEventListener("focusin", onFocus);
    };
  }, []);

  return (
    <section ref={trackRef} className="cp-hero cp-bleed relative" aria-label="CarbonPass: the story in four steps">
      <div ref={stageRef} className="cp-stage sticky top-0 h-[100svh] overflow-hidden" data-beat="0" data-revert="0">
        <a href="#landing" className="cp-skip">
          Skip the intro
        </a>
        {/* back layer: real-time scene, or the Flow frame sequence when one has been dropped in */}
        <div className="cp-layer-back absolute inset-0">
          {frames ? (
            <FrameSequence manifest={frames} store={store} />
          ) : webglFailed ? (
            <Poster />
          ) : (
            <SceneCanvas store={store} onFail={onFail} />
          )}
        </div>
        <div className="cp-scrim pointer-events-none absolute inset-0" />

        {/* fore layer: registration marks and progress ledger, moving faster than the copy */}
        <div className="cp-layer-fore pointer-events-none absolute inset-0" aria-hidden>
          <span className="cp-reg cp-reg-tl" />
          <span className="cp-reg cp-reg-tr" />
          <span className="cp-reg cp-reg-bl" />
          <span className="cp-reg cp-reg-br" />
          <div className="cp-hud-route absolute font-mono">
            {HERO.installationCode} · {HERO.product} · CN {fmtCn(HERO.cnCode)}
            <br />
            {HERO.city} TR → {IMP_A.city} {IMP_A.country} / {IMP_B.city} {IMP_B.country}
          </div>
          <ol className="cp-ticks absolute">
            {TICKS.map((t, i) => (
              <li key={t} data-i={i}>
                <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="cp-tick-label">{t}</span>
              </li>
            ))}
          </ol>
          <div className="cp-scroll-cue absolute font-mono">Scroll</div>
        </div>

        {/* mid layer: the four beats */}
        <div className="cp-layer-mid absolute inset-0">
          <div className="mx-auto flex h-full max-w-[1200px] px-4 sm:px-6">
            <div className="cp-copy relative w-full">
              <div className="cp-beat">
                <div className="cp-label">EU CBAM · definitive period</div>
                <h1 className="cp-display mt-4">
                  {HEADLINE.split(" ").map((w, i) => (
                    <Fragment key={i}>
                      <span className="cp-word" style={{ "--i": i } as CSSProperties}>
                        {w}
                      </span>{" "}
                    </Fragment>
                  ))}
                </h1>
                <p className="cp-sub mt-5">
                  The proof of how clean that steel is still travels by email. CarbonPass turns it into a verified carbon passport that can&apos;t be
                  counted twice.
                </p>
              </div>

              <div className="cp-beat" style={{ opacity: 0 }}>
                <div className="cp-label">Same coil · two prices at the border</div>
                <div className="mt-5 space-y-5">
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="cp-row-label">EU default value · Türkiye · CN {fmtCn(HERO.cnCode).slice(0, 4)}</span>
                      <span className="cp-num-sm font-mono tnum">
                        {HERO.defaultT.toFixed(2)} <span className="cp-unit">tCO₂e/t</span>
                      </span>
                    </div>
                    <div className="cp-bar mt-2">
                      <span className="cp-bar-default" />
                    </div>
                    <p className="cp-note mt-1.5">+{Math.round(HERO.markup2026 * 100)}% mark-up on top in 2026</p>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="cp-row-label">Verified actual · {HERO.installation}</span>
                    </div>
                    <div className="cp-num-lg mt-1 font-mono tnum">
                      <span ref={valueRef}>{HERO.defaultT.toFixed(3)}</span> <span className="cp-unit">tCO₂e/t</span>
                    </div>
                    <div className="cp-bar mt-2">
                      <span className="cp-bar-verified" style={{ "--ratio": RATIO } as CSSProperties} />
                    </div>
                    <p className="cp-note mt-1.5">fictional demo entity · EAF mill, {HERO.period}</p>
                  </div>
                </div>
                <p className="cp-sub mt-6">
                  <span className="font-mono tnum">−{CUT_PCT}%</span> embedded emissions on the declaration. About{" "}
                  <span className="font-mono tnum">{SAVING_2026}</span> less in CBAM certificates for one month&apos;s output this year.
                </p>
              </div>

              <div className="cp-beat" style={{ opacity: 0 }}>
                <div className="cp-label">ERC-1155 · conservation rule</div>
                <h2 className="cp-display mt-4">Double counting: impossible.</h2>
                <p className="cp-sub mt-4">
                  Enforced by the contract, not by a promise. {fmtT(HERO.tonnes)} verified tonnes are minted once. Ship them to two importers and the
                  batch is empty.
                </p>
                <div className="cp-gauge mt-6" aria-label={`${fmtT(HERO.tonnes)} tonnes: ${fmtT(SHIP_A)} to ${IMP_A.city}, ${fmtT(SHIP_B)} to ${IMP_B.city}`}>
                  <span className="cp-gauge-a" style={{ "--w": SHIP_A / HERO.tonnes } as CSSProperties} />
                  <span className="cp-gauge-b" style={{ "--w": SHIP_B / HERO.tonnes } as CSSProperties} />
                </div>
                <div className="cp-note mt-2 flex justify-between gap-3 font-mono tnum">
                  <span>
                    {fmtT(SHIP_A)} t → {IMP_A.city}
                  </span>
                  <span>
                    {fmtT(SHIP_B)} t → {IMP_B.city}
                  </span>
                </div>
                <div className="cp-revert mt-5" role="status">
                  <span className="cp-revert-x" aria-hidden>
                    ✕
                  </span>
                  <div>
                    <div className="font-semibold">Rejected by contract</div>
                    <div className="font-mono text-[0.78rem] tnum">ERC1155InsufficientBalance · 2,000 t requested, 0 t remaining</div>
                  </div>
                </div>
              </div>

              <div className="cp-beat" style={{ opacity: 0 }}>
                <div className="cp-label">Verified · signed · conserved</div>
                <h2 className="cp-display mt-4">Clean steel shouldn&apos;t pay for dirty defaults.</h2>
                <p className="cp-sub mt-4">
                  Drop in a mill&apos;s invoices, let AI extract the numbers, sign as an accredited verifier, mint, ship, and try to sell the same tonnes
                  twice. Live on the Sepolia testnet.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/producer" className="cp-btn-primary">
                    Run the demo →
                  </Link>
                  <Link href="/passport" className="cp-btn-ghost">
                    Browse passports
                  </Link>
                </div>
                <p className="cp-note mt-4">Fictional demo entities · public testnet · IEEE ClimateChain Hackathon 2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ reduced motion / no WebGL */

function Poster() {
  return <div className="cp-poster absolute inset-0" aria-hidden />;
}

function StaticHero({ frames }: { frames: FrameManifest | null }) {
  const first = frames ? frames.pattern.replace(/%0?(\d*)d/, (_, pad: string) => String(frames.start ?? 1).padStart(Number(pad) || 0, "0")) : null;
  const poster = first ? { backgroundImage: `url(${first})` } : undefined;
  return (
    <section className="cp-hero cp-bleed cp-static" aria-label="CarbonPass">
      <div className="cp-stage relative overflow-hidden">
        <div className="cp-poster absolute inset-0 hidden md:block" style={poster} aria-hidden />
        <div className="cp-scrim pointer-events-none absolute inset-0 hidden md:block" />
        <div className="relative mx-auto flex max-w-[1200px] items-center px-4 pb-10 pt-16 sm:px-6 md:min-h-[82svh] md:py-24">
          <div className="max-w-xl">
            <div className="cp-label">EU CBAM · definitive period</div>
            <h1 className="cp-display mt-4">{HEADLINE}</h1>
            <p className="cp-sub mt-5">
              A clean mill is priced like a dirty one unless it can prove otherwise. CarbonPass turns a mill&apos;s invoices into a verified carbon
              passport that can&apos;t be counted twice.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/producer" className="cp-btn-primary">
                Run the demo →
              </Link>
              <Link href="/passport" className="cp-btn-ghost">
                Browse passports
              </Link>
            </div>
          </div>
        </div>
        <div className="cp-poster aspect-[16/10] w-full md:hidden" style={poster} aria-hidden />
      </div>
      <div className="cp-stage cp-static-facts">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div>
            <div className="cp-label">Default vs verified</div>
            <p className="cp-fact mt-3 font-mono tnum">
              {HERO.defaultT.toFixed(2)} → {HERO.verifiedT.toFixed(3)} <span className="cp-unit">tCO₂e/t</span>
            </p>
            <p className="cp-note mt-2 max-w-md">
              EU default (Türkiye, hot-rolled) vs verified actual for {HERO.installation}, a fictional demo entity: −{CUT_PCT}%, about {SAVING_2026}{" "}
              less for one month&apos;s output in 2026.
            </p>
          </div>
          <div>
            <div className="cp-label">Conservation rule</div>
            <p className="cp-fact mt-3 font-serif">Double counting: impossible.</p>
            <p className="cp-note mt-2 max-w-md">
              {fmtT(HERO.tonnes)} t minted once. After {fmtT(SHIP_A)} t + {fmtT(SHIP_B)} t ship, a further 2,000 t is rejected by the contract
              (ERC1155InsufficientBalance).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
