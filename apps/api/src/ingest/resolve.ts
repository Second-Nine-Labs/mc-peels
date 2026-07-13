/**
 * URL -> source material for the recipe extractor (the shelf's front half).
 *
 * Every platform yields its evidence differently: TikTok and YouTube answer
 * oEmbed, recipe blogs carry schema.org/Recipe JSON-LD (the gold path),
 * Pinterest pins point onward to blogs, Instagram mostly refuses to answer.
 * This module gathers whatever a link will honestly give up — caption,
 * structured recipe, page text — and records what it couldn't get in `notes`,
 * so the extractor downstream can label the result transcribed vs
 * reconstructed instead of pretending.
 *
 * Network access is injectable (fetchImpl) and budgeted: the whole resolve
 * works against one deadline so a slow page can't eat the request.
 */

export type SourcePlatform = 'tiktok' | 'instagram' | 'pinterest' | 'youtube' | 'web';

/** A trimmed schema.org/Recipe — only the fields the extractor reads. */
export interface StructuredRecipe {
  name?: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  yield?: string;
  totalTime?: string;
  cuisine?: string;
  keywords?: string;
  author?: string;
}

export interface SourceMaterial {
  /** Final URL after shortener/redirect resolution, normalized. */
  url: string;
  platform: SourcePlatform;
  creator: string | null;
  /** Platform-reported title (video title, og:title) — not the dish name. */
  title: string | null;
  /** Caption / description text straight from the platform. */
  caption: string | null;
  /** schema.org/Recipe found on the page (or a page it links to). */
  structuredRecipe: StructuredRecipe | null;
  /** Readable page text fallback when no structured recipe exists. Capped. */
  bodyText: string | null;
  /** Set when the recipe data came from a linked page (pin -> blog). */
  resolvedFrom: string | null;
  /** Honest trail: what answered, what refused. Surfaced to the human. */
  notes: string[];
}

export interface ResolveOptions {
  fetchImpl?: typeof fetch;
  /** Total network budget for the whole resolve. */
  budgetMs?: number;
}

// URL hygiene ----------------------------------------------------------------

/** Share links arrive wearing tracking params; strip them so the same recipe
 * pasted twice dedupes to one row. Query order is normalized for the same
 * reason. Throws on anything that isn't http(s). */
export function normalizeSourceUrl(raw: string): string {
  let candidate = raw.trim();
  if (candidate.length === 0) throw new Error('Empty URL');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;

  const url = new URL(candidate);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  const drop: string[] = [];
  for (const key of url.searchParams.keys()) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
      drop.push(key);
    }
  }
  for (const key of drop) url.searchParams.delete(key);
  url.searchParams.sort();
  // URL keeps a bare '?' when the last param is deleted; serialize without it.
  return url.toString().replace(/\?$/, '');
}

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igsh',
  'igshid',
  'si',
  'feature',
  'is_from_webapp',
  'sender_device',
  'sender_web_id',
  'web_id',
  'mc_cid',
  'mc_eid',
  '_t',
  '_r',
  'checksum',
  'share_app_id',
  'share_link_id',
  'source',
  'ref',
]);

export function detectPlatform(urlStr: string): SourcePlatform {
  let host: string;
  try {
    host = new URL(urlStr).hostname.toLowerCase();
  } catch {
    return 'web';
  }
  const bare = host.replace(/^(www|m)\./, '');
  if (bare === 'tiktok.com' || bare.endsWith('.tiktok.com')) return 'tiktok';
  if (bare === 'instagram.com' || bare.endsWith('.instagram.com') || bare === 'instagr.am') {
    return 'instagram';
  }
  if (bare === 'pin.it' || bare === 'pinterest.com' || bare.includes('.pinterest.') || bare.startsWith('pinterest.')) {
    return 'pinterest';
  }
  if (bare === 'youtube.com' || bare.endsWith('.youtube.com') || bare === 'youtu.be') {
    return 'youtube';
  }
  return 'web';
}

/** Hosts that are pure redirects; resolve them before reading anything. */
function isShortener(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || host === 'pin.it';
  } catch {
    return false;
  }
}

// HTML mining ----------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** og:<prop> content, tolerant of attribute order and of apostrophes inside
 * double-quoted values ("Nonna's ragu"). */
export function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content='([^']*)'`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]*(?:property|name)=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]+content='([^']*)'[^>]*(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = decodeEntities(match[1]).trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

/** All schema.org/Recipe nodes in the page's JSON-LD, trimmed to what we read. */
export function extractJsonLdRecipes(html: string): StructuredRecipe[] {
  const out: StructuredRecipe[] = [];
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]!.trim());
    } catch {
      continue; // Malformed blocks are common in the wild; skip, don't fail.
    }
    for (const node of flattenJsonLdNodes(parsed)) {
      if (!isRecipeNode(node)) continue;
      const recipe = toStructuredRecipe(node);
      if (recipe.ingredients.length > 0 || recipe.name) out.push(recipe);
    }
  }
  return out;
}

function flattenJsonLdNodes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLdNodes);
  if (typeof value !== 'object' || value === null) return [];
  const node = value as Record<string, unknown>;
  const nested = '@graph' in node ? flattenJsonLdNodes(node['@graph']) : [];
  return [node, ...nested];
}

function isRecipeNode(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = decodeEntities(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number') return String(value);
  return undefined;
}

function asStringList(value: unknown, cap: number): string[] {
  const list = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  const out: string[] = [];
  for (const entry of list) {
    const text = asString(entry);
    if (text) out.push(text.slice(0, 300));
    if (out.length >= cap) break;
  }
  return out;
}

function flattenInstructions(value: unknown, out: string[] = []): string[] {
  if (out.length >= 30) return out;
  if (typeof value === 'string') {
    const text = decodeEntities(value).replace(/<[^>]+>/g, ' ').trim();
    if (text) out.push(text.slice(0, 400));
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) flattenInstructions(entry, out);
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    const node = value as Record<string, unknown>;
    if ('itemListElement' in node) return flattenInstructions(node.itemListElement, out);
    const text = asString(node.text) ?? asString(node.name);
    if (text) out.push(text.slice(0, 400));
    return out;
  }
  return out;
}

function toStructuredRecipe(node: Record<string, unknown>): StructuredRecipe {
  const author = node.author;
  const authorName = Array.isArray(author)
    ? asString((author[0] as Record<string, unknown> | undefined)?.name) ?? asString(author[0])
    : typeof author === 'object' && author !== null
      ? asString((author as Record<string, unknown>).name)
      : asString(author);

  return {
    name: asString(node.name),
    description: asString(node.description)?.slice(0, 500),
    ingredients: asStringList(node.recipeIngredient ?? node.ingredients, 60),
    instructions: flattenInstructions(node.recipeInstructions),
    yield: asStringList(node.recipeYield, 1)[0],
    totalTime: asString(node.totalTime) ?? asString(node.cookTime) ?? asString(node.prepTime),
    cuisine: asStringList(node.recipeCuisine, 3).join(', ') || undefined,
    keywords: asStringList(node.keywords, 10).join(', ') || undefined,
    author: authorName,
  };
}

/** Readable text fallback: tags stripped, scripts dropped, whitespace tamed. */
export function htmlToText(html: string, cap = 6000): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const withBreaks = withoutBlocks.replace(/<\/(p|div|li|h[1-6]|tr|section|article)>|<br\s*\/?>/gi, '\n');
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '));
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
  return lines.join('\n').slice(0, cap);
}

/** Pinterest embeds the pin's outbound destination in JSON blobs as "link".
 * First non-Pinterest candidate wins. */
export function extractPinterestOutboundLink(html: string): string | null {
  const pattern = /"link"\s*:\s*"(https?:(?:\\\/|\\u[0-9a-fA-F]{4}|[^"\\])+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const candidate = match[1]!
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
      .replace(/\\\//g, '/');
    try {
      const host = new URL(candidate).hostname.toLowerCase();
      if (host.includes('pinterest') || host.includes('pinimg') || host === 'pin.it') continue;
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

// Fetching -------------------------------------------------------------------

/** A browser-shaped UA: several platforms serve bots an empty shell. We read
 * only what any signed-out visitor would see. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const MAX_HTML_CHARS = 500_000;
const PER_FETCH_MS = 8000;

interface FetchedPage {
  url: string;
  status: number;
  ok: boolean;
  text: string;
}

class Budget {
  private readonly deadline: number;

  constructor(totalMs: number) {
    this.deadline = Date.now() + totalMs;
  }

  /** Time available for the next request; null when it isn't worth starting. */
  nextTimeout(): number | null {
    const remaining = this.deadline - Date.now();
    if (remaining < 800) return null;
    return Math.min(remaining, PER_FETCH_MS);
  }
}

async function fetchPage(
  fetchImpl: typeof fetch,
  budget: Budget,
  url: string,
  notes: string[],
  accept = 'text/html,application/xhtml+xml',
): Promise<FetchedPage | null> {
  const timeout = budget.nextTimeout();
  if (timeout === null) {
    notes.push('Ran out of time before every source could be read.');
    return null;
  }
  try {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
    });
    const text = (await response.text()).slice(0, MAX_HTML_CHARS);
    return { url: response.url || url, status: response.status, ok: response.ok, text };
  } catch {
    return null;
  }
}

async function fetchOembed(
  fetchImpl: typeof fetch,
  budget: Budget,
  endpoint: string,
): Promise<{ title?: string; authorName?: string } | null> {
  const timeout = budget.nextTimeout();
  if (timeout === null) return null;
  try {
    const response = await fetchImpl(endpoint, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      authorName: typeof data.author_name === 'string' ? data.author_name : undefined,
    };
  } catch {
    return null;
  }
}

// The resolve ------------------------------------------------------------------

export async function resolveSource(rawUrl: string, opts: ResolveOptions = {}): Promise<SourceMaterial> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const budget = new Budget(opts.budgetMs ?? 9000);
  const notes: string[] = [];

  let url = normalizeSourceUrl(rawUrl);
  let prefetched: FetchedPage | null = null;

  if (isShortener(url)) {
    const page = await fetchPage(fetchImpl, budget, url, notes);
    if (page && page.url !== url) {
      try {
        url = normalizeSourceUrl(page.url);
        prefetched = page;
      } catch {
        notes.push('The short link unfurled somewhere unreadable; reading it as-is.');
      }
    } else if (!page) {
      notes.push('The short link would not unfurl; reading it as-is.');
    }
  }

  const platform = detectPlatform(url);
  const material: SourceMaterial = {
    url,
    platform,
    creator: null,
    title: null,
    caption: null,
    structuredRecipe: null,
    bodyText: null,
    resolvedFrom: null,
    notes,
  };

  switch (platform) {
    case 'tiktok': {
      const oembed = await fetchOembed(
        fetchImpl,
        budget,
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      );
      if (oembed?.title) {
        // TikTok's oEmbed `title` is the caption — where creators paste the recipe.
        material.caption = oembed.title;
        material.creator = oembed.authorName ?? null;
      } else {
        notes.push('TikTok did not hand over the caption; the dish will be rebuilt from the link alone.');
      }
      break;
    }

    case 'youtube': {
      const oembed = await fetchOembed(
        fetchImpl,
        budget,
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      );
      if (oembed) {
        material.title = oembed.title ?? null;
        material.creator = oembed.authorName ?? null;
      }
      const page = await fetchPage(fetchImpl, budget, url, notes);
      const description = page?.ok ? metaContent(page.text, 'og:description') : null;
      if (description) material.caption = description;
      if (!oembed && !description) {
        notes.push('YouTube shared nothing about this video; the dish will be rebuilt from the link alone.');
      }
      break;
    }

    case 'instagram': {
      const page = await fetchPage(fetchImpl, budget, url, notes);
      const title = page?.ok ? metaContent(page.text, 'og:title') : null;
      const description = page?.ok ? metaContent(page.text, 'og:description') : null;
      if (title || description) {
        material.title = title;
        material.caption = description ?? title;
        const creatorMatch = title?.match(/^(.{1,80}?) (?:on Instagram|•)/);
        material.creator = creatorMatch?.[1] ?? null;
      } else {
        notes.push('Instagram kept the caption behind the login wall; the dish will be rebuilt and flagged.');
      }
      break;
    }

    case 'pinterest': {
      const page = prefetched ?? (await fetchPage(fetchImpl, budget, url, notes));
      if (!page || !page.ok) {
        notes.push('Pinterest would not serve the pin; the dish will be rebuilt from the link alone.');
        break;
      }
      material.title = metaContent(page.text, 'og:title');
      material.caption = metaContent(page.text, 'og:description');

      const onPin = extractJsonLdRecipes(page.text);
      if (onPin.length > 0) {
        material.structuredRecipe = onPin[0]!;
        break;
      }

      const outbound = extractPinterestOutboundLink(page.text);
      if (!outbound) {
        notes.push('The pin pointed nowhere further; working from the pin card itself.');
        break;
      }
      const blog = await fetchPage(fetchImpl, budget, outbound, notes);
      if (!blog || !blog.ok) {
        notes.push('The pin points at a page that would not load; working from the pin card itself.');
        break;
      }
      material.resolvedFrom = blog.url;
      const recipes = extractJsonLdRecipes(blog.text);
      if (recipes.length > 0) {
        material.structuredRecipe = recipes[0]!;
      } else {
        material.bodyText = htmlToText(blog.text);
        material.title ??= metaContent(blog.text, 'og:title');
        material.caption ??= metaContent(blog.text, 'og:description');
      }
      break;
    }

    case 'web': {
      const page = prefetched ?? (await fetchPage(fetchImpl, budget, url, notes));
      if (!page || !page.ok) {
        notes.push(
          page
            ? `The page answered ${page.status}; the dish will be rebuilt from the link alone.`
            : 'The page would not load; the dish will be rebuilt from the link alone.',
        );
        break;
      }
      material.title = metaContent(page.text, 'og:title');
      material.caption = metaContent(page.text, 'og:description');
      const recipes = extractJsonLdRecipes(page.text);
      if (recipes.length > 0) {
        material.structuredRecipe = recipes[0]!;
      } else {
        material.bodyText = htmlToText(page.text);
      }
      break;
    }
  }

  return material;
}
