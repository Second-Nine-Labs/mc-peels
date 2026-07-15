/**
 * The kitchen costume contract — everything that makes a restaurant *itself*,
 * separated from the chassis that makes it *work*.
 *
 * KitchenScreen (the chassis) renders four zones every kitchen shares:
 * hero → sticky identity bar → menu → pinned order bar. A costume supplies
 * the tokens, voice, and art that dress those zones. Adding kitchen №4 means
 * writing a costume + menu data — never another screen.
 */

import type { ReactNode } from 'react';

import type { Dish, Restaurant } from './types';

export interface CostumeTokens {
  /** The wall behind everything (the hero backdrop paints over it). */
  canvas: string;
  /** The menu ground the dish cards sit on. */
  paper: string;
  /** Dish-card surface. */
  card: string;
  ink: string;
  inkSoft: string;
  /** The kitchen's loud color — section rules, add-state, order bar action. */
  accent: string;
  onAccent: string;
  /** Text on the hero backdrop. */
  onHero: string;
  onHeroSoft: string;
  /** Sticky identity bar. */
  bar: string;
  onBar: string;
  /** Order bar ground (the action inside it uses accent). */
  order: string;
  onOrder: string;
}

export interface CostumeVoice {
  /** '← НАЗАД · back' — the back control in the kitchen's tongue. */
  back: string;
  /** One mono-ish line under the date/head: how to use the menu. */
  instruction?: string;
  /** Order-bar verb: 'ПОЕХАЛИ — build the cart'. */
  launch: string;
  /** Order-bar verb while building. */
  launching: string;
  /** Dish add / remove labels. */
  add: string;
  remove: string;
  /** Shown when a signed-out visitor tries to launch. */
  signedOut: string;
  /** The honesty footnote at the menu's end. */
  footnote: string;
}

export interface KitchenCostume {
  restaurant: Restaurant;
  tokens: CostumeTokens;
  voice: CostumeVoice;
  /** Mono ledger voice (Столовая) vs the default sans. */
  mono?: boolean;

  /** Zone 1 — the hero owns all art. Backdrop fills it; art anchors inside it. */
  renderHeroBackdrop: () => ReactNode;
  /** Figure/poster art anchored INSIDE the hero (never over the menu). */
  renderHeroArt?: () => ReactNode;
  /** Title block: eyebrow, display title, sub — the kitchen's letterhead. */
  renderHeroTitle: () => ReactNode;
  /** Optional badge row (stamp, crest) under the title. */
  renderHeroBadge?: () => ReactNode;
  /** Optional line above the first section (Столовая's typed date line). */
  headerLine?: () => string;

  /**
   * Optional bespoke storefront face for the home's THE KITCHENS list.
   * Without it, shelf-born kitchens get the generic tokens-based face.
   */
  renderStorefront?: () => ReactNode;

  /** Short mark for the sticky bar ('№ 7', 'greenhouse', 'LA MILPA'). */
  barMark: string;
  /** One-word course-chip labels keyed by section; defaults to section.label. */
  chipLabel?: (sectionKey: string, label: string) => string;

  /** The per-kitchen meta line on a dish card (macros / heat / GOST). */
  dishMeta?: (dish: Dish) => string | null;
}
