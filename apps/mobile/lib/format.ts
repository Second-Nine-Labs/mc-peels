/** Small display formatting helpers shared across screens. */

/**
 * "kroger" / "whole_foods" -> "Kroger" / "Whole Foods".
 * Fallback for when we only have a retailer_key and no display name.
 */
export function prettifyRetailerKey(key: string): string {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "ORGANIC" -> "Organic", "GLUTEN_FREE" -> "Gluten free" (chip labels). */
export function prettifyFilterValue(value: string): string {
  const words = value.toLowerCase().split('_');
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * 4832 -> "$48.32". Offer prices arrive as integer cents; only real quotes
 * are ever formatted (null stays null — we never invent a number).
 */
export function formatCurrency(cents: number | null | undefined, currency = 'USD'): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/**
 * Per-unit price from a SKU price + parsed size, e.g. (123, 6, "ct") -> "$0.21/ct".
 * The GroceryChop move: makes a 6-count pack comparable to a dozen at a glance.
 * Returns "" when the size wasn't parseable (never a guessed rate).
 */
export function formatUnitPrice(
  skuPriceCents: number | null | undefined,
  measureQuantity: number | null | undefined,
  measureUnit: string | null | undefined,
): string {
  if (
    skuPriceCents === null ||
    skuPriceCents === undefined ||
    !measureQuantity ||
    measureQuantity <= 0 ||
    !measureUnit
  ) {
    return '';
  }
  const perUnit = skuPriceCents / measureQuantity / 100;
  // Only genuinely tiny rates (e.g. $/ml, $/g) need a 3rd digit to avoid $0.00;
  // common cases like ~10¢/oz stay at the cleaner 2 digits.
  const digits = perUnit < 0.02 ? 3 : 2;
  return `$${perUnit.toFixed(digits)}/${measureUnit}`;
}

/** "2026-07-14T18:02:11Z" -> "6:02 PM" (quote freshness stamps). */
export function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
