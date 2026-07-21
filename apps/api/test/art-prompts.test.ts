import { describe, expect, it } from 'vitest';

import { parseGeminiImage } from '../src/art/gemini.js';
import {
  ALL_LOCKS,
  dishArtPrompt,
  heroArtPrompt,
  heroJudgeRubric,
  judgeRubric,
  styleLock,
} from '../src/art/prompts.js';
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

  it('breaks the fallback tie by palette mode, so a light kitchen is not dark', () => {
    expect(styleLock('oaxacan', 'light').key).toBe('light-premium-v1');
    expect(styleLock('oaxacan', 'dark').key).toBe('dark-premium-v1');
  });

  it('ignores the mode for a lock that has already committed to a look', () => {
    // A named lock IS the decision; the palette does not get to re-open it.
    expect(styleLock('stolovaya-7', 'light').key).toBe('soviet-poster-v1');
    expect(styleLock('stolovaya-7', 'dark').key).toBe('soviet-poster-v1');
  });
});

describe('medium coherence', () => {
  // TJ's one hard constraint: medium is consistent WITHIN a kitchen. This is
  // the guard — the previous bug was a hero clause that said "photography"
  // while its tiles were flat-ink illustration.
  const PHOTO_WORDS = /photograph|photography/i;
  const DRAWN_WORDS = /illustration|gouache|painted|drawn/i;

  it.each(ALL_LOCKS.map((lock) => [lock.key, lock] as const))(
    '%s renders its tiles and its hero in one medium',
    (_key, lock) => {
      if (lock.medium === 'illustration') {
        expect(lock.style).toMatch(DRAWN_WORDS);
        expect(lock.hero).toMatch(DRAWN_WORDS);
        expect(lock.hero).not.toMatch(PHOTO_WORDS);
      } else {
        expect(lock.style).toMatch(PHOTO_WORDS);
        expect(lock.hero).toMatch(PHOTO_WORDS);
        expect(lock.hero).not.toMatch(DRAWN_WORDS);
      }
    },
  );

  it('keeps illustration reachable but uncommon', () => {
    const drawn = ALL_LOCKS.filter((lock) => lock.medium === 'illustration');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(ALL_LOCKS.length / 2);
  });
});

describe('heroArtPrompt', () => {
  it('lets an illustrated kitchen have an illustrated hero', () => {
    const prompt = heroArtPrompt({
      cuisineLabel: 'Post Soviet',
      styleKey: 'stolovaya-7',
      mode: 'light',
    });
    // The scene noun used to be the literal word "photograph", unconditionally.
    expect(prompt).toContain('establishing illustration');
    expect(prompt).not.toContain('establishing photograph');
    expect(prompt).toContain('Soviet propaganda-poster illustration');
    expect(prompt).toContain('no emoji');
  });

  it('keeps photography for a photographic kitchen', () => {
    const prompt = heroArtPrompt({
      cuisineLabel: 'Sichuan Chongqing',
      styleKey: 'sichuan-chongqing',
      mode: 'dark',
    });
    expect(prompt).toContain('establishing photograph');
    expect(prompt).toContain('night-market');
  });

  it('follows the palette mode only when no lock is named', () => {
    const light = heroArtPrompt({ cuisineLabel: 'Thai', styleKey: 'thai', mode: 'light' });
    const dark = heroArtPrompt({ cuisineLabel: 'Thai', styleKey: 'thai', mode: 'dark' });
    expect(light).toContain('bright airy editorial interior photography');
    expect(dark).toContain('moody cinematic interior photography');
    // Both are still photography — the mode picks a tone, never a medium.
    expect(light).toContain('establishing photograph');
    expect(dark).toContain('establishing photograph');
  });

  it('weaves the mood in when the kitchen has a tagline', () => {
    const prompt = heroArtPrompt({
      cuisineLabel: 'Thai',
      styleKey: 'thai',
      mode: 'light',
      mood: 'night-market heat, riverside calm',
    });
    expect(prompt).toContain('night-market heat, riverside calm');
  });
});

describe('heroJudgeRubric', () => {
  it('names the medium and defends it in both directions', () => {
    const rubric = heroJudgeRubric('Post Soviet', styleLock('stolovaya-7'));
    expect(rubric).toContain('ILLUSTRATION');
    // The old rubric described a photographic brief unconditionally, so it
    // failed illustrated heroes as off-brief and rerolled them.
    expect(rubric).toContain('do not fail an illustration for being unphotographic');
    expect(rubric).toContain('lettering');
    expect(rubric).toContain('emoji');
  });

  it('grades a photographic kitchen as a photograph', () => {
    const rubric = heroJudgeRubric('Sichuan Chongqing', styleLock('sichuan-chongqing'));
    expect(rubric).toContain('PHOTOGRAPH');
    expect(rubric).toContain('night-market');
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
