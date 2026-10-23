// The director drives one recorded page: an animated cursor, captions, smooth scrolling, clicks by role/text,
// and transaction waits that are logged so the assembler can speed them up.
// Beats in beats.mjs only talk to this API, so a UI restyle means editing selectors there, not here.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Director {
  constructor(page, { base, log = console.log, timeoutMs = 180_000, pace = 1 } = {}) {
    this.page = page;
    this.base = base.replace(/\/$/, "");
    this.log = log;
    this.timeoutMs = timeoutMs;
    this.pace = pace; // multiplies every deliberate pause (read/hold), e.g. 0.5 for a quick dry run
    this.t0 = performance.now();
    this.events = [];
    this.waits = [];
    this.beat = null;
    this.ctx = {}; // shared between beats (e.g. the batch id)
    this.topSafe = 84; // sticky top bar
    this.bottomSafe = 190; // lower-third caption
  }

  now() {
    return (performance.now() - this.t0) / 1000;
  }

  mark(type, data = {}) {
    const e = { t: +this.now().toFixed(3), beat: this.beat?.id, type, ...data };
    this.events.push(e);
    return e;
  }

  // ---------------------------------------------------------------- selectors

  /**
   * Spec forms: "visible text" | /regex/ | { role, name, exact, nth } | { text, exact, nth } | { label } |
   * { placeholder } | (page) => Locator. Role specs also take `level` (headings) and `checked`. Prefer roles and visible text; never brittle CSS.
   */
  loc(spec) {
    const p = this.page;
    if (typeof spec === "function") return spec(p);
    if (spec && typeof spec.click === "function") return spec;
    if (typeof spec === "string" || spec instanceof RegExp) return p.getByText(spec).first();
    const pick = (l) => (spec.nth != null ? l.nth(spec.nth) : spec.last ? l.last() : l.first());
    if (spec.role) return pick(p.getByRole(spec.role, { name: spec.name, exact: spec.exact, level: spec.level, checked: spec.checked }));
    if (spec.text) return pick(p.getByText(spec.text, { exact: spec.exact }));
    if (spec.label) return pick(p.getByLabel(spec.label, { exact: spec.exact }));
    if (spec.placeholder) return pick(p.getByPlaceholder(spec.placeholder));
    throw new Error(`Bad selector spec ${JSON.stringify(spec)}`);
  }

  describe(spec) {
    if (typeof spec === "string") return `"${spec}"`;
    if (spec instanceof RegExp) return String(spec);
    if (typeof spec === "function") return "fn";
    return JSON.stringify(spec, (k, v) => (v instanceof RegExp ? String(v) : v));
  }

  async waitFor(spec, { timeout = this.timeoutMs, state = "visible" } = {}) {
    const l = this.loc(spec);
    try {
      await l.waitFor({ state, timeout });
    } catch (e) {
      throw new Error(`[${this.beat?.id}] waiting for ${this.describe(spec)} (${state}) timed out after ${timeout} ms`);
    }
    return l;
  }

  async exists(spec, timeout = 1500) {
    try {
      await this.loc(spec).waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  }

  async waitEnabled(l, timeout = this.timeoutMs) {
    const until = Date.now() + timeout;
    while (!(await l.isEnabled().catch(() => false))) {
      if (Date.now() > until) throw new Error(`[${this.beat?.id}] element never became enabled`);
      await sleep(150);
    }
  }

  // ---------------------------------------------------------------- overlay

  async overlay(fn, ...args) {
    return this.page.evaluate(([name, a]) => window.__rec?.[name]?.(...a), [fn, args]);
  }

  /** Lower-third caption. `html` may use <b> and <code>. */
  async caption(html, { label = this.beat?.label, n = this.beat?.n } = {}) {
    this.mark("caption", { text: html.replace(/<[^>]+>/g, "") });
    await this.overlay("caption", n ?? "", label ?? "", html);
  }

  async hideCaption() {
    await this.overlay("hideCaption");
  }

  // ---------------------------------------------------------------- pacing

  /** A deliberate pause so viewers can read. */
  async read(ms = 1500) {
    await sleep(ms * this.pace);
  }

  // ---------------------------------------------------------------- navigation & scrolling

  async goto(path, { waitFor } = {}) {
    this.mark("goto", { path });
    await this.page.goto(this.base + path, { waitUntil: "domcontentloaded" });
    await this.page.waitForFunction(() => !!window.__rec, null, { timeout: 30_000 });
    await this.overlay("ensure");
    if (waitFor) await this.waitFor(waitFor);
  }

  async viewport() {
    return this.page.evaluate(() => ({ w: innerWidth, h: innerHeight, y: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  }

  async scrollToY(y, ms) {
    const v = await this.viewport();
    const target = clamp(y, 0, v.max);
    const dist = Math.abs(target - v.y);
    if (dist < 4) return;
    await this.overlay("scrollTo", target, ms ?? clamp(dist * 1.1, 700, 2600));
  }

  async scrollBy(dy, ms) {
    const v = await this.viewport();
    await this.scrollToY(v.y + dy, ms);
  }

  async scrollToTop(ms) {
    await this.scrollToY(0, ms);
  }

  async scrollToBottom(ms) {
    const v = await this.viewport();
    await this.scrollToY(v.max, ms);
  }

  /** Smoothly scrolls so the element sits at `at` (0 = just under the top bar, 0.5 = middle of the safe area). */
  async scrollTo(spec, { at = 0.35, ms } = {}) {
    const l = await this.waitFor(spec);
    const box = await l.boundingBox();
    const v = await this.viewport();
    const usable = v.h - this.topSafe - this.bottomSafe;
    const target = v.y + box.y - this.topSafe - Math.max(0, usable - box.height) * at;
    await this.scrollToY(target, ms);
    return l;
  }

  /** Scrolls only if the element isn't comfortably inside the safe area. */
  async ensureInView(l, at = 0.4) {
    const box = await l.boundingBox();
    const v = await this.viewport();
    if (!box) return;
    if (box.y >= this.topSafe && box.y + box.height <= v.h - this.bottomSafe) return;
    const usable = v.h - this.topSafe - this.bottomSafe;
    await this.scrollToY(v.y + box.y - this.topSafe - Math.max(0, usable - box.height) * at);
  }

  // ---------------------------------------------------------------- pointer

  async cursorTo(x, y) {
    const from = this._cursor ?? { x: x + 260, y: y + 180 };
    const dist = Math.hypot(x - from.x, y - from.y);
    await this.overlay("showCursor", true);
    await this.overlay("moveCursor", x, y, clamp(280 + dist * 0.55, 380, 1100));
    this._cursor = { x, y };
    await this.page.mouse.move(x, y);
  }

  async hover(spec) {
    const l = await this.waitFor(spec);
    await this.ensureInView(l);
    const b = await l.boundingBox();
    await this.cursorTo(b.x + b.width / 2, b.y + b.height / 2);
    return l;
  }

  /** True if a real click at (x, y) would land on the element (not on a toast or anything else on top). */
  async hits(l, x, y) {
    return l.evaluate((el, [px, py]) => {
      const top = document.elementFromPoint(px, py);
      return !!top && (el === top || el.contains(top) || (el.labels && [...el.labels].some((lb) => lb.contains(top))));
    }, [x, y]);
  }

  /** If something (usually a tx toast, bottom-right) covers the element, scroll it up, then dismiss toasts. */
  async uncover(l, position) {
    const at = async () => {
      const b = await l.boundingBox();
      return [b.x + (position?.x ?? b.width / 2), b.y + (position?.y ?? b.height / 2)];
    };
    if (await this.hits(l, ...(await at()))) return;
    const b = await l.boundingBox();
    const v = await this.viewport();
    await this.scrollToY(v.y + b.y - this.topSafe - 60);
    if (await this.hits(l, ...(await at()))) return;
    const dismiss = this.page.getByRole("button", { name: "Dismiss" });
    for (let i = 0; i < 6 && (await dismiss.count()); i++) {
      await dismiss.first().click({ timeout: 2000 }).catch(() => {});
      await sleep(150);
      if (await this.hits(l, ...(await at()))) return;
    }
  }

  /** Moves the cursor to the element, then clicks it with a ripple. */
  async click(spec, { pause = 220, position } = {}) {
    const l = await this.waitFor(spec);
    await this.waitEnabled(l);
    await this.ensureInView(l);
    await this.uncover(l, position);
    const b = await l.boundingBox();
    const x = b.x + (position?.x ?? b.width / 2);
    const y = b.y + (position?.y ?? b.height / 2);
    await this.cursorTo(x, y);
    await sleep(pause);
    this.mark("click", { target: this.describe(spec) });
    await this.overlay("ripple", x, y);
    // Press and release together: some UIs move things on focus (mousedown), which would turn a slow click into a miss.
    await this.page.mouse.down();
    await this.page.mouse.up();
    await sleep(160);
    return l;
  }

  async ring(spec, ms = 1800, pad = 8) {
    const l = await this.waitFor(spec);
    await this.ensureInView(l);
    const b = await l.boundingBox();
    await this.overlay("ring", b, ms * this.pace, pad);
  }

  // ---------------------------------------------------------------- transactions

  /**
   * Clicks `button`, then waits for `until` (a confirmation in the UI). The stretch between them is logged as a
   * wait so the assembler can speed it up. Throws early if a "… failed" toast appears instead.
   */
  async tx(button, until, { label = "tx", kind = "chain", fail = /failed$/, timeout = this.timeoutMs } = {}) {
    await this.click(button);
    const start = this.now();
    this.mark("tx-start", { label });
    const ok = this.loc(until);
    const bad = this.page.getByText(fail).first();
    await ok.or(bad).first().waitFor({ state: "visible", timeout }).catch(() => {
      throw new Error(`[${this.beat?.id}] ${label}: no confirmation within ${timeout} ms`);
    });
    if (!(await ok.isVisible().catch(() => false)) && (await bad.isVisible().catch(() => false))) {
      throw new Error(`[${this.beat?.id}] ${label}: ${await bad.innerText().catch(() => "failed")}`);
    }
    const end = this.now();
    this.waits.push({ start, end, label, kind, beat: this.beat?.id });
    this.mark("tx-end", { label, seconds: +(end - start).toFixed(2) });
    this.log(`    ${label}: confirmed after ${(end - start).toFixed(1)} s`);
  }

  // ---------------------------------------------------------------- files

  /** Animated drag of a same-origin file onto a drop zone (dispatches a real drop with a File). */
  async dropFile({ url, name, tag, tone, target }) {
    const l = await this.waitFor(target);
    await this.ensureInView(l, 0.5);
    const b = await l.boundingBox();
    const v = await this.viewport();
    const x1 = b.x + b.width / 2, y1 = b.y + b.height / 2;
    // Start up and to the left: the ghost hangs to the right of the cursor, so this keeps it on screen.
    const x0 = clamp(x1 - 360, 40, v.w - 420), y0 = clamp(y1 - 190, this.topSafe + 20, v.h - 80);
    this.mark("drop", { name, tag });
    await this.overlay("showCursor", true);
    await this.overlay("dragFile", { url: this.base + url, name, tag, tone, x0, y0, x1, y1, ms: 1100 });
    this._cursor = { x: x1, y: y1 };
    await this.page.mouse.move(x1, y1);
  }
}
