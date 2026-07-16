/**
 * La Milpa in costume form — the mercado dressed onto the shared chassis.
 * Marigold wall, papel-picado strung along the top, plum ink, rosa doing the
 * shouting. The voice keeps the bespoke screen's abuela energy: Spanish
 * first, English riding along, chiles for heat and lotería numbers on the
 * cards. Feeds four, always.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { KitchenCostume } from '../costume';
import { LA_MILPA } from '../data/lamilpa';

const PLUM = '#241430';
const CREAM = '#FBF3E4';
const INK = '#2B1A24';
const MUTED = '#7A6470';
const ROSA = '#E84B8A';
const MARIGOLD = '#F2A007';
const TEAL = '#159F94';
const VIOLETA = '#8A4FD0';

const PICADO = [ROSA, TEAL, CREAM, VIOLETA, ROSA, TEAL, CREAM, VIOLETA, ROSA, TEAL];

/** One string of papel picado — downward pennant triangles. */
function PicadoRow({ size = 10, colors = PICADO }: { size?: number; colors?: string[] }) {
  return (
    <View style={[styles.picadoRow, { gap: size * 0.6 }]}>
      {colors.map((color, index) => (
        <View
          key={index}
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: size,
            borderRightWidth: size,
            borderTopWidth: size * 1.55,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: color,
          }}
        />
      ))}
    </View>
  );
}

export const LA_MILPA_COSTUME: KitchenCostume = {
  restaurant: LA_MILPA,

  tokens: {
    canvas: MARIGOLD,
    paper: CREAM,
    card: '#FFF9EA',
    ink: INK,
    inkSoft: MUTED,
    accent: ROSA,
    onAccent: '#FFFFFF',
    // The hero ground is marigold — plum ink carries the title block.
    onHero: PLUM,
    onHeroSoft: 'rgba(36, 20, 48, 0.72)',
    bar: PLUM,
    onBar: CREAM,
    order: PLUM,
    onOrder: CREAM,
  },

  voice: {
    back: '← al mercado',
    instruction: 'open a card to flip it — abuela wrote the backs herself',
    launch: '¡Vámonos! →',
    launching: 'armando el carrito…',
    add: 'al carrito — add it',
    remove: 'quitar — remove',
    signedOut:
      '¡Momento! Sign in first — the mercado only fills baskets for comrades… ahem, customers.',
    footnote:
      'Feeds four, always. You review and pay on Instacart — La Milpa only writes the shopping list.',
  },

  // The mercado wall: marigold, picado strung along the top edge, and a big
  // soft plum sun low on the right.
  renderHeroBackdrop: () => (
    <View style={[StyleSheet.absoluteFill, styles.wall]}>
      <View style={styles.picadoTop}>
        <PicadoRow size={11} />
      </View>
      <View style={styles.sun} />
    </View>
  ),

  // A second, looser string of picado drifts down the right edge — the title
  // block owns the left two-thirds and the papel never crosses it.
  renderHeroArt: () => (
    <View style={styles.artString}>
      <PicadoRow size={8} colors={[TEAL, VIOLETA, ROSA, CREAM, TEAL]} />
    </View>
  ),

  renderHeroTitle: () => (
    <View>
      <Text style={styles.eyebrow}>EL MERCADO · DEL COMAL</Text>
      <Text style={styles.title}>LA MILPA</Text>
      <Text style={styles.tagline}>
        {LA_MILPA.sub} — {LA_MILPA.cuisine.toLowerCase()}
      </Text>
      <Text style={styles.heroMeta}>{LA_MILPA.meta.toUpperCase()}</Text>
    </View>
  ),

  barMark: 'LA MILPA',
  // One-word chips, mercado-lowercase.
  chipLabel: (_key, label) => label.split(' ')[0].toLowerCase(),

  // Lotería number + heat, the bespoke card's corner line: 'Nº 12 · ◆◆'
  // (heat 0 reads 'dulce'). Typographic diamonds, never emoji (house rule).
  dishMeta: (dish) => {
    const parts = [
      dish.cardNo ? `Nº ${dish.cardNo}` : null,
      dish.heat && dish.heat > 0 ? '◆'.repeat(dish.heat) : 'dulce',
    ].filter(Boolean);
    return parts.join(' · ');
  },
};

const styles = StyleSheet.create({
  wall: { backgroundColor: MARIGOLD, overflow: 'hidden' },
  picadoRow: { flexDirection: 'row' },
  picadoTop: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 0,
  },
  sun: {
    position: 'absolute',
    right: -70,
    bottom: -90,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: 'rgba(36, 20, 48, 0.12)',
  },
  artString: {
    position: 'absolute',
    right: 14,
    top: 84,
    transform: [{ rotate: '-90deg' }],
    transformOrigin: 'top right',
  },
  eyebrow: {
    color: 'rgba(36, 20, 48, 0.7)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  title: {
    color: PLUM,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 38,
    maxWidth: '70%',
    textShadowColor: ROSA,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  tagline: {
    color: PLUM,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: '66%',
  },
  heroMeta: {
    color: 'rgba(36, 20, 48, 0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
    maxWidth: '66%',
  },
});
