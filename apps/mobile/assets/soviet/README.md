# Soviet-mode art — drop zone

Export the Nano Banana pieces here with these exact names, then flip the
corresponding `require`s on in `features/book/posters.ts`:

| File | Source art | Used for |
| --- | --- | --- |
| `poster-worker.png` | Welder banana, "НАШ ТРУД" poster | Book empty state / hero |
| `poster-cosmonaut.png` | 1961 rocket banana | Launch celebration, Cosmonautics Day (Apr 12) |
| `emblem-gear.png` | Gear + banana bunch (the cleaner-toothed one) | Tab glyph, solver spinner |
| `loader-crane.png` | Crane lifting bananas | Loading states |
| `crest-bureau.png` | Fist + crossed hammer/wrench (wrench-forward one) | Bureau crest: stamps, headers |
| `medal-star.png` | Faceted star + orbiting bananas | Achievements only |

Production notes (agreed direction):

- Vectorize before shipping (Illustrator trace or `potrace` per color layer);
  flat 3-color art traces nearly losslessly. Keep the PNGs here as source.
- Normalize inks to tokens: cobalt `#3B66C9`, ochre `#D9A441`, gold `#E9C63F`,
  red `#C8332B`, ink `#211C17`, cream `#F2E8D5`. Transparent backgrounds —
  cream comes from the surface, not the file.
- No hammer-and-sickle, no state insignia; crossed kitchen/workshop tools are
  the crest language. Never let the image model render Cyrillic — typeset it.
- Cosmonaut poster: replace the CCCP lettering with ПОЕХАЛИ (typeset), keep
  1961 small.
