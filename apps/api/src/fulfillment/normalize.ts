/**
 * Deterministic text normalization shared by provider catalog matching.
 * Pure functions — no I/O, no LLM — so ranking stays snapshot-testable.
 */

/** Words that carry no signal for grocery catalog search. */
const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'and', 'fresh']);

/** Combining diacritical marks left behind by NFD decomposition. */
const DIACRITICS = /[̀-ͯ]/g;

/** Lowercase, strip diacritics/punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Naive singularization: trailing 's' on words longer than 3 chars (not 'ss'). */
function singularize(token: string): string {
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

/** Normalized, stopword-free, singularized tokens for matching. */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(singularize);
}

/** Cache key for a search term: normalized token string. */
export function normalizedTerm(input: string): string {
  return tokenize(input).join(' ');
}
