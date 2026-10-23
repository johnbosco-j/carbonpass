import plant from "@/data/plant.json";
import { calculate, costModel, defaultMarkup, defaultValue, fmtEur, type Country, type PrecursorLink } from "@/lib/cbam";

/**
 * Numbers the hero story quotes. Nothing is hardcoded here: the default value and mark-up come from
 * data/factors.json (via lib/cbam), and the verified intensity is the demo month run through the same
 * calculator the producer page uses, with the supplier's verified pig-iron passport linked (as the demo does).
 */
const inst = plant.installation;
const country = inst.country as Country;
// The seed mints the supplier batch with this intensity; the producer page reads it back from the chain.
// The hero only uses the resulting intensity, so the batch id is nominal.
const supplierPassport: PrecursorLink = {
  batchId: 0,
  directKgPerT: plant.supplier.batch.directKgPerT,
  supplier: `${plant.supplier.installation.name} (fictional)`,
};

export const HERO = {
  installation: inst.name,
  installationCode: inst.code,
  city: inst.city,
  product: inst.product.name,
  cnCode: inst.product.cnCode,
  tonnes: plant.demoMonth.production_t,
  period: plant.demoMonth.month,
  /** EU default value, tCO₂e per tonne (Türkiye, hot-rolled flat) */
  defaultT: defaultValue(inst.product.cnCode, country),
  /** Verified actual for the demo month, tCO₂e per tonne (direct incl. precursors) */
  verifiedT: calculate(plant.demoMonth, country, supplierPassport).seeDirect,
  markup2026: defaultMarkup(2026),
  importers: plant.importers,
  verifier: plant.verifier.name,
};

export const RATIO = HERO.verifiedT / HERO.defaultT;
export const CUT_PCT = Math.round((1 - RATIO) * 100);

const [row2026] = costModel({ tonnes: HERO.tonnes, seeChargeable: HERO.verifiedT, cnCode: HERO.cnCode, country, years: [2026] });
export const SAVING_2026 = fmtEur(row2026.saving);

export const fmtCn = (cn: number) => String(cn).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1 $2 $3");
