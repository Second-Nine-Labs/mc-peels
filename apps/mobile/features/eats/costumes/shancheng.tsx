/**
 * 山城 · Mountain City — the flagship shelf-born kitchen (sichuan-chongqing).
 *
 * Chongqing by night: lacquered dark, red lanterns glowing over the mountain
 * silhouettes the city is named for, numbing heat on every card. The whole
 * menu runs dark — the one kitchen where paper is night, not paper. Voice is
 * the late-night noodle stall: short, hot, a little smug.
 *
 * Unlike the static trio this costume is a FACTORY — the Shelf mints the
 * menu, so the restaurant object arrives at runtime.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { KitchenCostume } from '../costume';
import type { Restaurant } from '../types';

const NIGHT = '#170D10';
const NIGHT_SOFT = '#241318';
const CARD = '#2B181D';
const CREAM = '#F6E7D3';
const CREAM_SOFT = 'rgba(246, 231, 211, 0.72)';
const CHILE = '#FF4438';
const LANTERN = '#E23D33';
const GOLD = '#F2B01E';

/** A glowing lantern — layered translucent halos around a solid core. */
function Lantern({ size, x, y, dim = false }: { size: number; x: number; y: number; dim?: boolean }) {
  const glow = dim ? 0.10 : 0.16;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: x - size,
          top: y - size,
          width: size * 2,
          height: size * 2,
          borderRadius: 999,
          backgroundColor: `rgba(226, 61, 51, ${glow})`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - size * 0.45,
          top: y - size * 0.45,
          width: size * 0.9,
          height: size * 0.9,
          borderRadius: 999,
          backgroundColor: dim ? 'rgba(226, 61, 51, 0.55)' : LANTERN,
        }}
      />
      {/* the little gold crown + tassel that make it a lantern, not a dot */}
      <View
        style={{
          position: 'absolute',
          left: x - size * 0.12,
          top: y - size * 0.58,
          width: size * 0.24,
          height: size * 0.14,
          backgroundColor: GOLD,
          borderRadius: 2,
          opacity: dim ? 0.6 : 1,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: x - 1,
          top: y + size * 0.45,
          width: 2,
          height: size * 0.4,
          backgroundColor: GOLD,
          opacity: dim ? 0.45 : 0.8,
        }}
      />
    </>
  );
}

/** The 山 skyline — overlapping mountain triangles along the hero's foot. */
function Mountains() {
  const peaks = [
    { left: -30, size: 130, color: '#20101477' },
    { left: 60, size: 170, color: '#1C0E12' },
    { left: 190, size: 120, color: '#20101477' },
    { left: 260, size: 180, color: '#1C0E12' },
  ];
  return (
    <>
      {peaks.map((peak, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            bottom: -peak.size * 0.34,
            left: peak.left,
            width: 0,
            height: 0,
            borderLeftWidth: peak.size,
            borderRightWidth: peak.size,
            borderBottomWidth: peak.size,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: peak.color,
          }}
        />
      ))}
    </>
  );
}

export function shanchengCostume(restaurant: Restaurant): KitchenCostume {
  return {
    restaurant,

    tokens: {
      canvas: NIGHT,
      paper: NIGHT_SOFT,
      card: CARD,
      ink: CREAM,
      inkSoft: CREAM_SOFT,
      accent: CHILE,
      onAccent: '#FFF6EC',
      onHero: CREAM,
      onHeroSoft: CREAM_SOFT,
      bar: '#0E0709',
      onBar: CREAM,
      order: '#0E0709',
      onOrder: CREAM,
    },

    voice: {
      back: '← 下山 · back',
      instruction: 'open a dish to see what the stall puts in the pot',
      launch: '开火 — fire the wok →',
      launching: 'the wok is heating…',
      add: '加 — into the pot',
      remove: '撤 — out of the pot',
      signedOut: 'The stall cooks for signed-in comrades only — the showcase never fires a wok.',
      footnote:
        'Late-night honesty: ingredients consolidate across dishes before the cart builds. You review and pay on Instacart — 山城 never touches money.',
    },

    renderHeroBackdrop: () => (
      <View style={[StyleSheet.absoluteFill, styles.night]}>
        <Mountains />
      </View>
    ),

    // Lanterns hang down the hero's right edge; the title owns the left.
    renderHeroArt: () => (
      <>
        <Lantern size={34} x={318} y={64} />
        <Lantern size={22} x={262} y={118} dim />
        <Lantern size={27} x={334} y={168} dim />
      </>
    ),

    renderHeroTitle: () => (
      <View>
        <Text style={styles.eyebrow}>重庆 · THE NIGHT STALL</Text>
        <Text style={styles.hanzi}>山城</Text>
        <Text style={styles.latin}>MOUNTAIN CITY</Text>
        <Text style={styles.tagline}>chongqing night kitchen — 麻辣, always</Text>
        <Text style={styles.meta}>{restaurant.meta.toUpperCase()}</Text>
      </View>
    ),

    renderHeroBadge: () => (
      <View style={styles.malaChip}>
        <Text style={styles.malaChipText}>麻辣 · MÁLÀ CERTIFIED</Text>
      </View>
    ),

    // The home storefront: night card, lanterns lit, mountains low.
    renderStorefront: () => (
      <View style={styles.front}>
        <Mountains />
        <Lantern size={26} x={300} y={38} />
        <Lantern size={17} x={252} y={74} dim />
        <View style={styles.frontBody}>
          <Text style={styles.frontHanzi}>山城</Text>
          <Text style={styles.frontLatin}>MOUNTAIN CITY · 麻辣 always</Text>
          <Text style={styles.frontMeta}>{restaurant.meta.toUpperCase()}</Text>
        </View>
        <View style={styles.frontOpened}>
          <Text style={styles.frontOpenedText}>OPENED FROM YOUR SHELF</Text>
        </View>
      </View>
    ),

    barMark: '山城',
    chipLabel: (_key, label) => label.split(' ')[0].toLowerCase(),

    // Heat + clock — the stall's shorthand: '🌶🌶🌶 · 20 min'.
    dishMeta: (dish) =>
      [dish.heat && dish.heat > 0 ? '🌶'.repeat(dish.heat) : null, `${dish.minutes} min`]
        .filter(Boolean)
        .join(' · '),
  };
}

const styles = StyleSheet.create({
  night: { backgroundColor: NIGHT, overflow: 'hidden' },
  eyebrow: {
    color: CREAM_SOFT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: 8,
  },
  hanzi: {
    color: CREAM,
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 60,
    letterSpacing: 4,
  },
  latin: {
    color: CHILE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 5,
    marginTop: 2,
  },
  tagline: {
    color: CREAM_SOFT,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: '64%',
  },
  meta: {
    color: 'rgba(242, 176, 30, 0.85)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 8,
    maxWidth: '64%',
  },
  malaChip: {
    borderWidth: 1.5,
    borderColor: CHILE,
    paddingHorizontal: 9,
    paddingVertical: 4,
    transform: [{ rotate: '-2deg' }],
  },
  malaChipText: {
    color: CHILE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  front: {
    backgroundColor: NIGHT,
    minHeight: 148,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  frontBody: { padding: 18, gap: 2 },
  frontHanzi: { color: CREAM, fontSize: 30, fontWeight: '900', letterSpacing: 3 },
  frontLatin: { color: CHILE, fontSize: 10, fontWeight: '800', letterSpacing: 2.4 },
  frontMeta: {
    color: 'rgba(242, 176, 30, 0.85)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  frontOpened: {
    position: 'absolute',
    top: 12,
    left: 18,
    backgroundColor: GOLD,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  frontOpenedText: { color: '#1D2433', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
});
