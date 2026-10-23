/**
 * Generates the fictional sample evidence PDFs (public/samples), a tampered copy for the
 * integrity demo, and the cached extraction outputs used when no ANTHROPIC_API_KEY is set.
 *
 *   pnpm --filter web make:docs
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public/samples");
const EXTRACT_OUT = path.join(ROOT, "data/extractions");

interface Line {
  label: string;
  value: string;
}
interface Spec {
  file: string;
  kind: string;
  issuer: string;
  title: string;
  meta: Line[];
  lines: Line[];
  footer: string;
  extract: { key: string; label: string; value: number; unit: string; quoteLabel: string; confidence: number }[];
}

const CUSTOMER = "Anatolia Green Steel A.S. (fictional) - EAF mill, Izmir, TR - Installation TR-INST-0001";

const SPECS: Spec[] = [
  {
    file: "gas_invoice_2026-07.pdf",
    kind: "gas_invoice",
    issuer: "EgeGaz Natural Gas Distribution (fictional)",
    title: "NATURAL GAS INVOICE",
    meta: [
      { label: "Invoice no.", value: "EG-2026-07-118842" },
      { label: "Customer", value: CUSTOMER },
      { label: "Billing period", value: "01.07.2026 - 31.07.2026" },
      { label: "Meter", value: "TR-IZM-GM-55120 (industrial, 4 bar)" },
    ],
    lines: [
      { label: "Volume delivered", value: "367,688 Sm3" },
      { label: "Net calorific value (NCV)", value: "35.90 MJ/Sm3" },
      { label: "Energy delivered (NCV basis)", value: "13,200.0 GJ" },
      { label: "Unit price", value: "TRY 412.80 / MWh" },
      { label: "Amount due", value: "TRY 1,513,600.00" },
    ],
    footer: "Energy figures are calculated on net calorific value per EPDK metering rules. Demo document, fictional.",
    extract: [{ key: "natural_gas_gj", label: "Natural gas (NCV)", value: 13200, unit: "GJ", quoteLabel: "Energy delivered (NCV basis)", confidence: 0.98 }],
  },
  {
    file: "electricity_invoice_2026-07.pdf",
    kind: "electricity_invoice",
    issuer: "Aegean Power Supply (fictional)",
    title: "ELECTRICITY INVOICE",
    meta: [
      { label: "Invoice no.", value: "APS-HV-2026-07-00931" },
      { label: "Customer", value: CUSTOMER },
      { label: "Billing period", value: "01.07.2026 - 31.07.2026" },
      { label: "Connection", value: "154 kV, metering point IZM-ALG-154-07" },
    ],
    lines: [
      { label: "Active energy consumption", value: "4,630.4 MWh" },
      { label: "Reactive energy (inductive)", value: "612.0 MVArh" },
      { label: "Peak demand", value: "38.6 MW" },
      { label: "Supply origin", value: "Grid mix (no guarantee of origin)" },
      { label: "Amount due", value: "TRY 13,912,450.00" },
    ],
    footer: "Consumption per settlement meter readings. Demo document, fictional.",
    extract: [{ key: "electricity_mwh", label: "Grid electricity", value: 4630.4, unit: "MWh", quoteLabel: "Active energy consumption", confidence: 0.99 }],
  },
  {
    file: "production_log_2026-07.pdf",
    kind: "production_log",
    issuer: "Anatolia Green Steel A.S. (fictional) - Production Planning",
    title: "MONTHLY PRODUCTION & MATERIALS REPORT",
    meta: [
      { label: "Report no.", value: "PPR-2026-07" },
      { label: "Installation", value: "TR-INST-0001 - EAF 1 + Hot strip mill" },
      { label: "Period", value: "July 2026" },
      { label: "Product", value: "Hot-rolled coil, CN 7208 39 00" },
    ],
    lines: [
      { label: "Hot-rolled coil output (prime)", value: "10,000.0 t" },
      { label: "Scrap charged", value: "9,640.0 t" },
      { label: "Pig iron charged (Karadeniz Pig Iron A.S., TR-INST-0002, verified June 2026 lot)", value: "1,300.0 t" },
      { label: "Graphite electrodes consumed", value: "17.5 t" },
      { label: "Charge carbon (anthracite) consumed", value: "120.0 t" },
      { label: "Note", value: "Carbon-injection control system commissioned 18.06.2026" },
    ],
    footer: "Weighbridge and stock-take reconciled 31.07.2026. Demo document, fictional.",
    extract: [
      { key: "production_t", label: "HRC production", value: 10000, unit: "t", quoteLabel: "Hot-rolled coil output (prime)", confidence: 0.99 },
      { key: "pig_iron_t", label: "Pig iron (precursor)", value: 1300, unit: "t", quoteLabel: "Pig iron charged (Karadeniz Pig Iron A.S., TR-INST-0002, verified June 2026 lot)", confidence: 0.97 },
      { key: "electrodes_t", label: "Graphite electrodes", value: 17.5, unit: "t", quoteLabel: "Graphite electrodes consumed", confidence: 0.98 },
      { key: "charge_carbon_t", label: "Charge carbon", value: 120, unit: "t", quoteLabel: "Charge carbon (anthracite) consumed", confidence: 0.97 },
    ],
  },
  {
    file: "meter_log_2026-07.pdf",
    kind: "meter_log",
    issuer: "Anatolia Green Steel A.S. (fictional) - Energy Management",
    title: "MAIN INCOMER METER LOG",
    meta: [
      { label: "Meter", value: "Check meter CM-154-01 (class 0.2S)" },
      { label: "Period", value: "01.07.2026 00:00 - 31.07.2026 23:59" },
    ],
    lines: [
      { label: "Opening register", value: "1,284,117.6 MWh" },
      { label: "Closing register", value: "1,288,730.4 MWh" },
      { label: "Metered consumption", value: "4,612.8 MWh" },
    ],
    footer: "Independent check meter for invoice reconciliation. Demo document, fictional.",
    extract: [{ key: "electricity_meter_mwh", label: "Check-meter electricity", value: 4612.8, unit: "MWh", quoteLabel: "Metered consumption", confidence: 0.98 }],
  },
];

async function render(spec: Spec, override?: Record<string, string>) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${spec.title} - ${spec.file}`);
  pdf.setCreationDate(new Date("2026-08-03T09:00:00Z"));
  pdf.setModificationDate(new Date("2026-08-03T09:00:00Z"));
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.06, 0.13, 0.23);
  let y = 790;
  page.drawText(spec.issuer, { x: 50, y, size: 11, font: bold, color: ink });
  y -= 30;
  page.drawText(spec.title, { x: 50, y, size: 18, font: bold, color: ink });
  y -= 12;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: ink });
  y -= 26;
  for (const m of spec.meta) {
    page.drawText(m.label, { x: 50, y, size: 9, font: bold, color: ink });
    page.drawText(m.value, { x: 170, y, size: 9, font, color: ink });
    y -= 16;
  }
  y -= 18;
  page.drawText("DETAILS", { x: 50, y, size: 9, font: bold, color: ink });
  y -= 8;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: ink });
  y -= 18;
  for (const l of spec.lines) {
    const value = override?.[l.label] ?? l.value;
    page.drawText(l.label, { x: 50, y, size: 10, font, color: ink });
    page.drawText(value, { x: 545 - bold.widthOfTextAtSize(value, 10), y, size: 10, font: bold, color: ink });
    y -= 20;
  }
  page.drawText(spec.footer, { x: 50, y: 60, size: 8, font, color: rgb(0.3, 0.33, 0.4) });
  return pdf.save({ useObjectStreams: false });
}

async function main() {
  fs.mkdirSync(path.join(OUT, "tampered"), { recursive: true });
  fs.mkdirSync(EXTRACT_OUT, { recursive: true });
  for (const spec of SPECS) {
    fs.writeFileSync(path.join(OUT, spec.file), await render(spec));
    const extraction = {
      file: spec.file,
      kind: spec.kind,
      values: spec.extract.map((e) => ({
        key: e.key,
        label: e.label,
        value: e.value,
        unit: e.unit,
        confidence: e.confidence,
        source: { file: spec.file, page: 1, quote: `${e.quoteLabel}: ${spec.lines.find((l) => l.label === e.quoteLabel)!.value}` },
      })),
    };
    fs.writeFileSync(path.join(EXTRACT_OUT, spec.file.replace(".pdf", ".json")), JSON.stringify(extraction, null, 2) + "\n");
    console.log(`wrote ${spec.file}`);
  }
  // Tampered copy: one figure changed (4,630.4 -> 4,130.4 MWh) to show the integrity check failing.
  const elec = SPECS.find((s) => s.kind === "electricity_invoice")!;
  fs.writeFileSync(path.join(OUT, "tampered", elec.file), await render(elec, { "Active energy consumption": "4,130.4 MWh" }));
  console.log(`wrote tampered/${elec.file}`);
}

main();
