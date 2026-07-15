/**
 * Dish + kitchen art with graceful fallbacks. Real illustrations live in
 * assets/eats/ and surface through the generated manifest; until a dish has
 * art, it wears a designed tile in its kitchen's own theme — a motif, never
 * a bare letter on a flat color.
 *
 * Two fallback grades (the Pinterest rule — every tile is a poster):
 *   · small chip (≤ ~90px): a simple motif that stays legible at menu scale
 *   · poster card (the home wall): a full tiny poster per kitchen —
 *     Столовая ration card, greenhouse seed packet, La Milpa lotería card —
 *     dense with type, borders, and texture, designed to be pinned.
 */

import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { DISH_ART, KITCHEN_HEROES } from './art-manifest';
import type { Dish, Restaurant } from './types';

const MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: '"Courier New", monospace',
});
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

export function kitchenHero(kitchenId: string) {
  return KITCHEN_HEROES[kitchenId] ?? null;
}

export function dishArt(kitchenId: string, dishId: string) {
  return DISH_ART[`${kitchenId}/${dishId}`] ?? null;
}

// ---------------------------------------------------------------------------

interface DishTileProps {
  restaurant: Restaurant;
  dish: Dish;
  size: number;
  radius?: number;
}

/**
 * The dish tile: the illustration when it exists, else the kitchen-themed
 * fallback — a motif ground with the dish initial set like a menu ornament.
 */
export function DishTile({ restaurant, dish, size, radius = 10 }: DishTileProps) {
  const art = dishArt(restaurant.id, dish.id);
  if (art) {
    return (
      <Image
        source={art}
        resizeMode="cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return <FallbackTile restaurant={restaurant} dish={dish} size={size} radius={radius} />;
}

function FallbackTile({ restaurant, dish, size, radius = 10 }: DishTileProps) {
  const initial = dish.name.charAt(0).toUpperCase();
  const base = { width: size, height: size, borderRadius: radius, overflow: 'hidden' as const };

  if (restaurant.id === 'stolovaya-7') {
    // Sun-faded diagonal stripe + a plate roundel, initial set like a stamp.
    return (
      <View style={[base, { backgroundColor: '#C8332B' }]}>
        <View style={[styles.stripe, { backgroundColor: '#DA5C50', width: size * 1.8 }]} />
        <View style={styles.center}>
          <View style={[styles.roundel, { borderColor: '#F2E8D5', width: size * 0.62, height: size * 0.62, borderRadius: size }]}>
            <Text style={[styles.stampInitial, { color: '#F2E8D5', fontSize: size * 0.3 }]}>
              {initial}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (restaurant.id === 'greenhouse') {
    // Paper ground, sage leaf behind a serif initial — a seed-catalog plate.
    return (
      <View style={[base, { backgroundColor: '#F1F3E8' }]}>
        <View
          style={[
            styles.leaf,
            {
              backgroundColor: '#7A8C6E',
              width: size * 0.52,
              height: size * 0.52,
              borderTopLeftRadius: size,
              borderBottomRightRadius: size,
              top: size * 0.12,
              right: size * 0.1,
            },
          ]}
        />
        <View style={styles.center}>
          <Text style={[styles.serifInitial, { color: '#4E5D43', fontSize: size * 0.42 }]}>
            {initial.toLowerCase()}
          </Text>
        </View>
      </View>
    );
  }

  // La Milpa (and any future kitchen until it declares its own motif):
  // rotating fiesta grounds with a papel-picado notch and a heavy initial.
  const fiesta = ['#E84B8A', '#159F94', '#8A4FD0', '#F2A007'];
  const ground = fiesta[dish.name.length % fiesta.length];
  return (
    <View style={[base, { backgroundColor: ground }]}>
      <View style={[styles.picadoRow, { gap: size * 0.06, paddingHorizontal: size * 0.08 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: size * 0.07,
              borderRightWidth: size * 0.07,
              borderTopWidth: size * 0.11,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: '#FBF3E4',
            }}
          />
        ))}
      </View>
      <View style={styles.center}>
        <Text style={[styles.heavyInitial, { color: '#FBF3E4', fontSize: size * 0.4 }]}>
          {initial}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Poster cards — the home wall's tiles. Real art fills the card when it
// exists; otherwise each kitchen's designed tiny-poster template does.

interface PosterCardProps {
  restaurant: Restaurant;
  dish: Dish;
  height: number;
}

export function PosterCard({ restaurant, dish, height }: PosterCardProps) {
  const art = dishArt(restaurant.id, dish.id);
  if (art) {
    return (
      <View style={[posterStyles.frame, { height }]}>
        <Image source={art} resizeMode="cover" style={StyleSheet.absoluteFill} />
        <View style={posterStyles.artBanner}>
          <Text style={posterStyles.artBannerText} numberOfLines={1}>
            {dish.name}
          </Text>
        </View>
      </View>
    );
  }

  if (restaurant.id === 'stolovaya-7') {
    // Ration card: typed paper, red double rule, ГОСТ line, big typed initial.
    return (
      <View style={[posterStyles.frame, { height, backgroundColor: '#F2E8D5' }]}>
        <View style={posterStyles.rationInner}>
          <Text style={posterStyles.rationBureau} numberOfLines={1}>
            СТОЛОВАЯ № 7 · ТАЛОН
          </Text>
          <View style={posterStyles.rationRule} />
          <View style={posterStyles.rationRuleThin} />
          <Text style={posterStyles.rationInitial}>{dish.name.charAt(0).toUpperCase()}</Text>
          <Text style={posterStyles.rationName} numberOfLines={2}>
            {dish.name.toUpperCase()}
          </Text>
          {dish.sub ? (
            <Text style={posterStyles.rationSub} numberOfLines={1}>
              {dish.sub}
            </Text>
          ) : null}
          <View style={posterStyles.rationFoot}>
            <Text style={posterStyles.rationGost} numberOfLines={1}>
              {dish.gost ?? `ГОСТ ${String(dish.minutes).padStart(2, '0')}-26`}
            </Text>
            <Text style={posterStyles.rationServes}>×{dish.serves}</Text>
          </View>
        </View>
        <View style={posterStyles.rationStamp}>
          <Text style={posterStyles.rationStampText}>ОДОБРЕНО</Text>
        </View>
      </View>
    );
  }

  if (restaurant.id === 'greenhouse') {
    // Seed packet: framed paper, leaf crest, serif italic name, sowing rules.
    return (
      <View style={[posterStyles.frame, { height, backgroundColor: '#FAF9F3' }]}>
        <View style={posterStyles.packetBorder}>
          <Text style={posterStyles.packetHouse}>GREENHOUSE · SEED Nº {dish.minutes}</Text>
          <View style={posterStyles.packetLeafRow}>
            <View style={posterStyles.packetLeaf} />
          </View>
          <Text style={posterStyles.packetName} numberOfLines={2}>
            {dish.name.toLowerCase()}
          </Text>
          <View style={posterStyles.packetRule} />
          <Text style={posterStyles.packetSpec} numberOfLines={2}>
            {[
              dish.kcal ? `${dish.kcal} kcal` : null,
              dish.protein ? `${dish.protein}g protein` : null,
              `${dish.minutes} min`,
            ]
              .filter(Boolean)
              .join(' · ')
              .toUpperCase()}
          </Text>
          <Text style={posterStyles.packetFoot}>SOWN FRESH · FEEDS FOUR</Text>
        </View>
      </View>
    );
  }

  // La Milpa — the lotería card. Nº top-left, heavy figure, name banner.
  const fiesta = ['#E84B8A', '#159F94', '#8A4FD0', '#F2A007'];
  const accent = fiesta[((dish.cardNo ?? dish.name.length) - 1 + fiesta.length) % fiesta.length];
  return (
    <View style={[posterStyles.frame, { height, backgroundColor: '#FBF3E4' }]}>
      <View style={[posterStyles.loteriaBorder, { borderColor: accent }]}>
        <View style={posterStyles.loteriaHead}>
          <Text style={[posterStyles.loteriaNo, { color: accent }]}>
            {dish.cardNo ?? '?'}
          </Text>
          <Text style={posterStyles.loteriaHeat}>
            {dish.heat && dish.heat > 0 ? '🌶'.repeat(dish.heat) : 'dulce'}
          </Text>
        </View>
        <View style={[posterStyles.loteriaFigure, { backgroundColor: accent }]}>
          <Text style={posterStyles.loteriaInitial}>{dish.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={[posterStyles.loteriaBanner, { backgroundColor: '#241430' }]}>
          <Text style={posterStyles.loteriaBannerText} numberOfLines={1}>
            {(dish.sub ?? dish.name).toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

const posterStyles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0px 8px 18px rgba(29, 36, 51, 0.16)',
  },
  artBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 16, 12, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  artBannerText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  // Столовая — ТАЛОН (ration card)
  rationInner: { flex: 1, padding: 12, paddingTop: 10 },
  rationBureau: {
    fontFamily: MONO,
    color: '#6E5D44',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    maxWidth: '70%',
  },
  rationRule: { height: 3, backgroundColor: '#C8332B', marginTop: 6 },
  rationRuleThin: { height: 1, backgroundColor: '#C8332B', marginTop: 2 },
  rationInitial: {
    position: 'absolute',
    right: 4,
    top: 26,
    fontFamily: MONO,
    fontSize: 74,
    fontWeight: '700',
    color: 'rgba(200, 51, 43, 0.16)',
  },
  rationName: {
    fontFamily: MONO,
    color: '#211C17',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.6,
    lineHeight: 19,
    marginTop: 12,
    maxWidth: '86%',
  },
  rationSub: {
    fontFamily: MONO,
    color: '#6E5D44',
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 3,
  },
  rationFoot: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 28, 23, 0.25)',
    borderStyle: 'dashed',
    paddingTop: 6,
  },
  rationGost: { fontFamily: MONO, color: '#C8332B', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8 },
  rationServes: { fontFamily: MONO, color: '#211C17', fontSize: 11, fontWeight: '700' },
  rationStamp: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 51, 43, 0.55)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    transform: [{ rotate: '6deg' }],
  },
  rationStampText: {
    fontFamily: MONO,
    color: 'rgba(200, 51, 43, 0.75)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // greenhouse — seed packet
  packetBorder: {
    flex: 1,
    margin: 7,
    borderWidth: 1.5,
    borderColor: '#4E5D43',
    borderRadius: 8,
    padding: 10,
  },
  packetHouse: {
    color: '#7C8074',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  packetLeafRow: { alignItems: 'center', marginTop: 10 },
  packetLeaf: {
    width: 34,
    height: 34,
    backgroundColor: '#7A8C6E',
    borderTopLeftRadius: 34,
    borderBottomRightRadius: 34,
    transform: [{ rotate: '45deg' }],
    opacity: 0.85,
  },
  packetName: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: '#2A2E26',
    fontSize: 17,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  packetRule: { height: 1, backgroundColor: '#DDE1CC', marginTop: 10, marginBottom: 6 },
  packetSpec: {
    color: '#4E5D43',
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 13,
  },
  packetFoot: {
    marginTop: 'auto',
    color: '#7C8074',
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
  },

  // La Milpa — lotería card
  loteriaBorder: {
    flex: 1,
    margin: 7,
    borderWidth: 2,
    borderRadius: 10,
    padding: 9,
  },
  loteriaHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  loteriaNo: { fontFamily: SERIF, fontSize: 20, fontWeight: '700' },
  loteriaHeat: { fontSize: 9, color: '#7A6470', fontWeight: '700', letterSpacing: 0.6 },
  loteriaFigure: {
    flex: 1,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loteriaInitial: { color: '#FBF3E4', fontSize: 42, fontWeight: '900' },
  loteriaBanner: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  loteriaBannerText: {
    color: '#FBF3E4',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripe: {
    position: 'absolute',
    height: '34%',
    top: '33%',
    left: '-40%',
    transform: [{ rotate: '-18deg' }],
  },
  roundel: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  stampInitial: { fontWeight: '900', letterSpacing: 1 },
  leaf: { position: 'absolute', transform: [{ rotate: '45deg' }], opacity: 0.9 },
  serifInitial: { fontFamily: 'Georgia', fontStyle: 'italic', fontWeight: '700' },
  picadoRow: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row' },
  heavyInitial: { fontWeight: '900', letterSpacing: 1 },
});
