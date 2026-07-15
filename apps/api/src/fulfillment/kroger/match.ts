/**
 * Kroger catalog matching: free-text cart items → priced store products.
 *
 * Pure and deterministic (no I/O, no LLM) so every ranking decision is
 * unit-testable. The honesty contract: a line item either matches a real
 * priced product (with a confidence label) or it is visibly "not priced" and
 * excluded from the subtotal. Nothing is ever estimated.
 */

import type { OfferItemMatch } from '../../db/schema.js';
import { normalizeText, tokenize } from '../normalize.js';
import { parseMeasure } from '../unit-price.js';
import type { KrogerCandidate, KrogerProduct } from './api-types.js';

/** Kroger's minimum filter.term length. */
export const MIN_TERM_LENGTH = 3;

/** Quote at most this many items per cart — rate-limit budget (10k/day). */
export const MAX_ITEMS_PER_QUOTE = 25;

/**
 * Product-form words: a candidate containing one of these when the request
 * didn't ask for it is a different product, not a match ("bananas" must not
 * resolve to "banana chips"). Stored singularized to align with tokenize().
 */
const FORM_WORDS = new Set([
  'juice',
  'sauce',
  'mix',
  'bread',
  'chip',
  'candy',
  'flavored',
  'drink',
  'soda',
  'scented',
  'powder',
  'dried',
  'cake',
  'pudding',
  'yogurt',
]);

/** Units meaning "discrete count of the item". */
const EACH_UNITS = new Set(['each', 'ea', 'ct', 'count', 'pc', 'pcs', 'piece', 'pieces']);

const MAX_EACH_QUANTITY = 20;

/** The slice of a resolved line item the matcher needs. */
export interface MatchableItem {
  id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  healthFilters: string[];
  brandFilters: string[];
}

/** Search term sent to Kroger: brand + attribute words + name, ≤ 8 words. */
export function buildSearchTerm(item: MatchableItem): string {
  const parts: string[] = [];
  if (item.brandFilters[0]) parts.push(item.brandFilters[0]);
  if (item.healthFilters.includes('ORGANIC')) parts.push('organic');
  if (item.healthFilters.includes('GLUTEN_FREE')) parts.push('gluten free');
  parts.push(item.name);
  return normalizeText(parts.join(' ')).split(' ').slice(0, 8).join(' ');
}

/** Flatten API products to candidates, keeping only ones with a real price. */
export function toCandidates(products: KrogerProduct[]): KrogerCandidate[] {
  const candidates: KrogerCandidate[] = [];
  for (const product of products) {
    const variant = product.items?.find((i) => typeof i.price?.regular === 'number');
    const regular = variant?.price?.regular;
    if (variant === undefined || typeof regular !== 'number' || regular <= 0) continue;
    const promo = variant.price?.promo;
    candidates.push({
      product_id: product.productId,
      upc: product.upc,
      brand: product.brand,
      description: product.description,
      size: variant.size,
      sold_by: variant.soldBy,
      regular_cents: Math.round(regular * 100),
      promo_cents: typeof promo === 'number' && promo > 0 ? Math.round(promo * 100) : null,
    });
  }
  return candidates;
}

/** Effective shelf price: promo when it truly undercuts regular. */
function effectiveCents(c: KrogerCandidate): number {
  if (c.promo_cents !== null && c.regular_cents !== null && c.promo_cents < c.regular_cents) {
    return c.promo_cents;
  }
  return c.regular_cents ?? 0;
}

export interface ScoredCandidate {
  candidate: KrogerCandidate;
  score: number;
}

/** Deterministic relevance score — see plan for the formula rationale. */
export function scoreCandidate(item: MatchableItem, candidate: KrogerCandidate): number {
  const qTokens = new Set([
    ...tokenize(item.name),
    ...(item.healthFilters.includes('ORGANIC') ? ['organic'] : []),
    ...(item.healthFilters.includes('GLUTEN_FREE') ? ['gluten', 'free'] : []),
  ]);
  const cTokens = new Set(tokenize(`${candidate.description} ${candidate.brand ?? ''}`));
  if (qTokens.size === 0) return 0;

  let overlap = 0;
  for (const t of qTokens) if (cTokens.has(t)) overlap += 1;
  let score = overlap / qTokens.size;

  if (normalizeText(candidate.description).includes(normalizeText(item.name))) {
    score += 0.15;
  }

  if (item.brandFilters.length > 0) {
    const requestedBrand = new Set(item.brandFilters.flatMap((b) => tokenize(b)));
    const candidateBrand = new Set(tokenize(candidate.brand ?? ''));
    const brandHit = [...requestedBrand].some((t) => candidateBrand.has(t));
    score += brandHit ? 0.2 : -0.25;
  }

  const candidateOrganic = cTokens.has('organic');
  if (item.healthFilters.includes('ORGANIC')) {
    score += candidateOrganic ? 0.1 : -0.3;
  } else if (candidateOrganic) {
    score -= 0.05; // don't silently upsell organic
  }

  let formPenalty = 0;
  for (const t of cTokens) {
    if (FORM_WORDS.has(t) && !qTokens.has(t)) formPenalty += 0.35;
  }
  score -= Math.min(formPenalty, 0.7);

  score -= Math.min(0.02 * Math.max(0, cTokens.size - qTokens.size - 4), 0.1);

  return score;
}

/** Rank candidates: score desc → effective price asc → description asc. */
export function rankCandidates(item: MatchableItem, candidates: KrogerCandidate[]): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(item, candidate) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        effectiveCents(a.candidate) - effectiveCents(b.candidate) ||
        a.candidate.description.localeCompare(b.candidate.description),
    );
}

export function confidenceFor(score: number): 'high' | 'medium' | 'low' | null {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.3) return 'low';
  return null;
}

export interface MappedQuantity {
  quantity: number;
  warnings: string[];
}

/**
 * Free-text quantity/unit → a discrete Kroger cart quantity. Weight/volume/
 * container units degrade to 1 of the best SKU with an explicit warning —
 * better an honest "confirm the size" than a silently wrong ×2.
 */
export function mapQuantity(
  quantity: number | null,
  unit: string | null,
  skuSize: string | undefined,
): MappedQuantity {
  const normalizedUnit = unit === null ? null : normalizeText(unit);
  if (normalizedUnit === null || normalizedUnit === '' || EACH_UNITS.has(normalizedUnit)) {
    const count = Math.max(1, Math.ceil(quantity ?? 1));
    if (count > MAX_EACH_QUANTITY) {
      return {
        quantity: MAX_EACH_QUANTITY,
        warnings: [`Quantity capped at ${MAX_EACH_QUANTITY} — adjust on Kroger if you need more.`],
      };
    }
    return { quantity: count, warnings: [] };
  }
  if (normalizedUnit === 'dozen' || normalizedUnit === 'dozens') {
    // The SKU is the dozen (eggs, donuts) — count of packages.
    return { quantity: Math.max(1, Math.ceil(quantity ?? 1)), warnings: [] };
  }
  return {
    quantity: 1,
    warnings: [
      `Sized by weight/volume — confirm the size (${skuSize ?? 'see product'}) on Kroger.`,
    ],
  };
}

/** Resolve one line item against its ranked candidates. */
export function matchItem(item: MatchableItem, candidates: KrogerCandidate[]): OfferItemMatch {
  const base = {
    line_item_id: item.id,
    requested_name: item.name,
    requested_quantity: item.quantity,
    requested_unit: item.unit,
  };

  const ranked = rankCandidates(item, candidates);
  const best = ranked[0];
  const confidence = best ? confidenceFor(best.score) : null;

  if (!best || confidence === null) {
    return {
      ...base,
      status: 'no_match',
      confidence: null,
      product: null,
      quantity: 0,
      unit_price_cents: null,
      regular_price_cents: null,
      promo_price_cents: null,
      line_total_cents: null,
      promo_savings_cents: 0,
      warnings: [],
    };
  }

  const c = best.candidate;
  const { quantity, warnings } = mapQuantity(item.quantity, item.unit, c.size);
  const unitCents = effectiveCents(c);
  const promoActive =
    c.promo_cents !== null && c.regular_cents !== null && c.promo_cents < c.regular_cents;
  const measure = parseMeasure(c.size);

  return {
    ...base,
    status: 'matched',
    confidence,
    product: {
      product_id: c.product_id,
      upc: c.upc,
      description: c.description,
      brand: c.brand,
      size: c.size,
      sold_by: c.sold_by,
    },
    quantity,
    unit_price_cents: unitCents,
    regular_price_cents: c.regular_cents,
    promo_price_cents: c.promo_cents,
    line_total_cents: unitCents * quantity,
    promo_savings_cents: promoActive ? (c.regular_cents! - c.promo_cents!) * quantity : 0,
    measure_quantity: measure?.quantity ?? null,
    measure_unit: measure?.unit ?? null,
    warnings,
  };
}

export interface QuoteRollup {
  subtotalCents: number;
  promoSavingsCents: number;
  matchedCount: number;
  totalCount: number;
}

/** Sum matched lines only — unmatched items are excluded, never guessed. */
export function rollup(matches: OfferItemMatch[]): QuoteRollup {
  let subtotalCents = 0;
  let promoSavingsCents = 0;
  let matchedCount = 0;
  for (const m of matches) {
    if (m.status !== 'matched' || m.line_total_cents === null) continue;
    matchedCount += 1;
    subtotalCents += m.line_total_cents;
    promoSavingsCents += m.promo_savings_cents;
  }
  return { subtotalCents, promoSavingsCents, matchedCount, totalCount: matches.length };
}
