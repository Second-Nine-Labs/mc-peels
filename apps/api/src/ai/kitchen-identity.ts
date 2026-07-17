/**
 * A generated kitchen identity via the Anthropic API (Stage 3).
 *
 * When the Shelf mints a kitchen for a cuisine that has no hand-built flagship
 * costume, this writes its identity once — as if art-directing a real, beloved
 * neighborhood restaurant grown from the household's own saves. Same forced-
 * tool discipline as the recipe extractor and the art judge: one tool call,
 * then defensive validation so a malformed response can never crash the mint.
 *
 * The model does what it is good at — language and a *mood* — returning a name,
 * a secondary, a tagline, voice verbs, and a palette SEED (mode + two hues).
 * The client's palette engine turns that seed into premium, contrast-checked
 * tokens; the risky color math is never left to the model. House rule: no
 * emoji, ever — typographic glyphs only.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';

import type { IdentityPalette, IdentityVoice } from '../db/schema.js';
import { env } from '../env.js';

export interface IdentitySpec {
  name: string;
  sub: string;
  tagline: string;
  mono: boolean;
  palette: IdentityPalette;
  voice: IdentityVoice;
}

export interface GenerateIdentityInput {
  /** Cuisine slug (the genesis clustering key). */
  cuisine: string;
  /** Human cuisine label ("Thai", "Levantine"). */
  cuisineLabel: string;
  /** The household's saved dish names in this cuisine — the raw material. */
  dishNames: string[];
}

const IDENTITY_TOOL: Tool = {
  name: 'name_the_kitchen',
  description: 'Record the bespoke identity for a household kitchen.',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          "The kitchen's display name — evocative, like a real place someone loves. Native script is welcome and encouraged where the cuisine has one (山城, ร้านริมคลอง, Trattoria…). Never the bare cuisine word, never emoji. 1-24 characters.",
      },
      sub: {
        type: 'string',
        description:
          'A short romanization or English secondary shown under the name (Mountain City, canal-side). 2-28 characters.',
      },
      tagline: {
        type: 'string',
        description:
          "One warm, specific line — the kitchen's promise or mood. 3-9 words, lowercase, no ending period.",
      },
      mono: {
        type: 'boolean',
        description:
          'true for a ledger/typewriter voice (canteens, delis, spec-sheet cultures); false for a warm sans (most kitchens).',
      },
      palette: {
        type: 'object',
        description: "The room's color seed — the client ramps premium tokens from this.",
        properties: {
          mode: {
            type: 'string',
            enum: ['light', 'dark'],
            description:
              'dark for night-market, lacquer, smoky, or intimate cuisines; light for bright, fresh, market ones.',
          },
          hue: {
            type: 'integer',
            minimum: 0,
            maximum: 359,
            description: "Base hue (0-359) for the room's paper and ink — the dominant tone.",
          },
          accentHue: {
            type: 'integer',
            minimum: 0,
            maximum: 359,
            description: 'The loud accent hue (0-359) — buttons, section rules, the add-state.',
          },
        },
        required: ['mode', 'hue', 'accentHue'],
        additionalProperties: false,
      },
      voice: {
        type: 'object',
        description:
          "Short verbs in the kitchen's tongue — its own language paired with a short English gloss. No emoji.",
        properties: {
          back: { type: 'string', description: 'Back control, e.g. "← 下山 · back". Max 20 characters.' },
          launch: {
            type: 'string',
            description: 'Build-the-cart verb, e.g. "开火 — fire the wok". Max 26 characters.',
          },
          add: { type: 'string', description: 'Add-to-plan, e.g. "加 — into the pot". Max 22 characters.' },
          remove: { type: 'string', description: 'Remove-from-plan, e.g. "撤 — out". Max 22 characters.' },
        },
        required: ['back', 'launch', 'add', 'remove'],
        additionalProperties: false,
      },
    },
    required: ['name', 'sub', 'tagline', 'mono', 'palette', 'voice'],
    additionalProperties: false,
  },
};

function prompt(input: GenerateIdentityInput): string {
  const dishes = input.dishNames.slice(0, 40).map((name) => `- ${name}`).join('\n');
  return [
    'You are the creative director for MC Peels, a premium grocery-concierge app.',
    `A household has saved enough ${input.cuisineLabel} recipes that their own ${input.cuisineLabel} kitchen is opening.`,
    'Give this kitchen a bespoke identity — as if designing a real, beloved neighborhood restaurant grown from exactly these dishes.',
    '',
    'Their saved dishes:',
    dishes || '- (a handful of home favorites)',
    '',
    'Design rules:',
    "- Evocative, premium, specific — never generic. The name should feel like a real place, drawn from this cuisine's culture, streets, or table. Native script is welcome where the cuisine has one.",
    '- NEVER use emoji or any emoji-like glyph. Typographic characters only.',
    "- The palette seed must suit the cuisine's real mood — a Chongqing night kitchen is dark and red; a Nordic table is light and cool.",
    "- Keep every string within its length guidance. Voice verbs pair the cuisine's language with a short English gloss.",
    '',
    'Record the identity with name_the_kitchen.',
  ].join('\n');
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}

const clampHue = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 30;
  return ((n % 360) + 360) % 360;
};

const clampStr = (value: unknown, max: number, fallback: string): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  return (s || fallback).slice(0, max);
};

/** Generate one kitchen identity. Defensive: always returns a valid spec. */
export async function generateIdentitySpec(input: GenerateIdentityInput): Promise<IdentitySpec> {
  const response = await getClient().messages.create({
    model: env().ANTHROPIC_MODEL,
    max_tokens: 1024,
    tools: [IDENTITY_TOOL],
    tool_choice: { type: 'tool', name: 'name_the_kitchen' },
    messages: [{ role: 'user', content: prompt(input) }],
  });

  const toolUse = response.content.find((block): block is ToolUseBlock => block.type === 'tool_use');
  const raw = (toolUse?.input ?? {}) as Record<string, unknown>;
  const palette = (raw.palette ?? {}) as Record<string, unknown>;
  const voice = (raw.voice ?? {}) as Record<string, unknown>;

  return {
    name: clampStr(raw.name, 24, input.cuisineLabel),
    sub: clampStr(raw.sub, 28, 'from your shelf'),
    tagline: clampStr(raw.tagline, 80, 'your saves, seated at a table'),
    mono: raw.mono === true,
    palette: {
      mode: palette.mode === 'dark' ? 'dark' : 'light',
      hue: clampHue(palette.hue),
      accentHue: clampHue(palette.accentHue),
    },
    voice: {
      back: clampStr(voice.back, 20, '← back'),
      launch: clampStr(voice.launch, 26, 'build the cart →'),
      add: clampStr(voice.add, 22, 'add to the plan'),
      remove: clampStr(voice.remove, 22, 'remove'),
    },
  };
}
