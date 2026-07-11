# Soviet-mode art — drop zone

Delivered art is wired through `features/book/posters.ts`. Emblems keep their
cream tile plates (the "enamel pin" treatment); posters keep full art.

| File | Status | Used for |
| --- | --- | --- |
| `poster-worker.jpg` | ✅ delivered | Book empty state / hero |
| `emblem-gear.jpg` | ✅ delivered | Tab glyph, solver spinner (slot ready) |
| `loader-crane.jpg` | ✅ delivered | Loading states (slot ready) |
| `crest-bureau.jpg` | ✅ delivered | Bureau crest: stamps, headers (slot ready) |
| `medal-star.jpg` | ✅ delivered | Achievements only (slot ready) |
| `mark-worker.jpg` | ✅ delivered | Babushka-note byline avatar (slot ready) |
| `cta-fist.jpg` | ✅ delivered | "Поехали" action mark (slot ready) |
| `poster-cosmonaut.png` | ⏳ pending | Launch celebration, Cosmonautics Day (Apr 12) — retype CCCP→ПОЕХАЛИ first |
| `cutout-worker.png` | ✅ delivered | Paper-cutout figure — Столовая № 7 header + Book header (Vision subject-lift from the «НАШ ТРУД» poster, cream outline baked in, 256-color PNG) |

Production notes (agreed direction):

- Source PNGs can be dropped at any size; they get downscaled + converted here
  (sips). Vectorize later for crispness if these ever need to scale up.
- Ink tokens: cobalt `#3B66C9` / powder `#647EC7`, ochre `#D9A441`, gold
  `#E9C63F`, red `#C8332B`, ink `#211C17`, cream `#F2E8D5`.
- No hammer-and-sickle, no state insignia in product assets; crossed
  kitchen/workshop tools are the crest language. Never let the image model
  render Cyrillic — typeset it.
