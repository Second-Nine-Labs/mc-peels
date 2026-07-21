/**
 * The generated costume — how a shelf-minted kitchen wears its LLM-written
 * identity (name, voice, palette seed) when its cuisine has no hand-built
 * flagship costume. The palette engine expands the seed into premium tokens;
 * the hero starts as a deterministic, palette-built backdrop and upgrades to a
 * generated photograph the instant one is cached (the "procedural now, photo
 * when ready" reveal).
 *
 * No bespoke per-cuisine art (that's what the flagships are) — instead one
 * tasteful, palette-driven backdrop language that reads as a real place for
 * any cuisine, Thai to Levantine.
 */

import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import type { KitchenCostume } from '../costume';
import type { GeneratedIdentity } from '../identity';
import { buildTokens, hslA } from '../palette';
import type { Restaurant } from '../types';

const MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: '"Courier New", monospace',
});

/**
 * The hero backdrop: a palette-built ground (a soft accent glow + a tonal
 * depth wash + a low diagonal band) that always renders instantly. When a
 * generated hero photo exists, it layers over the ground under a scrim so the
 * light title stays legible on any image.
 */
/**
 * Bottom-anchored scrim bands, tallest and lightest first. Percentages are of
 * the hero's height; each composes over the ones beneath it, so the effective
 * darkness ramps toward the foot where the text block sits.
 */
const SCRIM_FOOT = [
  { height: '65%' as const, alpha: 0.14 },
  { height: '45%' as const, alpha: 0.14 },
  { height: '28%' as const, alpha: 0.14 },
  { height: '14%' as const, alpha: 0.12 },
];

function GeneratedBackdrop({ identity }: { identity: GeneratedIdentity }) {
  const { mode, hue, accentHue } = identity.palette;
  const tokens = buildTokens(identity.palette);
  const glow = mode === 'dark' ? 0.28 : 0.2;
  const band = mode === 'dark' ? 0.16 : 0.12;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.canvas, overflow: 'hidden' }]}>
      {/* soft accent glow, upper-right */}
      <View
        style={{
          position: 'absolute',
          right: -70,
          top: -80,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: hslA(accentHue, 70, mode === 'dark' ? 52 : 56, glow),
        }}
      />
      {/* tonal depth wash, lower-left */}
      <View
        style={{
          position: 'absolute',
          left: -60,
          bottom: -90,
          width: 240,
          height: 240,
          borderRadius: 999,
          backgroundColor: hslA(hue, 40, mode === 'dark' ? 22 : 82, mode === 'dark' ? 0.5 : 0.55),
        }}
      />
      {/* a low diagonal band — a table's edge, an awning line */}
      <View
        style={{
          position: 'absolute',
          left: -40,
          right: -40,
          bottom: 22,
          height: 46,
          backgroundColor: hslA(accentHue, 64, mode === 'dark' ? 50 : 46, band),
          transform: [{ rotate: '-4deg' }],
        }}
      />

      {identity.heroUrl ? (
        <>
          <Image source={{ uri: identity.heroUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          {/* Legibility scrim. An even wash, a band under the day pill at the
              top, and a ramp up from the bottom — because the hero's real text
              block (eyebrow, dish name, description, CTA) sits at the FOOT, and
              it previously had only the flat 0.34 wash over it. That is review
              §7's "the eyebrow sits over a bright part of the image": the old
              scrim weighted the half with the least text on it.

              Stacked flat bands rather than a gradient — expo-linear-gradient
              is not a dependency, and layered translucent views are already how
              this file builds its ground. Composed alpha runs 0.34 mid-frame →
              0.65 at the bottom edge. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10, 8, 14, 0.34)' }]} />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: '62%',
              backgroundColor: 'rgba(10, 8, 14, 0.28)',
            }}
          />
          {SCRIM_FOOT.map((band) => (
            <View
              key={band.height}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: band.height,
                backgroundColor: `rgba(10, 8, 14, ${band.alpha})`,
              }}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

export function generatedCostume(identity: GeneratedIdentity, restaurant: Restaurant): KitchenCostume {
  const tokens = buildTokens(identity.palette);
  const hasPhoto = Boolean(identity.heroUrl);

  // Over a photo, the title flips to light on the scrim; over the procedural
  // ground it keeps the palette's own hero ink.
  const onHero = hasPhoto ? '#FBF7F2' : tokens.onHero;
  const onHeroSoft = hasPhoto ? 'rgba(251, 247, 242, 0.82)' : tokens.onHeroSoft;
  const metaColor = hasPhoto ? 'rgba(251, 247, 242, 0.9)' : tokens.accent;

  const eyebrowStyle = [styles.eyebrow, { color: onHeroSoft }, identity.mono ? styles.mono : null];
  const metaStyle = [styles.meta, { color: metaColor }, identity.mono ? styles.mono : null];

  return {
    restaurant,
    mono: identity.mono,

    // NOTE: onHero/onHeroSoft here are SCRIM-AWARE — over a photo they become
    // near-white regardless of palette mode. Only read them for text that sits
    // on the hero backdrop. Anything on canvas/paper/card must use ink/inkSoft,
    // or a light-mode kitchen renders cream on cream. The structural fix (a
    // separate scrim token + a legibility gate) lands with the design seed.
    tokens: { ...tokens, onHero, onHeroSoft },

    voice: {
      back: identity.voice?.back ?? '← back',
      instruction: 'open a dish to see its list — the + adds it to the cart plan',
      launch: identity.voice?.launch ?? 'build the cart →',
      launching: 'consolidating…',
      add: identity.voice?.add ?? 'add to the plan',
      remove: identity.voice?.remove ?? 'in the plan — remove',
      signedOut: 'Sign in to build a real cart — the showcase keeps the stove off.',
      footnote:
        'Ingredients consolidate across dishes before the cart builds. You review and pay on Instacart — MC Peels never handles payment.',
    },

    renderHeroBackdrop: () => <GeneratedBackdrop identity={identity} />,

    renderHeroTitle: () => (
      <View>
        <Text style={eyebrowStyle}>FROM YOUR SHELF</Text>
        <Text style={[styles.title, { color: onHero }]} numberOfLines={2}>
          {restaurant.name}
        </Text>
        {restaurant.sub ? (
          <Text style={[styles.sub, { color: onHeroSoft }]} numberOfLines={1}>
            {restaurant.sub}
          </Text>
        ) : null}
        <Text style={[styles.tagline, { color: onHeroSoft }]} numberOfLines={2}>
          {restaurant.tagline}
        </Text>
        <Text style={metaStyle}>{restaurant.meta.toUpperCase()}</Text>
      </View>
    ),

    barMark: identity.name.split(' ')[0].toUpperCase(),
    chipLabel: (_key, label) => label.split(' ')[0].toLowerCase(),

    dishMeta: (dish) =>
      [dish.heat && dish.heat > 0 ? '◆'.repeat(dish.heat) : null, `${dish.minutes} min`]
        .filter(Boolean)
        .join(' · '),
  };
}

const styles = StyleSheet.create({
  mono: { fontFamily: MONO },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 38,
    maxWidth: '72%',
  },
  sub: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 3,
    maxWidth: '70%',
  },
  tagline: { fontSize: 13, lineHeight: 18, marginTop: 6, maxWidth: '66%' },
  meta: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
    maxWidth: '66%',
  },
});
