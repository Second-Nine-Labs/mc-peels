/**
 * NL parsing via the Anthropic API (PRD sections 6 and 8).
 *
 * Turns a free-text grocery request (or pre-structured items) into
 * ParsedLineItems using a single forced tool call whose input schema mirrors
 * ParseResult exactly. All tool output is defensively validated/clamped so a
 * malformed LLM response can never crash the pipeline.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';
import {
  HEALTH_FILTERS,
  ITEM_CATEGORIES,
  type DietaryProfileRules,
  type HealthFilter,
  type ItemCategory,
  type ParsedLineItem,
  type ParseResult,
} from '../types.js';

/** Thrown when the Anthropic API call itself fails (network, auth, 4xx/5xx). */
export class ParserError extends Error {
  /** Safe to show to end users/agents; raw API details never are. */
  readonly userMessage?: string;

  constructor(message: string, options?: { cause?: unknown; userMessage?: string }) {
    super(message, { cause: options?.cause });
    this.name = 'ParserError';
    this.userMessage = options?.userMessage;
  }
}

// Tool definition -----------------------------------------------------------

const PARSE_TOOL_NAME = 'record_parsed_grocery_items';

/** input_schema mirrors ParseResult / ParsedLineItem from src/types.ts exactly. */
const PARSE_TOOL: Anthropic.Tool = {
  name: PARSE_TOOL_NAME,
  description:
    'Record the parsed grocery line items and parser-level notes. ' +
    'Always call this tool exactly once with every line item from the request.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'One entry per grocery line item in the request.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                'Clean product name suitable for Instacart store search, e.g. "bananas" or "grass-fed beef".',
            },
            quantity: {
              type: ['number', 'null'],
              description:
                'Quantity ONLY if the user explicitly stated one; otherwise null. Never invented.',
            },
            unit: {
              type: ['string', 'null'],
              description:
                'Unit ONLY if the user explicitly stated one (e.g. "lb", "each"); otherwise null.',
            },
            category: {
              type: 'string',
              enum: [...ITEM_CATEGORIES],
              description: 'Best-fit grocery category for this item.',
            },
            explicitHealthFilters: {
              type: 'array',
              items: { type: 'string', enum: [...HEALTH_FILTERS] },
              description:
                'Health filters the user literally asked for on this item ("organic bananas" -> ORGANIC).',
            },
            explicitBrands: {
              type: 'array',
              items: { type: 'string' },
              description: 'Brands the user explicitly named for this item.',
            },
            matchedPreferredBrands: {
              type: 'array',
              items: { type: 'string' },
              description:
                "Household preferred brands plausibly relevant to this item's category. Never force a brand onto an unrelated item.",
            },
            allergenConflicts: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Household allergens / excluded ingredients this item likely contains or commonly contains.',
            },
          },
          required: [
            'name',
            'quantity',
            'unit',
            'category',
            'explicitHealthFilters',
            'explicitBrands',
            'matchedPreferredBrands',
            'allergenConflicts',
          ],
          additionalProperties: false,
        },
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Parser-level notes, e.g. parts of the request that could not be interpreted. Never silently drop anything.',
      },
    },
    required: ['items', 'notes'],
    additionalProperties: false,
  },
};

// System prompts -------------------------------------------------------------

const BASE_RULES = `You are the natural-language grocery request parser for MC Peels, a multi-tenant grocery service. You convert a household member's request into structured grocery line items used for Instacart shopping-list search.

Rules (follow exactly):
1. Split the request into individual grocery line items with clean product names suitable for store search.
2. NEVER invent a quantity or unit. Set quantity and unit to null unless the user explicitly stated them. Do not assume family size, pack counts, or typical amounts.
3. explicitHealthFilters: include only health filters the user literally asked for on that specific item (e.g. "organic bananas" -> ORGANIC). Modifiers that are not supported health filters (e.g. "grass-fed", "lean", "free-range", "wild-caught") are NOT health filters — keep them as part of the item name instead (e.g. "grass-fed beef").
4. explicitBrands: include only brands the user explicitly named for that item.
5. matchedPreferredBrands: from the household's preferred brands provided in the message, include only brands plausibly relevant to the item's category. Never force a brand onto an unrelated item; if unsure, leave it out.
6. allergenConflicts: include household allergens or excluded ingredients (provided in the message) that the item likely contains or commonly contains. This is a judgment call — err toward flagging. These are surfaced to the human as warnings and are never treated as safety guarantees.
7. Anything in the request you cannot interpret as a grocery item must be reported in notes. Never silently drop any part of the request.`;

const FREE_TEXT_SYSTEM_PROMPT = BASE_RULES;

const STRUCTURED_SYSTEM_PROMPT = `${BASE_RULES}

The user message contains pre-structured items (JSON) instead of free text. Additional rules:
8. Keep every item's name, quantity, and unit EXACTLY as given — verbatim. Do not rename, reword, split, or merge items, and do not invent quantities or units. If a quantity or unit is missing, return null for it.
9. Return exactly one output item per input item, in the same order as the input.
10. Your only additions are judgments: category, any explicitHealthFilters/explicitBrands already present in the given item name, matchedPreferredBrands, and allergenConflicts.`;

// Public API -----------------------------------------------------------------

/** Parse a free-text grocery request into structured line items. */
export async function parseRequest(
  rawText: string,
  profile: DietaryProfileRules,
): Promise<ParseResult> {
  if (rawText.trim().length === 0) {
    return { items: [], notes: ['The request text was empty; nothing to parse.'] };
  }

  const userMessage = [
    profileContext(profile),
    'Grocery request:',
    '"""',
    rawText,
    '"""',
  ].join('\n\n');

  return runParse(FREE_TEXT_SYSTEM_PROMPT, userMessage);
}

/**
 * Same LLM pass over pre-structured items (MCP callers). Names, quantities,
 * and units are preserved verbatim; the model only adds category,
 * brand-relevance, and allergen-conflict judgments.
 */
export async function parseStructuredItems(
  items: Array<{ name: string; quantity?: number; unit?: string }>,
  profile: DietaryProfileRules,
): Promise<ParseResult> {
  if (items.length === 0) {
    return { items: [], notes: [] };
  }

  const userMessage = [
    profileContext(profile),
    'Pre-structured grocery items (JSON):',
    JSON.stringify(items, null, 2),
  ].join('\n\n');

  const result = await runParse(STRUCTURED_SYSTEM_PROMPT, userMessage);

  // Deterministically enforce the verbatim guarantee: the model was told to
  // return one output item per input item in order, so when counts line up we
  // overwrite name/quantity/unit from the caller's input.
  if (result.items.length === items.length) {
    result.items = result.items.map((parsed, i) => {
      const given = items[i];
      if (!given) return parsed; // unreachable (lengths match); satisfies noUncheckedIndexedAccess
      return {
        ...parsed,
        name: given.name,
        quantity: given.quantity ?? null,
        unit: given.unit ?? null,
      };
    });
  } else {
    result.notes.push(
      `Parser returned ${result.items.length} item(s) for ${items.length} structured input(s); ` +
        'names and quantities could not be matched verbatim — please review the list.',
    );
  }

  return result;
}

// Internals -------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  }
  return client;
}

async function runParse(systemPrompt: string, userMessage: string): Promise<ParseResult> {
  let response: Anthropic.Message;
  try {
    response = await getClient().messages.create({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 16384,
      system: systemPrompt,
      tools: [PARSE_TOOL],
      tool_choice: {
        type: 'tool',
        name: PARSE_TOOL_NAME,
        disable_parallel_tool_use: true,
      },
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new ParserError(
        `Anthropic API request failed (${error.status ?? 'connection error'}): ${error.message}`,
        { cause: error },
      );
    }
    throw new ParserError('Anthropic API request failed', { cause: error });
  }

  // A truncated response means truncated tool-input JSON: fail loudly rather
  // than silently returning a shortened grocery list.
  if (response.stop_reason === 'max_tokens') {
    throw new ParserError('Anthropic response hit max_tokens; parse output is incomplete', {
      userMessage:
        'That grocery request is too large to parse in one go — please split it into smaller requests.',
    });
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    throw new ParserError(
      `Anthropic response contained no tool call (stop_reason: ${response.stop_reason ?? 'unknown'})`,
    );
  }

  return sanitizeParseResult(toolUse.input);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'none';
}

function profileContext(profile: DietaryProfileRules): string {
  return [
    'Household dietary profile (context for brand matching and allergen flagging):',
    `- Preferred brands: ${formatList(profile.preferredBrands)}`,
    `- Allergens: ${formatList(profile.allergens)}`,
    `- Excluded ingredients: ${formatList(profile.excludedIngredients)}`,
    `- Profile notes: ${profile.notes ?? 'none'}`,
  ].join('\n');
}

// Defensive validation of the tool output -------------------------------------

const CATEGORY_SET: ReadonlySet<string> = new Set(ITEM_CATEGORIES);
const HEALTH_FILTER_SET: ReadonlySet<string> = new Set(HEALTH_FILTERS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Trimmed, non-empty, deduped string array; anything else is dropped. */
function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0 && !out.includes(trimmed)) out.push(trimmed);
  }
  return out;
}

/** Bad category -> 'other'. */
function sanitizeCategory(value: unknown): ItemCategory {
  if (typeof value === 'string') {
    const candidate = value.trim().toLowerCase();
    if (CATEGORY_SET.has(candidate)) return candidate as ItemCategory;
  }
  return 'other';
}

/** Unknown health filters are dropped. */
function sanitizeHealthFilters(value: unknown): HealthFilter[] {
  if (!Array.isArray(value)) return [];
  const out: HealthFilter[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const candidate = entry.trim().toUpperCase();
    if (HEALTH_FILTER_SET.has(candidate) && !out.includes(candidate as HealthFilter)) {
      out.push(candidate as HealthFilter);
    }
  }
  return out;
}

function sanitizeQuantity(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function sanitizeUnit(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeItem(raw: unknown): ParsedLineItem | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length === 0) return null;
  return {
    name,
    quantity: sanitizeQuantity(raw.quantity),
    unit: sanitizeUnit(raw.unit),
    category: sanitizeCategory(raw.category),
    explicitHealthFilters: sanitizeHealthFilters(raw.explicitHealthFilters),
    explicitBrands: sanitizeStringArray(raw.explicitBrands),
    matchedPreferredBrands: sanitizeStringArray(raw.matchedPreferredBrands),
    allergenConflicts: sanitizeStringArray(raw.allergenConflicts),
  };
}

function sanitizeParseResult(raw: unknown): ParseResult {
  const obj = isRecord(raw) ? raw : {};
  const rawItems = Array.isArray(obj.items) ? obj.items : [];

  const items: ParsedLineItem[] = [];
  let dropped = 0;
  for (const entry of rawItems) {
    const item = sanitizeItem(entry);
    if (item) {
      items.push(item);
    } else {
      dropped += 1;
    }
  }

  const notes = sanitizeStringArray(obj.notes);
  if (dropped > 0) {
    notes.push(`Dropped ${dropped} malformed item(s) from the parser output.`);
  }

  return { items, notes };
}
