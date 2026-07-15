/**
 * Package-size parsing for unit pricing ("$0.62/lb", "$0.21/ct").
 *
 * The honest half of the "is this size reasonable?" answer: given a provider's
 * size string, extract a quantity + canonical unit so the client can show a
 * per-unit price next to the sticker price. Pure and deterministic — unparseable
 * sizes return null (no unit price shown) rather than a guessed one.
 *
 * v1 keeps the stated unit (no cross-unit conversion): a single priced provider
 * doesn't need lb-vs-oz normalization yet, and "$/stated unit" already exposes
 * the 6-count-vs-dozen truth. Convert within measure classes later, when a
 * second priced rail makes it load-bearing.
 */

export interface Measure {
  quantity: number;
  /** Canonical unit token: lb, oz, fl oz, gal, qt, pt, ct, ea, g, kg, l, ml. */
  unit: string;
}

/** Trailing unit word -> canonical token. */
const UNIT_SYNONYMS: Record<string, string> = {
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  qt: 'qt', quart: 'qt', quarts: 'qt',
  pt: 'pt', pint: 'pt', pints: 'pt',
  ct: 'ct', count: 'ct', cnt: 'ct', pk: 'ct', pack: 'ct', packs: 'ct',
  pc: 'ct', pcs: 'ct', piece: 'ct', pieces: 'ct',
  ea: 'ea', each: 'ea',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
};

export function parseMeasure(size: string | null | undefined): Measure | null {
  if (!size) return null;
  // Drop parentheticals ("8 oz (227 g)" -> "8 oz"), collapse whitespace.
  let s = size.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (s === '') return null;

  // Normalize fluid ounces to a single token so the space doesn't split it.
  s = s.replace(/fluid\s+ounces?/g, 'fl oz').replace(/\bfl\.?\s*oz\b/g, 'fl_oz');

  // "dozen" / "N dozen" -> count (eggs sold by the dozen read better as $/ct).
  const dozen = s.match(/(?:(\d+(?:\.\d+)?)\s*)?dozen/);
  if (dozen) {
    const n = dozen[1] ? parseFloat(dozen[1]) : 1;
    return { quantity: n * 12, unit: 'ct' };
  }

  const m = s.match(/(\d+(?:\.\d+)?)\s*([a-z_]+)?/);
  if (!m) {
    // Bare unit, e.g. "each".
    const bare = UNIT_SYNONYMS[s];
    return bare ? { quantity: 1, unit: bare } : null;
  }
  const quantity = parseFloat(m[1]!);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const token = (m[2] ?? '').trim();
  if (token === 'fl_oz') return { quantity, unit: 'fl oz' };
  const unit = UNIT_SYNONYMS[token];
  return unit ? { quantity, unit } : null;
}
