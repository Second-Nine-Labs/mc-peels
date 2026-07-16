/**
 * greenhouse in costume form — the botanical index dressed onto the shared
 * chassis. Warm-white canvas, sage ink, lowercase Georgia italics, and
 * negative space doing the decorating; the hero is a pale glasshouse wall
 * with a soft planting bed and a few translucent leaves pressed against it.
 * The voice stays the warm nutritionist — macro-honest, never a cleanse.
 */

import { Platform, StyleSheet, Text, View } from 'react-native';

import type { KitchenCostume } from '../costume';
import type { Restaurant } from '../types';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const CANVAS = '#FAF9F3';
const CARD = '#FFFFFF';
const INK = '#2A2E26';
const MUTED = '#7C8074';
const SAGE = '#4E5D43';
const SAGE_SOFT = '#EEF1E6';
const HAIRLINE = '#E4E2D6';
/** Text on sage — the bespoke screen's active-pill / basket-button cream. */
const CREAM = '#F7F6EE';

/** A single leaf, drawn — a square with two opposite corners fully rounded. */
function Leaf({ size, color, rotate = '45deg' }: { size: number; color: string; rotate?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderTopLeftRadius: size,
        borderBottomRightRadius: size,
        transform: [{ rotate }],
      }}
    />
  );
}

/** The greenhouse skin — foundation, ready for a fresh/healthy cuisine (not
 * yet wired into the factory: no natural cuisine key fits it today). */
export function greenhouseCostume(restaurant: Restaurant): KitchenCostume {
  return {
  restaurant,

  tokens: {
    canvas: CANVAS,
    paper: CANVAS,
    card: CARD,
    ink: INK,
    inkSoft: MUTED,
    accent: SAGE,
    onAccent: CREAM,
    // The hero ground is paper; controls on it take the house sage outline.
    onHero: SAGE,
    onHeroSoft: MUTED,
    bar: SAGE,
    onBar: CREAM,
    order: INK,
    onOrder: CREAM,
  },

  voice: {
    back: '← back',
    instruction: 'open a dish to read its tag — the + adds it to your basket',
    launch: 'harvest the basket →',
    launching: 'harvesting…',
    add: 'add to basket',
    remove: 'in your basket ✓ — tap to remove',
    signedOut: 'the garden gate is closed — sign in to harvest a real basket.',
    footnote:
      'quantities feed four · your household profile applies at build time · you review and pay on instacart',
  },

  // The glasshouse wall: warm paper, one watermark leaf high on the glass,
  // and a soft sage bed rising along the bottom edge.
  renderHeroBackdrop: () => (
    <View style={[StyleSheet.absoluteFill, styles.wall]}>
      <View style={styles.wallLeaf}>
        <Leaf size={230} color="rgba(78, 93, 67, 0.06)" />
      </View>
      <View style={styles.wallBand} />
    </View>
  ),

  // Two translucent leaves drift down the right edge — the title block owns
  // the left two-thirds and the foliage never crosses into it.
  renderHeroArt: () => (
    <>
      <View style={styles.artLeafBig}>
        <Leaf size={128} color="rgba(78, 93, 67, 0.12)" rotate="52deg" />
      </View>
      <View style={styles.artLeafSmall}>
        <Leaf size={72} color="rgba(78, 93, 67, 0.2)" rotate="18deg" />
      </View>
    </>
  ),

  // The letterhead keeps the bespoke order: leaf mark, wordmark, tagline —
  // plus the kitchen's own small-caps meta line in macro-honest sage.
  renderHeroTitle: () => (
    <View>
      <View style={styles.titleMark}>
        <Leaf size={22} color={SAGE} />
      </View>
      <Text style={styles.wordmark}>greenhouse</Text>
      <Text style={styles.tagline}>eat like the sun is out — market-fresh, macro-honest</Text>
      <Text style={styles.heroMeta}>{restaurant.meta.toUpperCase()}</Text>
    </View>
  ),

  barMark: 'greenhouse',
  // One-word chips: 'morning ritual' → 'morning'.
  chipLabel: (_key, label) => label.split(' ')[0].toLowerCase(),

  // Macro honesty in small caps — the bespoke row's exact line, uppercased:
  // '520 KCAL · 18G PROTEIN · 25 MIN'.
  dishMeta: (dish) =>
    [
      dish.kcal ? `${dish.kcal} kcal` : null,
      dish.protein ? `${dish.protein}g protein` : null,
      `${dish.minutes} min`,
    ]
      .filter(Boolean)
      .join(' · ')
      .toUpperCase(),
  };
}

const styles = StyleSheet.create({
  wall: { backgroundColor: CANVAS, overflow: 'hidden' },
  wallLeaf: {
    position: 'absolute',
    right: -84,
    top: -72,
  },
  wallBand: {
    position: 'absolute',
    left: '-12%',
    right: '-12%',
    bottom: -58,
    height: 132,
    backgroundColor: SAGE_SOFT,
    borderTopLeftRadius: 220,
    borderTopRightRadius: 220,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  artLeafBig: {
    position: 'absolute',
    right: -42,
    top: 16,
  },
  artLeafSmall: {
    position: 'absolute',
    right: 30,
    top: 132,
  },
  titleMark: { marginBottom: 6, alignSelf: 'flex-start' },
  wordmark: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: INK,
    fontSize: 38,
    lineHeight: 44,
    maxWidth: '70%',
  },
  tagline: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    maxWidth: '66%',
  },
  heroMeta: {
    color: SAGE,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginTop: 10,
    maxWidth: '66%',
  },
});
