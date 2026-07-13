/**
 * Source material -> one structured, cartable recipe via the Anthropic API.
 *
 * Same discipline as the grocery parser (src/ai/parser.ts): a single forced
 * tool call whose input schema mirrors ExtractedRecipe exactly, then defensive
 * validation so a malformed LLM response can never crash the pipeline. The
 * special sauce is the output contract: ingredient names are born
 * Instacart-searchable and pantry staples are flagged, so every saved recipe
 * drops straight into the thrift solver and POST /carts.
 *
 * Honesty rules carry over from the rest of the house: when the source
 * material contains the actual recipe, provenance is 'transcribed'; when the
 * dish was rebuilt from a name and hints, it is 'reconstructed' and the card
 * says so.
 */

import { Anthropic, APIError } from '@anthropic-ai/sdk';
import type { Message, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import type { RecipeIngredient } from '../db/schema.js';
import { env } from '../env.js';
import type { SourceMaterial } from '../ingest/resolve.js';

/** Controlled cuisine vocabulary — the clustering key for kitchen genesis. */
export const RECIPE_CUISINES = [
  'italian',
  'mexican',
  'indian',
  'sichuan-chongqing',
  'chinese',
  'japanese',
  'korean',
  'thai',
  'vietnamese',
  'mediterranean',
  'middle-eastern',
  'french',
  'american-comfort',
  'southern-bbq',
  'latin',
  'caribbean',
  'african',
  'post-soviet',
  'breakfast',
  'baking-dessert',
  'other',
] as const;
export type RecipeCuisine = (typeof RECIPE_CUISINES)[number];

export const RECIPE_DISH_TYPES = [
  'main',
  'soup',
  'salad',
  'breakfast',
  'side',
  'snack',
  'dessert',
  'drink',
  'sauce',
] as const;
export type RecipeDishType = (typeof RECIPE_DISH_TYPES)[number];

export const RECIPE_PROVENANCES = ['transcribed', 'reconstructed'] as const;
export type RecipeProvenance = (typeof RECIPE_PROVENANCES)[number];

export const RECIPE_CONFIDENCES = ['high', 'medium', 'low'] as const;
export type RecipeConfidence = (typeof RECIPE_CONFIDENCES)[number];

export interface ExtractedRecipe {
  isRecipe: boolean;
  notRecipeReason: string | null;
  title: string;
  sub: string | null;
  description: string;
  cuisine: RecipeCuisine;
  dishType: RecipeDishType;
  serves: number;
  minutes: number;
  heat: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  provenance: RecipeProvenance;
  confidence: RecipeConfidence;
  creator: string | null;
  notes: string[];
}

/** Thrown when the Anthropic API call itself fails, or the output is unusable. */
export class RecipeExtractionError extends Error {
  /** Safe to show to end users/agents; raw API details never are. */
  readonly userMessage?: string;

  constructor(message: string, options?: { cause?: unknown; userMessage?: string }) {
    super(message, { cause: options?.cause });
    this.name = 'RecipeExtractionError';
    this.userMessage = options?.userMessage;
  }
}

// Tool definition -----------------------------------------------------------

const EXTRACT_TOOL_NAME = 'record_extracted_recipe';

/** input_schema mirrors ExtractedRecipe exactly. */
const EXTRACT_TOOL: Tool = {
  name: EXTRACT_TOOL_NAME,
  description:
    'Record the one recipe extracted (or reconstructed) from the source material. ' +
    'Always call this tool exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      is_recipe: {
        type: 'boolean',
        description:
          'False when the link is not food/recipe content at all (a dance video, a product page). ' +
          'When false, fill the other fields with empty placeholders.',
      },
      not_recipe_reason: {
        type: ['string', 'null'],
        description: 'One human-friendly sentence when is_recipe is false; otherwise null.',
      },
      title: {
        type: 'string',
        description: 'Dish name in plain English — the menu-card anchor, e.g. "Chongqing chicken".',
      },
      sub: {
        type: ['string', 'null'],
        description:
          'Native-script or traditional secondary name when natural (辣子鸡, tres leches); otherwise null. Never invented.',
      },
      description: {
        type: 'string',
        description: 'One line of menu copy in a warm, plain voice. No marketing fluff.',
      },
      cuisine: {
        type: 'string',
        enum: [...RECIPE_CUISINES],
        description: 'Best-fit cuisine. Use sichuan-chongqing for mala/Sichuan/Chongqing dishes.',
      },
      dish_type: { type: 'string', enum: [...RECIPE_DISH_TYPES] },
      serves: { type: 'integer', description: 'Servings the ingredient quantities produce.' },
      minutes: { type: 'integer', description: 'Honest total time to the table, minutes.' },
      heat: {
        type: ['integer', 'null'],
        description: 'Chile scale 0-3; null when heat is not the point of the dish.',
      },
      ingredients: {
        type: 'array',
        description: 'Everything needed to cook the dish, as purchasable grocery items.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                'Clean product name suitable for Instacart store search, e.g. "boneless chicken thighs". ' +
                'Descriptors that matter stay in the name ("dark soy sauce").',
            },
            quantity: {
              type: ['number', 'null'],
              description:
                'Purchasable quantity for the stated serves. Null only when genuinely ambiguous.',
            },
            unit: {
              type: ['string', 'null'],
              description:
                'Purchasable unit (lb, oz, each, bunch, head, dozen, can, jar, pack) — never cooking measures like tbsp or cup.',
            },
            pantry: {
              type: 'boolean',
              description:
                'True for staples a normal kitchen already has: salt, black pepper, cooking oils, common dried spices, sugar, soy sauce, vinegar. Excluded from the cart by default.',
            },
          },
          required: ['name', 'quantity', 'unit', 'pantry'],
          additionalProperties: false,
        },
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description:
          "Short imperative lines, at most 12. Keep the creator's technique; don't pad with generalities.",
      },
      provenance: {
        type: 'string',
        enum: [...RECIPE_PROVENANCES],
        description:
          "'transcribed' when the source material contains the actual ingredient list; " +
          "'reconstructed' when the dish was rebuilt from its name and partial hints.",
      },
      confidence: { type: 'string', enum: [...RECIPE_CONFIDENCES] },
      creator: {
        type: ['string', 'null'],
        description:
          'Credit: the creator handle or author named in the source material. Null when the material names nobody. Never invented.',
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Anything uncertain, assumed, or dropped — e.g. "serves was not stated; assumed 4". Never silently drop anything.',
      },
    },
    required: [
      'is_recipe',
      'not_recipe_reason',
      'title',
      'sub',
      'description',
      'cuisine',
      'dish_type',
      'serves',
      'minutes',
      'heat',
      'ingredients',
      'steps',
      'provenance',
      'confidence',
      'creator',
      'notes',
    ],
    additionalProperties: false,
  },
};

// System prompt ----------------------------------------------------------------

const SYSTEM_PROMPT = `You are the recipe extractor for MC Peels, a grocery service that turns saved recipes into Instacart shopping carts. You receive source material gathered from a link (TikTok caption, blog structured data, page text) and produce exactly one home-cookable recipe.

Rules (follow exactly):
1. When STRUCTURED RECIPE DATA is present it is authoritative for ingredients and steps; the other material is context.
2. Ingredient names must be clean product names suitable for Instacart store search ("boneless chicken thighs", "dark soy sauce"). Meaningful descriptors stay in the name; sizes and packaging do not.
3. Quantities are recipe-determined: give purchasable amounts for the stated serves. Convert cooking measures to purchasable units (lb, oz, each, bunch, head, dozen, can, jar, pack). A dish needing 2 tbsp of a sauce means buying one bottle — or pantry: true if it's a staple.
4. pantry: true for staples a normal kitchen already has (salt, black pepper, cooking oils, common dried spices, sugar, soy sauce, vinegar). Large-quantity bases (flour for a dough, rice for a pilaf) are real purchases, not pantry.
5. provenance: 'transcribed' when the material contains the actual ingredient list. 'reconstructed' when you rebuilt the dish from its name, cuisine knowledge, or partial hints — then confidence is at most 'medium' and notes must say what was rebuilt.
6. If the dish is identifiable but the material is thin (a bare TikTok caption naming the dish), reconstruct it faithfully as it is commonly made — that is the product working as intended, honestly labeled.
7. is_recipe: false only when the link is clearly not food content. A restaurant dish with no recipe still counts as a dish to reconstruct.
8. creator: only a name/handle present in the material. Never invented.
9. steps: at most 12 short imperative lines. Keep the creator's distinctive technique when the material shows it.
10. Anything assumed, ambiguous, or dropped goes in notes. Never silently drop anything.`;

// Public API -----------------------------------------------------------------

export async function extractRecipe(material: SourceMaterial): Promise<ExtractedRecipe> {
  const response = await runExtraction(buildUserMessage(material));

  const toolUse = response.content.find(
    (block): block is ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    throw new RecipeExtractionError(
      `Anthropic response contained no tool call (stop_reason: ${response.stop_reason ?? 'unknown'})`,
    );
  }

  const recipe = sanitizeExtractedRecipe(toolUse.input);
  if (recipe.isRecipe && recipe.ingredients.length === 0) {
    throw new RecipeExtractionError('Extractor returned a recipe with no ingredients', {
      userMessage: 'MC Peels could not read a shoppable recipe out of that link. Try another link for the dish.',
    });
  }
  return recipe;
}

function buildUserMessage(material: SourceMaterial): string {
  const sections: string[] = [
    `SOURCE URL: ${material.url}`,
    `PLATFORM: ${material.platform}`,
  ];
  if (material.resolvedFrom) sections.push(`RECIPE PAGE (via the link above): ${material.resolvedFrom}`);
  if (material.creator) sections.push(`CREATOR: ${material.creator}`);
  if (material.title) sections.push(`TITLE: ${material.title}`);
  if (material.caption) sections.push(`CAPTION / DESCRIPTION:\n${material.caption.slice(0, 4000)}`);
  if (material.structuredRecipe) {
    sections.push(`STRUCTURED RECIPE DATA (schema.org/Recipe):\n${JSON.stringify(material.structuredRecipe, null, 2)}`);
  }
  if (material.bodyText) sections.push(`PAGE TEXT (extracted, may include navigation noise):\n${material.bodyText}`);
  if (material.notes.length > 0) sections.push(`RESOLVER NOTES:\n- ${material.notes.join('\n- ')}`);
  return sections.join('\n\n');
}

// Internals -------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  }
  return client;
}

async function runExtraction(userMessage: string): Promise<Message> {
  let response: Message;
  try {
    response = await getClient().messages.create({
      model: env().ANTHROPIC_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_TOOL],
      tool_choice: {
        type: 'tool',
        name: EXTRACT_TOOL_NAME,
        disable_parallel_tool_use: true,
      },
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (error) {
    if (error instanceof APIError) {
      throw new RecipeExtractionError(
        `Anthropic API request failed (${error.status ?? 'connection error'}): ${error.message}`,
        { cause: error },
      );
    }
    throw new RecipeExtractionError('Anthropic API request failed', { cause: error });
  }

  // Truncated output means truncated recipe JSON: fail loudly, never partially.
  if (response.stop_reason === 'max_tokens') {
    throw new RecipeExtractionError('Anthropic response hit max_tokens; extraction is incomplete', {
      userMessage: 'That page was too much to read in one go. Try a link that goes straight to the recipe.',
    });
  }

  return response;
}

// Defensive validation of the tool output -------------------------------------

const CUISINE_SET: ReadonlySet<string> = new Set(RECIPE_CUISINES);
const DISH_TYPE_SET: ReadonlySet<string> = new Set(RECIPE_DISH_TYPES);
const MAX_INGREDIENTS = 40;
const MAX_STEPS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = cleanString(entry, maxLength);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

function sanitizeIngredient(raw: unknown): RecipeIngredient | null {
  if (!isRecord(raw)) return null;
  const name = cleanString(raw.name, 120);
  if (!name) return null;
  const quantity =
    typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) && raw.quantity > 0
      ? Math.round(raw.quantity * 100) / 100
      : undefined;
  const unit = cleanString(raw.unit, 40) ?? undefined;
  const ingredient: RecipeIngredient = { name };
  if (quantity !== undefined) ingredient.quantity = quantity;
  if (unit !== undefined) ingredient.unit = unit;
  if (raw.pantry === true) ingredient.pantry = true;
  return ingredient;
}

export function sanitizeExtractedRecipe(raw: unknown): ExtractedRecipe {
  const obj = isRecord(raw) ? raw : {};
  const notes = cleanStringArray(obj.notes, 12, 300);

  const rawIngredients = Array.isArray(obj.ingredients) ? obj.ingredients : [];
  const ingredients: RecipeIngredient[] = [];
  let dropped = 0;
  for (const entry of rawIngredients) {
    const ingredient = sanitizeIngredient(entry);
    if (!ingredient) {
      dropped += 1;
      continue;
    }
    if (ingredients.length < MAX_INGREDIENTS) ingredients.push(ingredient);
  }
  if (dropped > 0) notes.push(`Dropped ${dropped} malformed ingredient(s) from the extractor output.`);
  if (rawIngredients.length > MAX_INGREDIENTS) {
    notes.push(`Kept the first ${MAX_INGREDIENTS} ingredients of ${rawIngredients.length}.`);
  }

  const cuisineRaw = cleanString(obj.cuisine, 40)?.toLowerCase();
  const cuisine: RecipeCuisine =
    cuisineRaw && CUISINE_SET.has(cuisineRaw) ? (cuisineRaw as RecipeCuisine) : 'other';

  const dishTypeRaw = cleanString(obj.dish_type, 20)?.toLowerCase();
  const dishType: RecipeDishType =
    dishTypeRaw && DISH_TYPE_SET.has(dishTypeRaw) ? (dishTypeRaw as RecipeDishType) : 'main';

  const provenance: RecipeProvenance = obj.provenance === 'transcribed' ? 'transcribed' : 'reconstructed';
  const confidence: RecipeConfidence =
    obj.confidence === 'high' || obj.confidence === 'medium' || obj.confidence === 'low'
      ? obj.confidence
      : 'low';

  const heatRaw = obj.heat;
  const heat =
    typeof heatRaw === 'number' && Number.isFinite(heatRaw)
      ? Math.min(Math.max(Math.round(heatRaw), 0), 3)
      : null;

  return {
    isRecipe: obj.is_recipe !== false,
    notRecipeReason: cleanString(obj.not_recipe_reason, 300),
    title: cleanString(obj.title, 120) ?? 'Untitled dish',
    sub: cleanString(obj.sub, 120),
    description: cleanString(obj.description, 300) ?? '',
    cuisine,
    dishType,
    serves: clampInt(obj.serves, 1, 24, 4),
    minutes: clampInt(obj.minutes, 1, 2880, 45),
    heat,
    ingredients,
    steps: cleanStringArray(obj.steps, MAX_STEPS, 500),
    provenance,
    confidence,
    creator: cleanString(obj.creator, 120),
    notes,
  };
}
