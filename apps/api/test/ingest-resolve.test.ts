import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  extractJsonLdRecipes,
  extractPinterestOutboundLink,
  htmlToText,
  metaContent,
  normalizeSourceUrl,
  resolveSource,
} from '../src/ingest/resolve.js';

// A Response-shaped fake: resolve.ts only reads ok/status/url/text()/json().
function page(url: string, body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

function fakeFetch(routes: Record<string, Response | (() => Response)>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    for (const [prefix, response] of Object.entries(routes)) {
      if (url.startsWith(prefix)) return typeof response === 'function' ? response() : response;
    }
    throw new Error(`No route for ${url}`);
  }) as typeof fetch;
}

describe('normalizeSourceUrl', () => {
  it('strips tracking params and sorts the rest', () => {
    const url = normalizeSourceUrl(
      'https://example.com/recipe?z=1&utm_source=tiktok&fbclid=abc&a=2&igsh=xyz',
    );
    expect(url).toBe('https://example.com/recipe?a=2&z=1');
  });

  it('strips hashes and lowercases the host', () => {
    expect(normalizeSourceUrl('https://Example.COM/Path#section')).toBe('https://example.com/Path');
  });

  it('forgives a missing scheme', () => {
    expect(normalizeSourceUrl('www.tiktok.com/@x/video/1')).toBe('https://www.tiktok.com/@x/video/1');
  });

  it('rejects non-http protocols and garbage', () => {
    expect(() => normalizeSourceUrl('ftp://example.com/x')).toThrow();
    expect(() => normalizeSourceUrl('   ')).toThrow();
  });
});

describe('detectPlatform', () => {
  it.each([
    ['https://www.tiktok.com/@x/video/1', 'tiktok'],
    ['https://vm.tiktok.com/ZM1234/', 'tiktok'],
    ['https://www.instagram.com/reel/abc/', 'instagram'],
    ['https://pin.it/abc123', 'pinterest'],
    ['https://www.pinterest.com/pin/12345/', 'pinterest'],
    ['https://pinterest.co.uk/pin/12345/', 'pinterest'],
    ['https://uk.pinterest.com/pin/12345/', 'pinterest'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://smittenkitchen.com/2024/01/best-hoagie/', 'web'],
  ])('%s -> %s', (url, platform) => {
    expect(detectPlatform(url)).toBe(platform);
  });
});

describe('extractJsonLdRecipes', () => {
  it('finds a plain Recipe node', () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Recipe","name":"Laziji",
       "recipeIngredient":["1.5 lb chicken thighs","dried chiles"],
       "recipeInstructions":"Fry everything.","recipeYield":"4 servings",
       "recipeCuisine":"Sichuan"}
    </script></head></html>`;
    const [recipe] = extractJsonLdRecipes(html);
    expect(recipe?.name).toBe('Laziji');
    expect(recipe?.ingredients).toEqual(['1.5 lb chicken thighs', 'dried chiles']);
    expect(recipe?.instructions).toEqual(['Fry everything.']);
    expect(recipe?.yield).toBe('4 servings');
    expect(recipe?.cuisine).toBe('Sichuan');
  });

  it('finds Recipe inside @graph and type arrays', () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebPage","name":"blog"},
                 {"@type":["Recipe","Thing"],"name":"Butter chicken",
                  "recipeIngredient":["chicken"],"recipeInstructions":[]}]}
    </script>`;
    const recipes = extractJsonLdRecipes(html);
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.name).toBe('Butter chicken');
  });

  it('flattens HowToSection / HowToStep instruction trees', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Recipe","name":"Hoagie","recipeIngredient":["bread"],
       "recipeInstructions":[
         {"@type":"HowToSection","itemListElement":[
           {"@type":"HowToStep","text":"Split the bread."},
           {"@type":"HowToStep","text":"Layer the meats."}]},
         {"@type":"HowToStep","text":"Dress with oil and vinegar."}]}
    </script>`;
    const [recipe] = extractJsonLdRecipes(html);
    expect(recipe?.instructions).toEqual([
      'Split the bread.',
      'Layer the meats.',
      'Dress with oil and vinegar.',
    ]);
  });

  it('skips malformed JSON blocks without failing', () => {
    const html = `<script type="application/ld+json">{not json}</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Ok","recipeIngredient":["x"]}</script>`;
    expect(extractJsonLdRecipes(html)).toHaveLength(1);
  });

  it('reads author objects and arrays', () => {
    const html = `<script type="application/ld+json">
      {"@type":"Recipe","name":"X","recipeIngredient":["y"],
       "author":{"@type":"Person","name":"Deb"}}
    </script>`;
    expect(extractJsonLdRecipes(html)[0]?.author).toBe('Deb');
  });
});

describe('metaContent', () => {
  it('reads og tags in either attribute order', () => {
    const a = `<meta property="og:title" content="Big Peel &amp; Fries" />`;
    const b = `<meta content="Big Peel" property="og:title" />`;
    expect(metaContent(a, 'og:title')).toBe('Big Peel & Fries');
    expect(metaContent(b, 'og:title')).toBe('Big Peel');
    expect(metaContent(a, 'og:description')).toBeNull();
  });
});

describe('htmlToText', () => {
  it('drops scripts and styles, keeps readable lines', () => {
    const html = `<html><script>var x=1;</script><style>.a{}</style>
      <h1>Italian hoagie</h1><p>Layer   the meats.</p><li>Genoa salami</li></html>`;
    const text = htmlToText(html);
    expect(text).toContain('Italian hoagie');
    expect(text).toContain('Layer the meats.');
    expect(text).toContain('Genoa salami');
    expect(text).not.toContain('var x=1');
  });

  it('caps output length', () => {
    expect(htmlToText(`<p>${'a'.repeat(10_000)}</p>`, 100)).toHaveLength(100);
  });
});

describe('extractPinterestOutboundLink', () => {
  it('unescapes and returns the first non-Pinterest link', () => {
    const html = `{"link":"https:\\/\\/www.pinterest.com\\/internal"},{"link":"https:\\/\\/smittenkitchen.com\\/recipe?x=1\\u0026y=2"}`;
    expect(extractPinterestOutboundLink(html)).toBe('https://smittenkitchen.com/recipe?x=1&y=2');
  });

  it('returns null when only Pinterest links exist', () => {
    const html = `{"link":"https:\\/\\/i.pinimg.com\\/img.jpg"}`;
    expect(extractPinterestOutboundLink(html)).toBeNull();
  });
});

describe('resolveSource', () => {
  it('reads a TikTok caption via oEmbed', async () => {
    const fetchImpl = fakeFetch({
      'https://www.tiktok.com/oembed': page(
        'https://www.tiktok.com/oembed',
        JSON.stringify({ title: 'CHONGQING NOODLES: 2 tbsp chili oil, noodles...', author_name: 'mala.queen' }),
      ),
    });
    const material = await resolveSource('https://www.tiktok.com/@mala.queen/video/9?_t=trackme', {
      fetchImpl,
    });
    expect(material.platform).toBe('tiktok');
    expect(material.caption).toContain('CHONGQING NOODLES');
    expect(material.creator).toBe('mala.queen');
    expect(material.url).toBe('https://www.tiktok.com/@mala.queen/video/9');
  });

  it('notes it when TikTok refuses the caption', async () => {
    const fetchImpl = fakeFetch({
      'https://www.tiktok.com/oembed': page('https://www.tiktok.com/oembed', 'nope', 403),
    });
    const material = await resolveSource('https://www.tiktok.com/@x/video/1', { fetchImpl });
    expect(material.caption).toBeNull();
    expect(material.notes.join(' ')).toContain('rebuilt');
  });

  it('unfurls a short link before resolving', async () => {
    const fetchImpl = fakeFetch({
      'https://vm.tiktok.com/ZM99': page('https://www.tiktok.com/@x/video/42', '<html></html>'),
      'https://www.tiktok.com/oembed': page(
        'https://www.tiktok.com/oembed',
        JSON.stringify({ title: 'recipe here', author_name: 'x' }),
      ),
    });
    const material = await resolveSource('https://vm.tiktok.com/ZM99', { fetchImpl });
    expect(material.url).toBe('https://www.tiktok.com/@x/video/42');
    expect(material.platform).toBe('tiktok');
  });

  it('hops from a pin to the blog and takes its JSON-LD', async () => {
    const pinHtml = `<meta property="og:title" content="Best butter chicken" />
      {"link":"https:\\/\\/blog.example\\/butter-chicken"}`;
    const blogHtml = `<script type="application/ld+json">
      {"@type":"Recipe","name":"Butter chicken","recipeIngredient":["chicken thighs","garam masala"],
       "recipeInstructions":"Simmer."}</script>`;
    const fetchImpl = fakeFetch({
      'https://www.pinterest.com/pin/1': page('https://www.pinterest.com/pin/1', pinHtml),
      'https://blog.example/butter-chicken': page('https://blog.example/butter-chicken', blogHtml),
    });
    const material = await resolveSource('https://www.pinterest.com/pin/1', { fetchImpl });
    expect(material.structuredRecipe?.name).toBe('Butter chicken');
    expect(material.resolvedFrom).toBe('https://blog.example/butter-chicken');
    expect(material.title).toBe('Best butter chicken');
  });

  it('falls back to page text on a blog without JSON-LD', async () => {
    const html = `<meta property="og:title" content="Nonna's ragu" /><p>Brown the beef slowly.</p>`;
    const fetchImpl = fakeFetch({
      'https://blog.example/ragu': page('https://blog.example/ragu', html),
    });
    const material = await resolveSource('https://blog.example/ragu', { fetchImpl });
    expect(material.structuredRecipe).toBeNull();
    expect(material.bodyText).toContain('Brown the beef slowly.');
    expect(material.title).toBe("Nonna's ragu");
  });

  it('survives a dead page with an honest note', async () => {
    const fetchImpl = fakeFetch({
      'https://blog.example/gone': page('https://blog.example/gone', 'nope', 404),
    });
    const material = await resolveSource('https://blog.example/gone', { fetchImpl });
    expect(material.structuredRecipe).toBeNull();
    expect(material.bodyText).toBeNull();
    expect(material.notes.join(' ')).toContain('404');
  });

  it('survives a fetch that throws', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const material = await resolveSource('https://blog.example/x', { fetchImpl });
    expect(material.notes.join(' ')).toContain('would not load');
  });
});
