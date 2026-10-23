---
version: alpha
name: CarbonPass Customs Ledger
description: Industrial-document aesthetic for a carbon border compliance tool. Paper, ink, steel, and one molten accent.
colors:
  paper: "#F6F4EE"
  surface: "#FFFFFF"
  surface-sunken: "#EEEAE0"
  rule: "#D9D4C7"
  ink: "#10203A"
  ink-muted: "#4A5568"
  steel: "#3C4B5F"
  molten: "#E8590C"
  molten-deep: "#C2410C"
  verified: "#1F7A4D"
  verified-tint: "#E3F1E8"
  anomaly: "#B7791F"
  anomaly-tint: "#FBF0DC"
  revoked: "#B42318"
  revoked-tint: "#FCE8E6"
  dark-paper: "#0E141F"
  dark-surface: "#151D2B"
  dark-rule: "#2A3446"
  dark-ink: "#E8E4DA"
  dark-ink-muted: "#A3A9B5"
  dark-molten: "#FF7A2F"
  dark-verified: "#4CC38A"
typography:
  display:
    fontFamily: IBM Plex Serif
    fontSize: 3rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  h1:
    fontFamily: IBM Plex Serif
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.2
  h2:
    fontFamily: IBM Plex Sans
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: IBM Plex Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: IBM Plex Sans
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.08em
  data:
    fontFamily: IBM Plex Mono
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: '"tnum" 1, "zero" 1'
  metric:
    fontFamily: IBM Plex Mono
    fontSize: 2.25rem
    fontWeight: 600
    lineHeight: 1
    fontFeature: '"tnum" 1'
rounded:
  none: 0px
  sm: 2px
  md: 4px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
components:
  button-primary:
    backgroundColor: "{colors.molten}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
  button-primary-hover:
    backgroundColor: "{colors.molten-deep}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 24px
  hash-chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.steel}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-verified:
    backgroundColor: "{colors.verified-tint}"
    textColor: "{colors.verified}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  badge-anomaly:
    backgroundColor: "{colors.anomaly-tint}"
    textColor: "{colors.anomaly}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  badge-revoked:
    backgroundColor: "{colors.revoked-tint}"
    textColor: "{colors.revoked}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.data}"
    height: 44px
---

## Overview

CarbonPass should feel like an **official customs document that came alive**: the confidence of a stamped certificate, the precision of a ledger, the heat of a steel mill. The users are compliance officers at mills in Türkiye and India, accredited verifiers, and EU import managers. They want to trust it, not be wowed by it.

Personality: precise, sober, quietly industrial. There's one moment of warmth, the **verification stamp**, and one of tension, the **rejected double-ship**.

Avoid the generic AI-startup look entirely: no purple gradients, glassmorphism, floating 3D blobs, emoji icons, or "✨ AI-powered" chips.

## Colors

- **Paper** (`paper`) is the page background, a warm off-white like certificate stock. **Surface** (white) is for cards and tables laid on top.
- **Ink** (`ink`, deep navy) is for all primary text and headings. **Steel** is for secondary data, hashes and icons.
- **Molten** (`molten`, orange) is the *only* action colour: primary buttons, the live "tonnes remaining" gauge fill, focused states. If more than one molten element competes on a screen, demote one.
- **Verified green** is for verification stamps, issued status and successful proof checks only.
- **Anomaly amber** is for AI or statistical flags that need human review. Never use it for errors.
- **Revoked red** is for revoked batches, failed proofs and reverted transactions.
- **Rules** (`rule`) are 1px hairlines between ledger rows and sections, like a printed form.
- **Dark mode** swaps to the `dark-*` tokens. Molten and verified get brighter variants to keep contrast. Status colours keep their meaning.

## Typography

- **IBM Plex Serif** for display and h1: page titles and the hero claim. It gives a certificate-like gravitas.
- **IBM Plex Sans** for UI and body text.
- **IBM Plex Mono** with tabular numbers for **every number, unit, hash, address and tx id**. Numbers must align in columns. Units sit in Sans at muted colour after the value, like `0.352 tCO₂e/t`.
- Labels are uppercase Sans at 0.75rem with 0.08em tracking, like form field captions ("INSTALLATION", "REPORTING PERIOD").
- All three are on Google Fonts.

## Layout

- 12-column grid, max width 1200px, 24px gutters. At phone width: a single column with 16px side padding and no horizontal scroll.
- An app shell with a slim top bar: the wordmark, a **role switcher** (Producer · Verifier · Importer · Public) shown as a segmented control, and a network chip ("Sepolia ●").
- Screens read top to bottom like a form: a header block (entity, period, status badge), then numbered sections (`01 Evidence`, `02 Calculation`, `03 Checks`, `04 Sign & issue`).
- Generous whitespace between sections (`xl`). Dense, tabular content inside sections.

## Elevation & Depth

Almost flat. Cards use a 1px `rule` border and no shadow. The only raised element is the **passport card** on the public page: one soft shadow (0 8px 24px rgba(16,32,58,0.08)) so it reads as a physical document. Modals get a dimmed paper overlay.

## Shapes

- Near-square corners (2–4px). Documents, not bubbles.
- A **perforated edge** (a dotted top border) on the passport card and evidence documents.
- The **verification stamp** is circular. Its text runs around the ring ("VERIFIED · ACCREDITED VERIFIER · 2026-Q3"), with a check in the centre, in verified green, rotated −8°.
- The **tonnage gauge** is a horizontal bar. Its fill is molten. Shipped segments show diagonal hatching in steel, and surrendered segments are solid steel.

## Components

- **Hash chip:** a truncated mono hash (`0x3f2a…9c1d`) with copy and "view on explorer" icons. Always use it for addresses, roots and tx hashes.
- **Evidence row:** document icon, file name, extracted quantity and unit (mono), a source reference ("p.2, line 4"), a confidence dot, and a confirm checkbox. AI-extracted values show a small "extracted" label until a human confirms them.
- **Anomaly callout:** amber left border, the metric, how far it sits from history ("−38% vs 12-month median"), the reason, and the required action ("Verifier must review evidence").
- **Status badges:** Pending (steel outline) · Issued (verified) · Revoked (revoked) · Surrendered (steel solid).
- **Tx toast:** bottom-right. It shows "Submitting…", then "Confirmed in block #…" with a hash chip. A revert shows a red toast quoting the contract's error, e.g. `InsufficientBalance: 2,000 t requested, 1,500 t remaining`.
- **Cost model card:** a default-value cost vs. verified-actual cost bar pair, with savings as a large `metric`. A small 2026→2034 line shows savings growing as the CBAM factor phases in.
- **Timeline:** a vertical ledger of events (Submitted → Verified → Shipped ×2 → Surrendered), each with a timestamp and hash chip.

## Motion

- **Stamp:** on issuance the stamp drops in. Scale goes 1.25→1 and opacity 0→1 over 220ms ease-out, then a single 2px settle. This is the one celebratory moment.
- **Gauge:** shipping drains the molten fill over 400ms ease-in-out.
- **Reject shake:** an over-ship attempt shakes the gauge horizontally (3 × 4px, 180ms) and flashes the revert toast.
- **Count-up** on headline metrics (600ms) when they first scroll into view.
- Sections fade up 8px on scroll into view, staggered 60ms. Nothing springy or bouncy.
- Respect `prefers-reduced-motion`: replace all of the above with instant state changes.

## Do's and Don'ts

- **Do** show units on every number, and source references on every extracted value.
- **Do** make the reason for blockchain visible in the UI (conservation gauge, revert, proof check), not just a "secured by blockchain" badge.
- **Do** label demo data "fictional demo entity" in small muted text.
- **Don't** use more than one molten element per view, or gradients, glows, or emoji.
- **Don't** show raw JSON or terminals in the main UI. Tuck technical detail into "Show proof" disclosures.
- **Don't** let amber anomaly flags look like errors. They're prompts for review.
