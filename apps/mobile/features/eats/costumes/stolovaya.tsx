/**
 * «Столовая № 7» in costume form — the propaganda wall, the letterhead, the
 * banana steelworker, and the Bureau's voice, dressed onto the shared
 * chassis. The worker is ANCHORED IN THE HERO now (proposal Z1): he can
 * never stand on a dish name again.
 */

import { Image, StyleSheet, Text, View } from 'react-native';

import { POSTERS, Stamp } from './soviet';

import type { KitchenCostume } from '../costume';
import type { Restaurant } from '../types';

const PAPER = '#F2E8D5';
const INK = '#211C17';
const INK_SOFT = '#6E5D44';
const RED = '#C8332B';
const RED_LIGHT = '#DA5C50';

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function todayLine(): string {
  const now = new Date();
  return `МЕНЮ на ${now.getDate()} ${MONTHS_RU[now.getMonth()]} ${now.getFullYear()} г.`;
}

/** The wall: angular red-on-red stripes, a poster's ray background. */
function Stripes() {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: RED }]}>
      <View style={styles.stripeField}>
        {Array.from({ length: 14 }, (_, index) => (
          <View
            key={index}
            style={{ height: 58, backgroundColor: index % 2 === 0 ? RED : RED_LIGHT }}
          />
        ))}
      </View>
    </View>
  );
}

/** The Soviet canteen skin — dresses any minted post-Soviet kitchen. */
export function stolovayaCostume(restaurant: Restaurant): KitchenCostume {
  return {
  restaurant,
  mono: true,

  tokens: {
    canvas: RED,
    paper: PAPER,
    card: '#FBF4E4',
    ink: INK,
    inkSoft: INK_SOFT,
    accent: RED,
    onAccent: PAPER,
    onHero: PAPER,
    onHeroSoft: 'rgba(242, 232, 213, 0.75)',
    bar: '#171310',
    onBar: PAPER,
    order: '#171310',
    onOrder: PAPER,
  },

  voice: {
    back: '← НАЗАД · back',
    instruction: 'отметьте блюда — unfold a dish, stamp it В ПЛАН',
    launch: 'ПОЕХАЛИ →',
    launching: 'The Bureau consolidates…',
    add: 'В ПЛАН — add to the plan',
    remove: 'УБРАТЬ — remove',
    signedOut:
      'The Bureau requires a signed-in comrade. Launches are scrubbed in the showcase.',
    footnote:
      'Квитанция: ingredients consolidate across dishes before the cart is built. You review and pay on Instacart — the Bureau never handles money.',
  },

  renderHeroBackdrop: () => <Stripes />,

  // The steelworker stands at the hero's right edge, floating on his shadow —
  // pinned to the poster, clear of every menu line below it.
  renderHeroArt: () =>
    POSTERS.cutoutWorker ? (
      <View style={styles.workerWrap}>
        <View style={styles.workerShadow} />
        <Image source={POSTERS.cutoutWorker} resizeMode="contain" style={styles.worker} />
      </View>
    ) : null,

  renderHeroTitle: () => (
    <View>
      <Text style={styles.letterheadSmall}>НАРПИТ · ОБЩЕПИТ</Text>
      <Text style={styles.masthead}>
        СТОЛОВАЯ <Text style={styles.mastheadNo}>№ 7</Text>
      </Text>
      <Text style={styles.mastheadSub}>canteen no. 7 — the bureau of the evening meal</Text>
    </View>
  ),

  renderHeroBadge: () => (
    <>
      {POSTERS.crest ? (
        <Image source={POSTERS.crest} resizeMode="cover" style={styles.crest} />
      ) : null}
      <Stamp label="УТВЕРЖДЕНО" sub="approved for service" tone="cream" rotate={-2} />
    </>
  ),

  headerLine: todayLine,

  barMark: '№ 7',
  // One-word chips: 'ПЕРВЫЕ БЛЮДА' → 'первые'.
  chipLabel: (_key, label) => label.split(' ')[0].toLowerCase(),

  dishMeta: (dish) => dish.gost ?? `${dish.minutes} min`,
  };
}

const styles = StyleSheet.create({
  stripeField: {
    position: 'absolute',
    top: '-55%',
    left: '-50%',
    width: '200%',
    height: '230%',
    transform: [{ rotate: '-18deg' }],
  },
  workerWrap: {
    position: 'absolute',
    right: -18,
    bottom: -8,
    width: 128,
    height: 300,
  },
  workerShadow: {
    position: 'absolute',
    bottom: 8,
    left: 24,
    width: 82,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(23, 19, 16, 0.3)',
  },
  worker: {
    width: 128,
    height: 296,
    transform: [{ rotate: '-4deg' }],
  },
  letterheadSmall: {
    color: 'rgba(242, 232, 213, 0.8)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  masthead: {
    color: PAPER,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1.4,
    lineHeight: 36,
    maxWidth: '70%',
  },
  mastheadNo: { color: '#FFC531' },
  mastheadSub: {
    color: 'rgba(242, 232, 213, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 5,
    maxWidth: '66%',
  },
  crest: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    borderColor: PAPER,
  },
});
