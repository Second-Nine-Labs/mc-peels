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

import type { GeneratedLook } from '../art/prompts.js';
import { isCoherentLook, lookRejection } from '../art/prompts.js';
import type { IdentityPalette, IdentityVoice } from '../db/schema.js';
import { env } from '../env.js';

export interface IdentitySpec {
  name: string;
  sub: string;
  tagline: string;
  mono: boolean;
  palette: IdentityPalette;
  voice: IdentityVoice;
  /**
   * The kitchen's authored rendering language, when the model produced a
   * coherent one. Optional on purpose: an incoherent look is dropped rather
   * than repaired, and the kitchen wears the house lock instead — the same
   * appearance it would have had before looks existed.
   */
  look?: GeneratedLook;
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
      look: {
        type: 'object',
        description:
          "How this kitchen's pictures are MADE. Commit to one way of making images and describe it as a real physical process, the way a printer or a photographer would. The two clauses are the same look at two distances — never two different looks.",
        properties: {
          medium: {
            type: 'string',
            enum: ['photograph', 'illustration'],
            description:
              'Photograph for most kitchens. Choose illustration only when this cuisine has a real graphic tradition worth wearing (poster art, printed menu cards, painted signage) — it should be the exception, not the default.',
          },
          style: {
            type: 'string',
            description:
              'The dish-tile clause, 40-320 characters. Name the process and its physical artifacts, and give real hex values. Good: "1960s Soviet propaganda-poster food illustration, flat ink printing, bold black keyline, faded red #C8332B on cream paper #F2E8D5, slight misregistration and aged-paper grain, heroic low angle". Describe the RENDERING only — never lettering, captions, logos, or words, which are forbidden elsewhere in the prompt and must not be reintroduced here.',
          },
          hero: {
            type: 'string',
            description:
              'The same look applied to a wide establishing view of the room, 40-320 characters. Same medium, same palette, same process artifacts — one artist stepping back from the plate. If style is an illustration, this must be too; a mismatch is rejected.',
          },
        },
        required: ['medium', 'style', 'hero'],
        additionalProperties: false,
      },
    },
    required: ['name', 'sub', 'tagline', 'mono', 'palette', 'voice', 'look'],
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
    '- The look is how the pictures are MADE, not what is in them. Commit to one process and name its artifacts, the way a printer or a photographer would — "two-ink risograph, visible registration slip, paper tooth" beats "beautiful art". Most kitchens are photographs; reach for illustration only when the cuisine has a real graphic tradition worth wearing.',
    '- Both look clauses are one artist at two distances. If the tiles are illustrated, the room is illustrated too.',
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

  const look = isCoherentLook(raw.look) ? raw.look : undefined;

  // A dropped look is a silent no-op at render time (the kitchen wears the house
  // lock), so log WHY — the same courtesy the legibility gate pays its
  // rejections. If looks fail often the feature is inert, and this line is how
  // we'd know. Two distinct failures worth telling apart: the model returned a
  // look that failed validation (raw snippet shows what it produced), or it
  // omitted the field entirely despite it being required (a weaker signal about
  // the model, not the prompt).
  if (look === undefined) {
    if (raw.look == null) {
      console.warn(`Kitchen look absent for ${input.cuisine}: model returned no look field`);
    } else {
      console.warn(
        `Kitchen look rejected for ${input.cuisine}: ${lookRejection(raw.look)} — raw: ${JSON.stringify(
          raw.look,
        ).slice(0, 400)}`,
      );
    }
  }

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
    // Not clamped, because a look cannot be repaired the way a string can:
    // truncating a clause could strip the very words that make it agree with
    // its medium, and a half-valid look is worse than none. Take it whole or
    // drop it and wear the house lock.
    ...(look ? { look } : {}),
  };
}
