// In-page recording overlay, injected with context.addInitScript. Exposes window.__rec for the director.
// Everything lives in a closed shadow root so Playwright's text/role selectors never match caption text,
// and pointer-events are off so clicks reach the app underneath.
(() => {
  if (window.__rec) return;

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: var(--font-plex-sans), "IBM Plex Sans", system-ui, sans-serif; }

    /* Lower-third caption: ink plate, paper text, molten step number. */
    .cap { position: absolute; left: 32px; bottom: 32px; max-width: 760px; display: flex; gap: 0; opacity: 0; transform: translateY(8px);
      transition: opacity 260ms ease-out, transform 260ms ease-out; }
    .cap.on { opacity: 1; transform: translateY(0); }
    .cap .rule { width: 4px; background: #E8590C; border-radius: 2px 0 0 2px; flex: none; }
    .cap .body { background: rgba(16, 32, 58, 0.96); color: #E8E4DA; padding: 14px 20px 16px 18px; border-radius: 0 4px 4px 0;
      box-shadow: 0 8px 24px rgba(16, 32, 58, 0.18); }
    .cap .label { font-size: 11.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #A3A9B5; display: flex; gap: 10px; align-items: baseline; }
    .cap .label .n { font-family: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace; color: #FF7A2F; letter-spacing: 0; font-size: 12.5px; }
    .cap .text { margin-top: 6px; font-size: 21px; line-height: 1.38; font-weight: 500; color: #F6F4EE; }
    .cap .text b { font-weight: 600; color: #FFFFFF; }
    .cap .text code { font-family: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace; font-size: 0.92em; }
    .cap .swap { transition: opacity 180ms ease-out; }

    /* Cursor + highlight halo + click ripple. */
    .cursor { position: absolute; left: 0; top: 0; width: 28px; height: 28px; transform: translate(-200px, -200px); will-change: transform; }
    .cursor .halo { position: absolute; left: -17px; top: -17px; width: 34px; height: 34px; border-radius: 50%;
      background: rgba(232, 89, 12, 0.16); border: 1.5px solid rgba(232, 89, 12, 0.45); }
    .cursor svg { position: absolute; left: -3px; top: -2px; filter: drop-shadow(0 1px 1.5px rgba(16, 32, 58, 0.35)); }
    .ripple { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 2px solid #E8590C;
      opacity: 0.9; transform: scale(0.4); animation: ripple 460ms ease-out forwards; }
    @keyframes ripple { to { transform: scale(3.2); opacity: 0; } }

    /* Emphasis ring around an element. */
    .ring { position: absolute; border: 2px solid #E8590C; border-radius: 6px; opacity: 0; transition: opacity 220ms ease-out; }
    .ring.on { opacity: 1; }

    /* Dragged file ghost (tamper check). */
    .ghost { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #FFFFFF;
      border: 1px solid #D9D4C7; border-top: 2px dotted #3C4B5F; border-radius: 4px; box-shadow: 0 8px 24px rgba(16, 32, 58, 0.16);
      font-size: 14px; color: #10203A; opacity: 0; transition: opacity 200ms ease-out; white-space: nowrap; }
    .ghost.on { opacity: 1; }
    .ghost .ic { width: 18px; height: 22px; border: 1.5px solid #3C4B5F; border-radius: 2px; position: relative; }
    .ghost .ic::after { content: ""; position: absolute; left: 3px; right: 3px; top: 5px; height: 9px;
      background: repeating-linear-gradient(#3C4B5F 0 1.5px, transparent 1.5px 4px); }
    .ghost .nm { font-family: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace; font-size: 13px; }
    .ghost .tag { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }
    .ghost .tag.orig { background: #E3F1E8; color: #1F7A4D; }
    .ghost .tag.tamp { background: #FCE8E6; color: #B42318; }
  `;

  const host = document.createElement("div");
  host.setAttribute("data-recorder-overlay", "");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>${CSS}</style>
    <div class="layer">
      <div class="ring"></div>
      <div class="ghost"><span class="ic"></span><span class="nm"></span><span class="tag"></span></div>
      <div class="cap"><div class="rule"></div><div class="body"><div class="label swap"><span class="n"></span><span class="t"></span></div><div class="text swap"></div></div></div>
      <div class="cursor"><div class="halo"></div>
        <svg width="24" height="30" viewBox="0 0 24 30"><path d="M3 2 L3 24 L8.6 18.6 L12.4 27.4 L16.2 25.8 L12.5 17.2 L20 17.2 Z" fill="#10203A" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const cap = $(".cap"), capN = $(".cap .n"), capT = $(".cap .t"), capText = $(".cap .text"), capSwaps = root.querySelectorAll(".cap .swap");
  const cursor = $(".cursor"), ring = $(".ring"), ghost = $(".ghost"), layer = $(".layer");

  // Attach only after load so React hydration never sees a foreign node; re-attach if anything removes it.
  // Hides the Next.js dev-tools badge when recording against `next dev`.
  const hideDev = document.createElement("style");
  hideDev.textContent = "nextjs-portal{display:none!important}";
  function ensure(force) {
    if (!hideDev.isConnected && document.head) document.head.appendChild(hideDev);
    if (!force && document.readyState !== "complete") return;
    if (!host.isConnected && document.body) document.body.appendChild(host);
  }
  setInterval(ensure, 200);
  addEventListener("DOMContentLoaded", () => ensure());
  addEventListener("load", () => setTimeout(ensure, 50));

  // The cursor survives full page loads (page.goto) via sessionStorage.
  let pos = { x: -200, y: -200 };
  try {
    const saved = JSON.parse(sessionStorage.getItem("__rec_cursor") || "null");
    if (saved) pos = saved;
  } catch {}
  const place = () => (cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`);
  place();
  const save = () => {
    try { sessionStorage.setItem("__rec_cursor", JSON.stringify(pos)); } catch {}
  };

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const animate = (ms, fn) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        fn(ease(t));
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  window.__rec = {
    ensure: () => ensure(true),
    caption(n, label, html) {
      ensure(true);
      const show = () => {
        capN.textContent = n || "";
        capT.textContent = label || "";
        capText.innerHTML = html;
      };
      if (cap.classList.contains("on")) {
        capSwaps.forEach((e) => (e.style.opacity = "0"));
        setTimeout(() => {
          show();
          capSwaps.forEach((e) => (e.style.opacity = "1"));
        }, 190);
      } else {
        show();
        requestAnimationFrame(() => cap.classList.add("on"));
      }
    },
    hideCaption() {
      cap.classList.remove("on");
    },
    hideAll() {
      cap.classList.remove("on");
      ring.classList.remove("on");
      cursor.style.opacity = "0";
    },
    showCursor(on = true) {
      cursor.style.opacity = on ? "1" : "0";
    },
    async moveCursor(x, y, ms) {
      ensure(true);
      const from = { ...pos };
      await animate(ms, (k) => {
        pos = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
        place();
      });
      pos = { x, y };
      place();
      save();
    },
    ripple(x, y) {
      const r = document.createElement("div");
      r.className = "ripple";
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      layer.appendChild(r);
      setTimeout(() => r.remove(), 600);
    },
    async ring(rect, ms, pad = 8) {
      ensure(true);
      Object.assign(ring.style, { left: `${rect.x - pad}px`, top: `${rect.y - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` });
      ring.classList.add("on");
      await sleep(ms);
      ring.classList.remove("on");
    },
    async scrollTo(y, ms) {
      document.documentElement.style.scrollBehavior = "auto";
      const max = document.documentElement.scrollHeight - innerHeight;
      const target = Math.max(0, Math.min(max, y));
      const from = scrollY;
      if (Math.abs(target - from) < 2) return;
      await animate(ms, (k) => window.scrollTo(0, from + (target - from) * k));
    },
    // Drags a file "ghost" with the cursor from (x0,y0) to (x1,y1), then drops a real File on the element at (x1,y1).
    async dragFile({ url, name, tag, tone, x0, y0, x1, y1, ms }) {
      ensure(true);
      const buf = await (await fetch(url, { cache: "no-store" })).arrayBuffer();
      $(".ghost .nm").textContent = name;
      const t = $(".ghost .tag");
      t.textContent = tag || "";
      t.className = `tag ${tone || "orig"}`;
      t.style.display = tag ? "" : "none";
      const placeGhost = () => (ghost.style.transform = `translate(${pos.x + 14}px, ${pos.y + 16}px)`);
      await this.moveCursor(x0, y0, 500);
      placeGhost();
      ghost.classList.add("on");
      await sleep(350);
      const from = { ...pos };
      await animate(ms, (k) => {
        pos = { x: from.x + (x1 - from.x) * k, y: from.y + (y1 - from.y) * k };
        place();
        placeGhost();
      });
      save();
      const target = document.elementFromPoint(x1, y1);
      const dt = new DataTransfer();
      dt.items.add(new File([buf], name, { type: "application/pdf" }));
      for (const type of ["dragenter", "dragover", "drop"]) {
        target?.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x1, clientY: y1 }));
      }
      this.ripple(x1, y1);
      ghost.classList.remove("on");
      return !!target;
    },
  };
})();
