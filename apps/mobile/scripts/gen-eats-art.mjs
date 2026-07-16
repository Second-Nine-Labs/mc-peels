#!/usr/bin/env node
/**
 * Eats art — generate, drop, or just re-scan. One tool, three uses:
 *
 *   npm run gen:eats-art                          rescan assets/eats/, rebuild the manifest (unchanged default)
 *   npm run gen:eats-art -- --generate             fill every MISSING hero/dish across the static kitchens
 *   npm run gen:eats-art -- --generate --dry-run   preview the task list + cost, no API calls
 *   npm run gen:eats-art -- --regen=stolovaya-7/borscht   force-regenerate one image (kitchen/dish or kitchen/hero)
 *   npm run gen:eats-art -- --generate --only=greenhouse  scope to one kitchen
 *
 * Generation reads features/eats/art-prompts.json (the single source of
 * truth for style locks + per-dish subjects — keep the "Art Drop" artifact's
 * copy in sync with it by hand for now). Every generated image is cover-fit
 * to its exact spec'd size locally (never trusts the API's aspect-ratio
 * param) and compressed per the kitchen's `compress` mode before landing in
 * assets/eats/ — from there it's a normal committed asset, same as anything
 * hand-dropped.
 *
 * Scope: the static trio only (stolovaya-7, greenhouse, la-milpa). Shelf-
 * minted kitchens (山城 and friends) have a dynamic dish list — the household
 * decides what's on the menu by what it saves — so their art is generated
 * at ingest time and cached, not pre-baked here. See features/eats/genesis.ts.
 *
 * GEMINI_API_KEY: read from the environment, or from a `GEMINI_API_KEY=`
 * line in apps/mobile/.env if present. Deliberately NOT prefixed
 * EXPO_PUBLIC_ — that prefix means "inline this into the shipped bundle",
 * and a paid API key must never leave this machine.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COST_PER_IMAGE_USD, GeminiImageError, generateImage } from './lib/gemini-image.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artRoot = join(root, 'assets', 'eats');
const manifestFile = join(root, 'features', 'eats', 'art-manifest.ts');
const promptsFile = join(root, 'features', 'eats', 'art-prompts.json');
const processScript = join(root, 'scripts', 'lib', 'process-art.py');

const IMG = /\.(png|jpg|jpeg|webp)$/i;
const DISH_SIZE = 1024; // square, matches Gemini's native ~1K output — no upscale needed
const HERO_SIZE = { w: 1200, h: 1500 }; // 4:5, sized to avoid visibly upscaling a 1K source

// ---------------------------------------------------------------------------
// CLI

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const doGenerate = flag('generate');
const dryRun = flag('dry-run');
const only = opt('only');
const regenTarget = opt('regen'); // "kitchen/dish" or "kitchen/hero"

// ---------------------------------------------------------------------------
// Manifest (unchanged behavior — always runs last)

function writeManifest() {
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
    ' * (or `npm run gen:eats-art -- --generate` to generate the missing ones) and this',
    ' * manifest picks them up. Missing art is fine — screens fall back to designed',
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

  writeFileSync(manifestFile, lines.join('\n'));
  console.log(
    `eats art manifest: ${heroes.length} hero(es), ${dishes.length} dish tile(s) → features/eats/art-manifest.ts`,
  );
}

if (!doGenerate && !regenTarget) {
  writeManifest();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Generation

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = join(root, '.env');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

function loadPrompts() {
  return JSON.parse(readFileSync(promptsFile, 'utf8'));
}

function isDynamicDishSpec(dishes) {
  const keys = Object.keys(dishes ?? {});
  return keys.length === 1 && keys[0] === '_note';
}

/** Every generatable task for the static trio: hero + each real dish entry. */
function buildTaskList(prompts) {
  const tasks = [];
  for (const [kitchen, spec] of Object.entries(prompts)) {
    if (spec.hero) tasks.push({ kitchen, kind: 'hero', id: 'hero', spec });
    if (!spec.dishes || isDynamicDishSpec(spec.dishes)) continue; // shelf-* kitchens: hero only here
    for (const dishId of Object.keys(spec.dishes)) {
      tasks.push({ kitchen, kind: 'dish', id: dishId, spec });
    }
  }
  return tasks;
}

function targetPath(task) {
  return task.kind === 'hero'
    ? join(artRoot, task.kitchen, 'hero.png')
    : join(artRoot, task.kitchen, 'dishes', `${task.id}.png`);
}

function buildPrompt(task) {
  const subject =
    task.kind === 'hero' ? task.spec.hero.subject : task.spec.dishes[task.id].subject;
  const ratio = task.kind === 'hero' ? 'vertical portrait composition, 4:5 ratio' : 'square 1:1';
  return `${subject}, ${task.spec.styleLock}, ${ratio}`;
}

async function runTask(task, apiKey, model) {
  const dest = targetPath(task);
  mkdirSync(dirname(dest), { recursive: true });

  const prompt = buildPrompt(task);
  const { bytes, mimeType } = await generateImage(prompt, { apiKey, model });

  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const rawTmp = join(root, '.art-tmp', `${task.kitchen}-${task.id}.${ext}`);
  mkdirSync(dirname(rawTmp), { recursive: true });
  writeFileSync(rawTmp, bytes);

  const { w, h } = task.kind === 'hero' ? HERO_SIZE : { w: DISH_SIZE, h: DISH_SIZE };
  execFileSync('python3', [processScript, rawTmp, dest, String(w), String(h), task.spec.compress]);
}

async function main() {
  const prompts = loadPrompts();
  let tasks = buildTaskList(prompts);

  if (regenTarget) {
    const [kitchen, id] = regenTarget.split('/');
    tasks = tasks.filter((t) => t.kitchen === kitchen && t.id === id);
    if (tasks.length === 0) {
      console.error(`No such task "${regenTarget}". Expected "<kitchen>/<dish-id>" or "<kitchen>/hero".`);
      process.exit(1);
    }
  } else {
    if (only) tasks = tasks.filter((t) => t.kitchen === only);
    // --generate alone: only what's missing. --regen already means "force".
    tasks = tasks.filter((t) => !existsSync(targetPath(t)));
  }

  if (tasks.length === 0) {
    console.log('Nothing to generate — every task already has art. (Use --regen=<kitchen>/<id> to force one.)');
    writeManifest();
    return;
  }

  const cost = (tasks.length * COST_PER_IMAGE_USD).toFixed(2);
  console.log(`${tasks.length} image(s) to generate (~$${cost} at $${COST_PER_IMAGE_USD}/image):`);
  for (const t of tasks) console.log(`  ${t.kitchen}/${t.kind === 'hero' ? 'hero' : `dishes/${t.id}`}`);

  if (dryRun) {
    console.log('\n--dry-run: no API calls made.');
    return;
  }

  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error(
      '\nNo GEMINI_API_KEY found. Set it in the environment, or add a line\n' +
        '`GEMINI_API_KEY=...` to apps/mobile/.env (plain, no EXPO_PUBLIC_ prefix —\n' +
        'that prefix ships it into the app bundle, which a paid key must never do).',
    );
    process.exit(1);
  }
  const model = process.env.GEMINI_IMAGE_MODEL || undefined;

  console.log('');
  let failed = 0;
  for (const [index, task] of tasks.entries()) {
    const label = `${task.kitchen}/${task.kind === 'hero' ? 'hero' : task.id}`;
    process.stdout.write(`[${index + 1}/${tasks.length}] ${label} … `);
    try {
      await runTask(task, apiKey, model);
      console.log('done');
    } catch (err) {
      console.log('FAILED');
      console.error(err instanceof GeminiImageError ? err.message : err);
      failed += 1;
      // Fail fast on the very first call — a bad key or wrong model id will
      // error identically on every subsequent task, so don't burn the batch.
      if (index === 0) {
        console.error('\nFirst image failed — stopping here rather than repeating the same error 40 times.');
        process.exit(1);
      }
    }
    // Be polite to the API between calls.
    if (index < tasks.length - 1) await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n${tasks.length - failed} succeeded, ${failed} failed.`);
  writeManifest();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
