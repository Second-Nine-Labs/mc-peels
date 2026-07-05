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
