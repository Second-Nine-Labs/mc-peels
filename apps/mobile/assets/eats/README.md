# Eats art — drop zone

Generated illustrations for the kitchens land here. Until a dish has art it
wears a designed fallback tile in its kitchen's theme, so nothing ever
looks broken.

**Preferred path — generate straight from Gemini, no manual drop:**

```
npm run gen:eats-art -- --generate --dry-run   # preview the task list + cost
npm run gen:eats-art -- --generate             # fill everything missing
npm run gen:eats-art -- --regen=stolovaya-7/borscht   # force one image
npm run gen:eats-art -- --generate --only=greenhouse  # scope to one kitchen
```

Needs `GEMINI_API_KEY` — either exported in the shell, or a plain
`GEMINI_API_KEY=...` line in `apps/mobile/.env` (never `EXPO_PUBLIC_`-prefixed;
that would ship a paid key into the app bundle). ~$0.039/image
(gemini-2.5-flash-image); the full static-trio catalog is ~36 images, ~$1.40.
Prompts + style locks live in `features/eats/art-prompts.json` — that file is
the source of truth; keep the "Art Drop" artifact's copy in sync by hand.

**Manual path still works** — drop a file at the paths below and run
`npm run gen:eats-art` (no flags) to just rebuild the manifest.

## Layout

```
assets/eats/
  stolovaya-7/
    hero.png              ← kitchen hero, 4:5 (1600×2000)
    dishes/
      borscht.png         ← dish tile, 1:1 (800×800), named by dish id
      okroshka.png
  greenhouse/
    hero.png
    dishes/<dish-id>.png
  la-milpa/
    hero.png
    dishes/<dish-id>.png
```

Dish ids live in `features/eats/data/*.ts`. PNG/JPG/WebP all work.

## Generation prompts

Swap `[DISH]` for the dish (e.g. “a steaming bowl of borscht with a spoon of
smetana”). Square 1:1 for dish tiles; the same prompt at 4:5 for heroes.
The full per-dish board with copy-ready prompts lives in the "Art Drop"
artifact (claude.ai/code/artifacts). House rules: **no lettering in the
image** (type is set in the app — never Cyrillic/hanzi in art) and **no
emoji, ever**.

**Столовая № 7 — soviet poster plates**
> 1960s Soviet propaganda-poster food illustration of [DISH], flat ink
> printing style, bold black keyline, limited palette of faded red #C8332B,
> cream paper #F2E8D5, ochre and olive, slight misregistration and aged-paper
> grain, heroic composition from a low angle, no text, no lettering, square 1:1

**greenhouse — bright overhead photography** (the photographic kitchen)
> Bright overhead food photography of [DISH] on warm white marble, soft
> diffused morning window light, sage-green linen napkin at the edge of
> frame, shallow depth of field, generous airy negative space, fresh and
> appetizing, no text, no emoji, square 1:1

**La Milpa — mercado gouache**
> Vibrant Mexican mercado-poster gouache illustration of [DISH], flat
> saturated shapes in marigold #F2A007, rosa mexicano #E84B8A, teal #159F94
> and deep plum #241430, papel-picado energy, thick paint texture, festive
> but composed, no text, square 1:1

**山城 (`shelf-sichuan-chongqing`) — dark night-market photography**
> Dramatic dark food photography of [DISH], deep plum-black night-market
> backdrop, red lantern glow from above, visible steam, glistening chili-oil
> sheen, hard cinematic rim light, rich and moody, no text, no emoji,
> square 1:1

Shelf-minted kitchens key dish art by **save id**
(`shelf-<cuisine>/dishes/<save-id>.png`); heroes work today at
`shelf-<cuisine>/hero.png`. Slug-based filenames are a small follow-up
when wanted.
