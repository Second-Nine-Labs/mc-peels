import { describe, expect, it } from 'vitest';

import { parseGeminiImage } from '../src/art/gemini.js';
import { dishArtPrompt, judgeRubric, styleLock } from '../src/art/prompts.js';
import { newestPerDish } from '../src/art/storage.js';

describe('styleLock', () => {
  it('gives every static-trio kitchen its own medium', () => {
    expect(styleLock('stolovaya-7').key).toBe('soviet-poster-v1');
    expect(styleLock('greenhouse').key).toBe('greenhouse-photo-v1');
    expect(styleLock('la-milpa').key).toBe('mercado-gouache-v1');
  });

  it('gives 山城 the night-market lock', () => {
    expect(styleLock('sichuan-chongqing').key).toBe('night-market-v1');
  });

  it('aliases cuisines to the kitchen in the same tradition', () => {
    expect(styleLock('mexican').key).toBe('mercado-gouache-v1');
    expect(styleLock('post-soviet').key).toBe('soviet-poster-v1');
  });

  it('falls back to the premium dark lock for unknown keys', () => {
    expect(styleLock('oaxacan').key).toBe('dark-premium-v1');
  });
});

describe('dishArtPrompt', () => {
  it('leads with the style lock so an illustrated kitchen is not forced to photo', () => {
    const prompt = dishArtPrompt({ title: 'Borscht', sub: 'борщ', styleKey: 'stolovaya-7' });
    expect(prompt).toContain('Borscht (борщ)');
    expect(prompt).toContain('Soviet propaganda-poster food illustration');
    expect(prompt).not.toContain('food photograph of');
    expect(prompt).toContain('no emoji');
  });

  it('carries subject, style, and house rules for a shelf dish', () => {
    const prompt = dishArtPrompt({
      title: 'Mapo tofu',
      sub: '麻婆豆腐',
      description: 'Silken tofu in the bubbling red',
      styleKey: 'sichuan-chongqing',
    });
    expect(prompt).toContain('Mapo tofu (麻婆豆腐)');
    expect(prompt).toContain('Silken tofu in the bubbling red');
    expect(prompt).toContain('night-market');
    expect(prompt).toContain('no text, no lettering');
  });

  it('handles dishes without sub or description', () => {
    const prompt = dishArtPrompt({ title: 'Birria', styleKey: 'mexican' });
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

describe('newestPerDish', () => {
  it('keeps the newest tile per dish, dishId hyphens intact', () => {
    const map = newestPerDish([
      'borscht-100.png',
      'borscht-200.png',
      'green-goddess-bowl-50.jpg',
      'not-an-art-file.txt',
    ]);
    expect(Object.keys(map).sort()).toEqual(['borscht', 'green-goddess-bowl']);
    expect(map.borscht).toBe('borscht-200.png');
    expect(map['green-goddess-bowl']).toBe('green-goddess-bowl-50.jpg');
  });

  it('ignores files that do not match the art naming', () => {
    expect(newestPerDish(['readme.md', 'hero.png', 'x-.png'])).toEqual({});
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
