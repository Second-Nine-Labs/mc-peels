/**
 * The art judge — a vision pass that grades every generated tile before it
 * is cached. Strict rubric: wrong dish, any lettering, any emoji, or
 * generation artifacts fail; a fail costs one reroll, a false pass costs
 * brand quality. Uses the same forced-tool pattern as the recipe extractor.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';

import { env } from '../env.js';
import type { GeneratedImage } from './gemini.js';
import { judgeRubric } from './prompts.js';

export interface ArtVerdict {
  pass: boolean;
  reasons: string[];
}

const VERDICT_TOOL: Tool = {
  name: 'grade_dish_art',
  description: 'Record the verdict for a generated dish image.',
  input_schema: {
    type: 'object',
    properties: {
      pass: { type: 'boolean', description: 'True only when every check passes.' },
      reasons: {
        type: 'array',
        items: { type: 'string' },
        description: 'One entry per failed check; empty when passing.',
      },
    },
    required: ['pass', 'reasons'],
    additionalProperties: false,
  },
};

const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  }
  return client;
}

export async function judgeDishArt(
  image: GeneratedImage,
  dish: { title: string; description?: string | null },
  style: string,
): Promise<ArtVerdict> {
  const mediaType = IMAGE_MEDIA_TYPES.find((m) => m === image.mimeType) ?? 'image/png';

  const response = await getClient().messages.create({
    model: env().ANTHROPIC_MODEL,
    max_tokens: 1024,
    tools: [VERDICT_TOOL],
    tool_choice: { type: 'tool', name: 'grade_dish_art' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: image.bytes.toString('base64') },
          },
          { type: 'text', text: judgeRubric(dish, style) },
        ],
      },
    ],
  });

  const toolUse = response.content.find((block): block is ToolUseBlock => block.type === 'tool_use');
  if (!toolUse) return { pass: false, reasons: ['judge returned no verdict'] };

  const input = toolUse.input as { pass?: boolean; reasons?: string[] };
  return { pass: input.pass === true, reasons: Array.isArray(input.reasons) ? input.reasons : [] };
}
