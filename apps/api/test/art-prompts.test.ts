import { describe, expect, it } from 'vitest';

import { parseGeminiImage } from '../src/art/gemini.js';
import { dishArtPrompt, judgeRubric, styleLockForCuisine } from '../src/art/prompts.js';

describe('styleLockForCuisine', () => {
  it('gives sichuan-chongqing the night-market lock', () => {
    expect(styleLockForCuisine('sichuan-chongqing').key).toBe('night-market-v1');
  });

  it('falls back to the premium dark lock for unknown cuisines', () => {
    expect(styleLockForCuisine('oaxacan').key).toBe('dark-premium-v1');
  });
});

describe('dishArtPrompt', () => {
  const dish = {
    title: 'Mapo tofu',
    sub: '麻婆豆腐',
    description: 'Silken tofu in the bubbling red',
    cuisine: 'sichuan-chongqing',
  };

  it('carries the subject, the style lock, and the house rules', () => {
    const prompt = dishArtPrompt(dish);
    expect(prompt).toContain('Mapo tofu (麻婆豆腐)');
    expect(prompt).toContain('Silken tofu in the bubbling red');
    expect(prompt).toContain('night-market');
    expect(prompt).toContain('no text, no lettering');
    expect(prompt).toContain('no emoji');
  });

  it('handles dishes without sub or description', () => {
    const prompt = dishArtPrompt({ title: 'Birria', cuisine: 'mexican' });
    expect(prompt).toContain('Birria');
    expect(prompt).not.toContain('()');
    expect(prompt).not.toContain('— ,');
  });
});

describe('judgeRubric', () => {
  it('names the dish and the failure checks', () => {
    const rubric = judgeRubric({ title: 'Dan dan noodles' }, 'dark photography');
    expect(rubric).toContain('Dan dan noodles');
    expect(rubric).toContain('emoji');
    expect(rubric).toContain('lettering');
    expect(rubric).toContain('dark photography');
  });
});

describe('parseGeminiImage', () => {
  const pixel = Buffer.from('89504e47', 'hex').toString('base64');

  it('reads camelCase inlineData', () => {
    const image = parseGeminiImage({
      candidates: [
        { content: { parts: [{ text: 'here you go' }, { inlineData: { mimeType: 'image/png', data: pixel } }] } },
      ],
    });
    expect(image?.mimeType).toBe('image/png');
    expect(image?.bytes.length).toBe(4);
  });

  it('reads snake_case inline_data', () => {
    const image = parseGeminiImage({
      candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/jpeg', data: pixel } }] } }],
    });
    expect(image?.mimeType).toBe('image/jpeg');
  });

  it('returns null when the response has no image', () => {
    expect(parseGeminiImage({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] })).toBeNull();
    expect(parseGeminiImage({})).toBeNull();
    expect(parseGeminiImage(undefined)).toBeNull();
  });
});
