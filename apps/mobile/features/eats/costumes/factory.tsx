/**
 * The costume factory — dresses kitchens the Shelf mints at runtime.
 *
 * Flagship cuisines get a fully bespoke costume (山城 for sichuan-chongqing);
 * everything else wears the house "shelf kitchen" look — warm paper, banana-
 * gold accent, an awning band so it still reads as a place, not a list. Add
 * a curated look by dropping a builder into FLAGSHIPS.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { KitchenCostume } from '../costume';
import type { GeneratedIdentity } from '../identity';
import type { Restaurant } from '../types';
import { generatedCostume } from './generated';
import { laMilpaCostume } from './lamilpa';
import { shanchengCostume } from './shancheng';
import { stolovayaCostume } from './stolovaya';

type CostumeBuilder = (restaurant: Restaurant) => KitchenCostume;

// Curated skins for cuisines with a strong visual tradition. Everything else
// wears the house look. (greenhouseCostume exists as foundation but has no
// natural cuisine key yet, so it isn't wired here.)
const FLAGSHIPS: Record<string, CostumeBuilder> = {
  'sichuan-chongqing': shanchengCostume,
  'post-soviet': stolovayaCostume,
  mexican: laMilpaCostume,
};

/** The thematic identity a flagship cuisine's kitchen takes on — its name,
 * secondary, and tagline, so a minted kitchen reads as a *place* (山城,
 * Столовая, La Milpa) rather than a bare cuisine label. Genesis applies it. */
export interface FlagshipIdentity {
  name: string;
  sub: string;
  tagline: string;
}

const FLAGSHIP_IDENTITY: Record<string, FlagshipIdentity> = {
  'sichuan-chongqing': {
    name: '山城',
    sub: 'Mountain City',
    tagline: 'chongqing night kitchen — 麻辣, always',
  },
  'post-soviet': {
    name: 'Столовая',
    sub: 'the canteen',
    tagline: 'the menu is a decree, dinner is a plan',
  },
  mexican: {
    name: 'La Milpa',
    sub: 'cocina de mercado',
    tagline: 'your saves, seated at the mercado',
  },
};

export function flagshipIdentity(cuisine: string): FlagshipIdentity | null {
  return FLAGSHIP_IDENTITY[cuisine] ?? null;
}

/**
 * Dress a shelf-minted kitchen. Precedence: a hand-built flagship costume
 * wins; then the kitchen's generated identity (bespoke palette + voice + hero);
 * then the house look — which is also what a kitchen wears in the beat before
 * its identity has generated.
 */
export function costumeForShelfKitchen(
  cuisine: string,
  restaurant: Restaurant,
  identity?: GeneratedIdentity | null,
): KitchenCostume {
  const flagship = FLAGSHIPS[cuisine];
  if (flagship) return flagship(restaurant);
  if (identity) return generatedCostume(identity, restaurant);
  return houseCostume(restaurant);
}

// ---------------------------------------------------------------------------
// The house look — MC Peels' own warm paper + gold, awning-striped.

const PAPER = '#F7F2E6';
const CARD = '#FFFFFF';
const INK = '#1D2433';
const INK_SOFT = '#6E7686';
const GOLD = '#F2B01E';
const NAVY = '#1D2433';

function Awning() {
  return (
    <View style={styles.awning}>
      {Array.from({ length: 9 }, (_, index) => (
        <View
          key={index}
          style={[styles.awningStripe, { backgroundColor: index % 2 === 0 ? GOLD : PAPER }]}
        />
      ))}
    </View>
  );
}

function houseCostume(restaurant: Restaurant): KitchenCostume {
  return {
    restaurant,

    tokens: {
      canvas: PAPER,
      paper: PAPER,
      card: CARD,
      ink: INK,
      inkSoft: INK_SOFT,
      accent: NAVY,
      onAccent: '#FFFFFF',
      onHero: INK,
      onHeroSoft: INK_SOFT,
      bar: NAVY,
      onBar: '#EAF2FE',
      order: NAVY,
      onOrder: '#EAF2FE',
    },

    voice: {
      back: '← back',
      instruction: 'open a dish to see its list — the + adds it to the cart plan',
      launch: 'build the cart →',
      launching: 'consolidating…',
      add: 'add to the plan',
      remove: 'in the plan ✓ — remove',
      signedOut: 'Sign in to build a real cart — the showcase keeps the stove off.',
      footnote:
        'Ingredients consolidate across dishes before the cart builds. You review and pay on Instacart — MC Peels never handles payment.',
    },

    renderHeroBackdrop: () => (
      <View style={[StyleSheet.absoluteFill, styles.wall]}>
        <Awning />
        <View style={styles.sun} />
      </View>
    ),

    renderHeroTitle: () => (
      <View>
        <Text style={styles.eyebrow}>FROM YOUR SHELF</Text>
        <Text style={styles.title} numberOfLines={2}>
          {restaurant.name}
        </Text>
        <Text style={styles.tagline}>{restaurant.tagline}</Text>
        <Text style={styles.meta}>{restaurant.meta.toUpperCase()}</Text>
      </View>
    ),

    barMark: restaurant.name.split(' ')[0].toUpperCase(),
    chipLabel: (_key, label) => label.split(' ')[0].toLowerCase(),

    dishMeta: (dish) =>
      [dish.heat && dish.heat > 0 ? '◆'.repeat(dish.heat) : null, `${dish.minutes} min`]
        .filter(Boolean)
        .join(' · '),
  };
}

const styles = StyleSheet.create({
  wall: { backgroundColor: PAPER, overflow: 'hidden' },
  awning: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 16,
    flexDirection: 'row',
  },
  awningStripe: { flex: 1 },
  sun: {
    position: 'absolute',
    right: -60,
    top: -70,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 176, 30, 0.16)',
  },
  eyebrow: {
    color: INK_SOFT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  title: {
    color: INK,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 36,
    maxWidth: '70%',
  },
  tagline: { color: INK_SOFT, fontSize: 13, lineHeight: 18, marginTop: 5, maxWidth: '66%' },
  meta: {
    color: '#9A6B00',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
    maxWidth: '66%',
  },
});
