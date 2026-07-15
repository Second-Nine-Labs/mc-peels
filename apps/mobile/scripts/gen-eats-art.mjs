#!/usr/bin/env node
/**
 * Regenerates features/eats/art-manifest.ts from whatever art exists under
 * assets/eats/. Metro needs static require() calls, so "drop a file in" is
 * one `npm run gen:eats-art` away from live — no hand-written manifest edits.
 *
 * Layout it scans (see assets/eats/README.md for generation specs):
 *   assets/eats/<kitchen-id>/hero.png            → KITCHEN_HEROES[kitchen]
 *   assets/eats/<kitchen-id>/dishes/<dish-id>.png → DISH_ART["kitchen/dish"]
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artRoot = join(root, 'assets', 'eats');
const outFile = join(root, 'features', 'eats', 'art-manifest.ts');

const IMG = /\.(png|jpg|jpeg|webp)$/i;

const heroes = [];
const dishes = [];

if (existsSync(artRoot)) {
  for (const kitchen of readdirSync(artRoot).sort()) {
    const kitchenDir = join(artRoot, kitchen);
    if (!statSync(kitchenDir).isDirectory()) continue;

    for (const entry of readdirSync(kitchenDir).sort()) {
      if (IMG.test(entry) && entry.replace(IMG, '') === 'hero') {
        heroes.push({ kitchen, file: `${kitchen}/${entry}` });
      }
    }

    const dishDir = join(kitchenDir, 'dishes');
    if (existsSync(dishDir) && statSync(dishDir).isDirectory()) {
      for (const entry of readdirSync(dishDir).sort()) {
        if (!IMG.test(entry)) continue;
        const dishId = entry.replace(IMG, '');
        dishes.push({ key: `${kitchen}/${dishId}`, file: `${kitchen}/dishes/${entry}` });
      }
    }
  }
}

const lines = [
  '/**',
  ' * GENERATED FILE — do not edit by hand.',
  ' *',
  ' * Run `npm run gen:eats-art` after dropping images into',
  ' * `assets/eats/<kitchen>/hero.png` or `assets/eats/<kitchen>/dishes/<dish-id>.png`',
  ' * and this manifest picks them up (Metro needs static require calls, so the',
  ' * script writes them). Missing art is fine — screens fall back to designed',
  ' * tiles in the kitchen’s own theme. See assets/eats/README.md for the specs.',
  ' */',
  '',
  "import type { ImageSourcePropType } from 'react-native';",
  '',
  'export const KITCHEN_HEROES: Record<string, ImageSourcePropType> = {',
  ...heroes.map(({ kitchen, file }) => `  '${kitchen}': require('../../assets/eats/${file}'),`),
  '};',
  '',
  'export const DISH_ART: Record<string, ImageSourcePropType> = {',
  ...dishes.map(({ key, file }) => `  '${key}': require('../../assets/eats/${file}'),`),
  '};',
  '',
];

writeFileSync(outFile, lines.join('\n'));
console.log(
  `eats art manifest: ${heroes.length} hero(es), ${dishes.length} dish tile(s) → features/eats/art-manifest.ts`,
);
