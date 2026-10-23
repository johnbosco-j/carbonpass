import { HERO, fmtCn } from "../data";

/** Canvas-drawn artwork for the scene: the passport card, the verification stamp and the floor lettering. */

export const CARD_W = 1024;
export const CARD_H = 640;
/** Where the stamp lands on the card, in card-texture pixels */
export const STAMP_AT = { x: 812, y: 372, r: 150 };
export const STAMP_PX = 512;

const PAPER = "#F6F4EE";
const INK = "#10203A";
const MUTED = "#4A5568";
const RULE = "#D9D4C7";
const SUNKEN = "#EEEAE0";
const STEEL = "#3C4B5F";
export const VERIFIED = "#1F7A4D";

/** The next/font family stacks set on <html> by the root layout. */
export function fontStacks() {
  const css = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const get = (v: string, fb: string) => css?.getPropertyValue(v).trim() || fb;
  return {
    serif: get("--font-plex-serif", "Georgia, serif"),
    sans: get("--font-plex-sans", "system-ui, sans-serif"),
    mono: get("--font-plex-mono", "ui-monospace, monospace"),
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing is missing from older Safari; the text just sits tighter there.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

const quarter = (month: string) => `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}`;

/** Circular stamp: ring text, double ring, check. Drawn in `color` on transparent. */
export function drawStamp(color = VERIFIED) {
  const [c, ctx] = canvas(STAMP_PX, STAMP_PX);
  const f = fontStacks();
  const mid = STAMP_PX / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(mid, mid, 232, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(mid, mid, 168, 0, Math.PI * 2);
  ctx.stroke();

  const text = `VERIFIED · ACCREDITED VERIFIER · ${quarter(HERO.period)} · `;
  ctx.font = `600 31px ${f.sans}`;
  spaced(ctx, 0);
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const radius = 188;
  const scale = (Math.PI * 2 * radius) / total;
  let angle = -Math.PI / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [...text].forEach((ch, i) => {
    const w = widths[i] * scale;
    angle += w / 2 / radius;
    ctx.save();
    ctx.translate(mid + Math.cos(angle) * radius, mid + Math.sin(angle) * radius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += w / 2 / radius;
  });

  ctx.lineWidth = 26;
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.beginPath();
  ctx.moveTo(mid - 78, mid + 4);
  ctx.lineTo(mid - 22, mid + 58);
  ctx.lineTo(mid + 84, mid - 56);
  ctx.stroke();
  return c;
}

/** Sample `n` points from the stamp's ink, as [-0.5, 0.5] coords (y up). */
export function stampPoints(n: number, stamp: HTMLCanvasElement) {
  const ctx = stamp.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, STAMP_PX, STAMP_PX);
  const ink: number[] = [];
  for (let y = 0; y < STAMP_PX; y += 2) {
    for (let x = 0; x < STAMP_PX; x += 2) if (data[(y * STAMP_PX + x) * 4 + 3] > 140) ink.push(x, y);
  }
  const out = new Float32Array(n * 2);
  const count = ink.length / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * count);
    out[i * 2] = (ink[k * 2] + Math.random() * 2) / STAMP_PX - 0.5;
    out[i * 2 + 1] = 0.5 - (ink[k * 2 + 1] + Math.random() * 2) / STAMP_PX;
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The passport card face. Perforations along the top edge are punched out (transparent). */
export function drawCard() {
  const [c, ctx] = canvas(CARD_W, CARD_H);
  const f = fontStacks();
  ctx.fillStyle = PAPER;
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 10);
  ctx.fill();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 3;
  roundRect(ctx, 1.5, 1.5, CARD_W - 3, CARD_H - 3, 9);
  ctx.stroke();

  const L = 60;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = `600 19px ${f.sans}`;
  spaced(ctx, 2.2);
  ctx.fillText("CARBON PASSPORT · CBAM EMBEDDED EMISSIONS", L, 76);
  ctx.textAlign = "right";
  ctx.fillText("ERC-1155", CARD_W - L, 76);
  ctx.textAlign = "left";

  spaced(ctx, -0.5);
  ctx.fillStyle = INK;
  ctx.font = `600 50px ${f.serif}`;
  ctx.fillText(HERO.product, L, 142);
  spaced(ctx, 0);
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${f.sans}`;
  ctx.fillText(`${HERO.installation} · ${HERO.city}, TR`, L, 182);
  ctx.font = `400 17px ${f.sans}`;
  ctx.fillText("(fictional demo entity)", L, 208);

  ctx.fillStyle = RULE;
  ctx.fillRect(L, 236, CARD_W - 2 * L, 2);

  ctx.fillStyle = MUTED;
  ctx.font = `600 18px ${f.sans}`;
  spaced(ctx, 2);
  ctx.fillText("SPECIFIC EMBEDDED EMISSIONS", L, 282);
  spaced(ctx, 0);
  ctx.fillStyle = INK;
  ctx.font = `600 112px ${f.mono}`;
  const v = HERO.verifiedT.toFixed(3);
  ctx.fillText(v, L - 4, 392);
  const vw = ctx.measureText(v).width;
  ctx.fillStyle = MUTED;
  ctx.font = `400 28px ${f.sans}`;
  ctx.fillText("tCO₂e/t", L + vw + 10, 390);

  const cols = [
    ["VERIFIED", `${HERO.tonnes.toLocaleString("en-US")} t`],
    ["PERIOD", HERO.period],
    ["CN CODE", fmtCn(HERO.cnCode)],
  ];
  cols.forEach(([k, val], i) => {
    const x = L + i * 182;
    ctx.fillStyle = MUTED;
    ctx.font = `600 16px ${f.sans}`;
    spaced(ctx, 1.8);
    ctx.fillText(k, x, 450);
    spaced(ctx, 0);
    ctx.fillStyle = INK;
    ctx.font = `500 28px ${f.mono}`;
    ctx.fillText(val, x, 488);
  });

  ctx.fillStyle = SUNKEN;
  roundRect(ctx, L, 528, 470, 48, 4);
  ctx.fill();
  ctx.fillStyle = STEEL;
  ctx.font = `500 21px ${f.mono}`;
  ctx.fillText("batch · Sepolia testnet · conserved", L + 16, 559);

  // Empty seal ring where the stamp lands
  ctx.setLineDash([6, 10]);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(STAMP_AT.x, STAMP_AT.y, STAMP_AT.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Perforated top edge
  ctx.globalCompositeOperation = "destination-out";
  for (let x = 22; x < CARD_W - 10; x += 26) {
    ctx.beginPath();
    ctx.arc(x, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  return c;
}

/** Floor lettering either side of the border line. White on transparent; tinted in the shader. */
export function drawFloorText() {
  const [c, ctx] = canvas(2048, 256);
  const f = fontStacks();
  ctx.fillStyle = "#fff";
  ctx.font = `600 54px ${f.mono}`;
  spaced(ctx, 10);
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillText("TÜRKİYE · EXPORT", 1024 - 70, 92);
  ctx.textAlign = "left";
  ctx.fillText("EU CUSTOMS TERRITORY", 1024 + 70, 92);
  ctx.font = `500 30px ${f.mono}`;
  spaced(ctx, 6);
  ctx.globalAlpha = 0.7;
  ctx.textAlign = "right";
  ctx.fillText("DEFAULT VALUES APPLY", 1024 - 70, 170);
  ctx.textAlign = "left";
  ctx.fillText("CBAM · REG. (EU) 2023/956", 1024 + 70, 170);
  return c;
}

/** Soft radial glow for the molten halo. */
export function drawGlow() {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,150,70,0.9)");
  g.addColorStop(0.25, "rgba(255,110,40,0.35)");
  g.addColorStop(0.6, "rgba(232,89,12,0.08)");
  g.addColorStop(1, "rgba(232,89,12,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}
