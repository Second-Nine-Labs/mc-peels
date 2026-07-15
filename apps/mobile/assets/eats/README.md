# Eats art — drop zone

Generated illustrations for the kitchens land here. Drop a file, run
`npm run gen:eats-art` (from `apps/mobile/`), and the screens pick it up —
no code changes. Until a dish has art it wears a designed fallback tile in
its kitchen's theme, so nothing ever looks broken.

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

**Столовая № 7 — soviet poster plates**
> 1960s Soviet propaganda-poster food illustration of [DISH], flat ink
> printing style, bold black keyline, limited palette of faded red #C8332B,
> cream paper #F2E8D5, ochre and olive, slight misregistration and aged-paper
> grain, heroic composition from a low angle, no text, no lettering, square 1:1

**greenhouse — botanical plate studies**
> Soft botanical watercolor-and-ink study of [DISH], airy white paper
> background, sage green #4E5D43 and warm honey accents, loose pencil
> linework, generous negative space, morning-light feel, seed-catalog
> aesthetic, no text, square 1:1

**La Milpa — mercado gouache**
> Vibrant Mexican mercado-poster gouache illustration of [DISH], flat
> saturated shapes in marigold #F2A007, rosa mexicano #E84B8A, teal #159F94
> and deep plum #241430, papel-picado energy, thick paint texture, festive
> but composed, no text, square 1:1
