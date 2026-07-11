/**
 * «Столовая № 7» — the menu as a document, staged like a propaganda poster.
 *
 * The wall: angular red-on-red stripes (TJ's spec, 2026-07-11). The banana
 * steelworker cutout stands PINNED TO THE SCREEN's bottom-left corner, big,
 * floating on a soft shadow — content scrolls behind him. The cream paper
 * sheet carries the pre-printed letterhead (heavy sans, red double rule) and
 * the day's menu typewritten onto it (monospace ledger rows, dotted leaders).
 * Tapping a line expands it in place — an accordion, like unfolding the
 * carbon copy — and stamping a dish В ПЛАН marks the row with a red numeral
 * block and an ОДОБРЕНО stamp.
 *
 * Visual rules inherited from the Book: red is the Bureau's voice, cream
 * boundaries between red and ink, no state insignia, Cyrillic is typeset.
 */

import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stamp } from '@/features/book/components';
import { POSTERS } from '@/features/book/posters';

import { STOLOVAYA } from './data/stolovaya';
import type { Dish, RestaurantScreenProps } from './types';
import { usePlan } from './usePlan';

const MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: '"Courier New", monospace',
});
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const INK_CANVAS = '#171310';
const PAPER = '#F2E8D5';
const INK = '#211C17';
const INK_SOFT = '#6E5D44';
const RED = '#C8332B';
/** The lighter propaganda stripe — same hue, sun-faded. */
const RED_LIGHT = '#DA5C50';
const ON_RED = '#F2E8D5';

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function todayLine(): string {
  const now = new Date();
  return `${now.getDate()} ${MONTHS_RU[now.getMonth()]} ${now.getFullYear()} г.`;
}

export function StolovayaScreen({
  householdId,
  previewMode = false,
  initialDishId,
  onCartBuilt,
  onBack,
}: RestaurantScreenProps) {
  const [openId, setOpenId] = useState<string | null>(initialDishId ?? null);
  // The worker greets at the corner, then steps aside as the menu scrolls up
  // (and returns when you scroll back). Content is never permanently covered.
  const scrollY = useRef(new Animated.Value(0)).current;
  const workerSlide = scrollY.interpolate({
    inputRange: [0, 380],
    outputRange: [0, 560],
    extrapolate: 'clamp',
  });
  const { selected, toggle, chosen, plan, building, error, launch } = usePlan({
    dishes: STOLOVAYA.dishes,
    householdId,
    previewMode,
    signedOutMessage:
      'The Bureau requires a signed-in comrade. Launches are scrubbed in the showcase.',
    onCartBuilt,
  });

  // Continuous ledger numbering across sections — a document counts once.
  const numbered = useMemo(() => {
    let counter = 0;
    return STOLOVAYA.sections.map((section) => ({
      section,
      rows: STOLOVAYA.dishes
        .filter((dish) => dish.section === section.key)
        .map((dish) => ({ dish, no: String(++counter).padStart(2, '0') })),
    }));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <PropagandaStripes />
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>← НАЗАД · back</Text>
          </Pressable>
        ) : null}

        <View style={styles.docWrap}>
        <View style={styles.paper}>
          {/* --- pre-printed letterhead; the right column stays clear for the
              paper-cutout worker pinned over the document's top corner --- */}
          <View style={styles.letterhead}>
            <Text style={styles.letterheadSmall}>НАРПИТ · ОБЩЕПИТ</Text>
            <Text style={styles.masthead}>СТОЛОВАЯ</Text>
            <Text style={styles.mastheadNo}>№ 7</Text>
            <Text style={styles.mastheadSub}>
              canteen no. 7 — the bureau of the evening meal
            </Text>
            <View style={styles.credRow}>
              {POSTERS.crest ? (
                <Image source={POSTERS.crest} resizeMode="cover" style={styles.crest} />
              ) : null}
              <Stamp label="УТВЕРЖДЕНО" sub="approved for service" tone="ink" rotate={-2} />
            </View>
          </View>
          <View style={styles.doubleRule}>
            <View style={styles.ruleThick} />
            <View style={styles.ruleThin} />
          </View>

          {/* --- the typed-in part begins --- */}
          <Text style={styles.dateLine}>МЕНЮ на {todayLine()}</Text>
          <Text style={styles.instruction}>
            отметьте блюда — tap a line to unfold it, stamp it В ПЛАН
          </Text>

          {numbered.map(({ section, rows }) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <Text style={styles.sectionSub}>{section.sub}</Text>
              </View>
              {rows.map(({ dish, no }) => (
                <LedgerRow
                  key={dish.id}
                  dish={dish}
                  no={no}
                  open={openId === dish.id}
                  inPlan={selected.has(dish.id)}
                  onOpen={() => setOpenId(openId === dish.id ? null : dish.id)}
                  onToggle={() => toggle(dish.id)}
                />
              ))}
            </View>
          ))}

          <Text style={styles.paperFootnote}>
            Квитанция: ingredients consolidate across dishes before the cart is built. You
            review and pay on Instacart — the Bureau never handles money.
          </Text>
        </View>
        </View>
      </Animated.ScrollView>

      {/* The banana steelworker — big, bottom-left of the SCREEN, floating on
          a soft shadow. Touches pass through; scrolling walks him offstage. */}
      {POSTERS.cutoutWorker ? (
        <Animated.View
          style={[styles.workerWrap, { transform: [{ translateY: workerSlide }] }]}
          pointerEvents="none"
        >
          <View style={styles.workerShadow} />
          <Image source={POSTERS.cutoutWorker} resizeMode="contain" style={styles.worker} />
        </Animated.View>
      ) : null}

      {chosen.length > 0 ? (
        <View style={styles.planBar}>
          {error ? (
            <View style={styles.scrub}>
              <Text style={styles.scrubText}>{error}</Text>
            </View>
          ) : null}
          <Text style={styles.planSummary}>
            {chosen.length} {chosen.length === 1 ? 'блюдо' : 'блюда'} → {plan.items.length} cart
            items{plan.sharedCount > 0 ? ` · ${plan.sharedCount} work double shifts` : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={launch}
            disabled={building}
            style={({ pressed }) => [
              styles.launchBand,
              { opacity: pressed || building ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.launchText}>
              {building ? 'The Bureau consolidates…' : 'ПОЕХАЛИ — build the cart'}
            </Text>
            {POSTERS.fist ? (
              <Image source={POSTERS.fist} resizeMode="cover" style={styles.fistPlate} />
            ) : null}
            {!building ? <Text style={styles.launchArrow}>→</Text> : null}
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

interface LedgerRowProps {
  dish: Dish;
  no: string;
  open: boolean;
  inPlan: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function LedgerRow({ dish, no, open, inPlan, onOpen, onToggle }: LedgerRowProps) {
  return (
    <View style={[styles.row, open && styles.rowOpen]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onOpen}
        style={({ pressed }) => [styles.rowLine, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.rowNo, inPlan && styles.rowNoInPlan]}>
          <Text style={[styles.rowNoText, inPlan && styles.rowNoTextInPlan]}>{no}</Text>
        </View>
        <View style={styles.rowName}>
          <Text style={styles.rowTitle}>{dish.name}</Text>
          <Text style={styles.rowCyrillic}>{dish.sub}</Text>
        </View>
        <View style={styles.leader} />
        <Text style={styles.rowMeta}>×{dish.serves}</Text>
      </Pressable>

      {open ? (
        <View style={styles.rowDetail}>
          <View style={styles.rowDetailHead}>
            <Text style={styles.rowGost}>{dish.gost}</Text>
            <Text style={styles.rowGostMeta}>
              {dish.minutes} мин · {dish.tags[0]}
            </Text>
          </View>
          <Text style={styles.rowStory}>{dish.description}</Text>
          {dish.note ? <Text style={styles.rowNote}>“{dish.note}”</Text> : null}
          <View style={styles.specBlock}>
            {dish.ingredients.map((ingredient) => (
              <Text key={ingredient.name} style={styles.specLine}>
                {ingredient.pantry
                  ? `— ${ingredient.name} · pantry, assumed`
                  : `— ${[ingredient.quantity, ingredient.unit, ingredient.name]
                      .filter(Boolean)
                      .join(' ')}`}
              </Text>
            ))}
          </View>
          <View style={styles.rowActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: inPlan }}
              onPress={onToggle}
              style={({ pressed }) => [
                styles.rowAction,
                inPlan ? styles.rowActionSelected : null,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.rowActionText, inPlan && styles.rowActionTextSelected]}>
                {inPlan ? 'УБРАТЬ — remove' : 'В ПЛАН — add to the plan'}
              </Text>
            </Pressable>
            {inPlan ? (
              <Stamp label="ОДОБРЕНО" sub="approved" tone="red" rotate={-6} />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The wall: angular red-on-red stripes, a poster's ray background. */
function PropagandaStripes() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.stripeClip]} pointerEvents="none">
      <View style={styles.stripeField}>
        {Array.from({ length: 30 }, (_, index) => (
          <View
            key={index}
            style={{ height: 74, backgroundColor: index % 2 === 0 ? RED : RED_LIGHT }}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RED },
  stripeClip: {
    overflow: 'hidden',
  },
  stripeField: {
    position: 'absolute',
    top: '-55%',
    left: '-50%',
    width: '200%',
    height: '230%',
    transform: [{ rotate: '-18deg' }],
  },
  scroll: {
    padding: 14,
    paddingBottom: 48,
    maxWidth: 660,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: PAPER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  backText: {
    color: PAPER,
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  // Wrapper so the cutout can hang past the paper's edges onto the ink wall.
  docWrap: {
    marginTop: 26,
  },
  paper: {
    backgroundColor: PAPER,
    borderWidth: 2,
    borderColor: INK,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  letterhead: {},
  letterheadSmall: {
    color: INK_SOFT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  masthead: {
    color: INK,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.4,
    lineHeight: 33,
  },
  mastheadNo: {
    color: RED,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1.5,
    lineHeight: 40,
  },
  mastheadSub: {
    color: INK_SOFT,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  credRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  crest: {
    width: 46,
    height: 46,
    borderWidth: 1.5,
    borderColor: INK,
  },
  workerWrap: {
    position: 'absolute',
    left: -14,
    bottom: -6,
    width: 200,
    height: 492,
    zIndex: 4,
  },
  // The light shadow beneath him — a soft ellipse under the boots.
  workerShadow: {
    position: 'absolute',
    bottom: 10,
    left: 26,
    width: 148,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(23, 19, 16, 0.3)',
    filter: [{ blur: 6 }],
  },
  worker: {
    width: 200,
    height: 489,
    transform: [{ rotate: '-4deg' }],
    // Lift: a soft down-shadow so he reads raised off the wall (web/android;
    // iOS renders without — the sticker outline still sells the cutout).
    filter: [
      {
        dropShadow: {
          offsetX: 0,
          offsetY: 6,
          standardDeviation: 8,
          color: 'rgba(23, 19, 16, 0.28)',
        },
      },
    ],
  },
  fistPlate: {
    width: 40,
    height: 40,
    borderWidth: 1.5,
    borderColor: ON_RED,
  },
  doubleRule: {
    marginTop: 12,
    gap: 3,
  },
  ruleThick: { height: 4, backgroundColor: RED },
  ruleThin: { height: 1.5, backgroundColor: RED },
  dateLine: {
    fontFamily: MONO,
    color: INK,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  instruction: {
    fontFamily: MONO,
    color: INK_SOFT,
    fontSize: 11.5,
    marginTop: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 6,
  },
  sectionLabel: {
    color: INK,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  sectionSub: {
    color: INK_SOFT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  row: {
    paddingVertical: 2,
  },
  rowOpen: {
    backgroundColor: 'rgba(33, 28, 23, 0.045)',
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 7,
    minHeight: 44,
  },
  rowNo: {
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignSelf: 'center',
  },
  rowNoInPlan: {
    backgroundColor: RED,
    borderColor: RED,
  },
  rowNoText: {
    fontFamily: MONO,
    color: INK,
    fontSize: 12,
    fontWeight: '700',
  },
  rowNoTextInPlan: {
    color: ON_RED,
  },
  rowName: {
    flexShrink: 1,
  },
  rowTitle: {
    fontFamily: MONO,
    color: INK,
    fontSize: 15,
    fontWeight: '700',
  },
  rowCyrillic: {
    fontFamily: MONO,
    color: INK_SOFT,
    fontSize: 11.5,
  },
  leader: {
    flex: 1,
    borderBottomWidth: 2,
    borderStyle: 'dotted',
    borderBottomColor: INK_SOFT,
    marginBottom: 8,
    minWidth: 16,
  },
  rowMeta: {
    fontFamily: MONO,
    color: INK,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  rowDetail: {
    paddingBottom: 14,
    paddingTop: 2,
    gap: 7,
  },
  rowDetailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  rowGost: {
    fontFamily: MONO,
    color: RED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  rowGostMeta: {
    fontFamily: MONO,
    color: INK_SOFT,
    fontSize: 11,
  },
  rowStory: {
    fontFamily: MONO,
    color: INK,
    fontSize: 12.5,
    lineHeight: 18,
  },
  rowNote: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: INK,
    fontSize: 13.5,
    lineHeight: 19,
  },
  specBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 28, 23, 0.25)',
    paddingTop: 7,
    gap: 2,
  },
  specLine: {
    fontFamily: MONO,
    color: INK,
    fontSize: 12,
    lineHeight: 17,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  rowAction: {
    borderWidth: 2,
    borderColor: RED,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowActionSelected: {
    backgroundColor: RED,
  },
  rowActionText: {
    fontFamily: MONO,
    color: RED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  rowActionTextSelected: {
    color: ON_RED,
  },
  paperFootnote: {
    fontFamily: MONO,
    color: INK_SOFT,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 28, 23, 0.25)',
    paddingTop: 10,
  },
  planBar: {
    borderTopWidth: 1.5,
    borderTopColor: PAPER,
    backgroundColor: INK_CANVAS,
    padding: 16,
    paddingBottom: 20,
    gap: 10,
    width: '100%',
    maxWidth: 660,
    alignSelf: 'center',
    // Draws over the corner-pinned worker when the plan is live.
    zIndex: 6,
  },
  planSummary: {
    fontFamily: MONO,
    color: PAPER,
    fontSize: 13,
    fontWeight: '700',
  },
  scrub: {
    borderWidth: 2,
    borderColor: PAPER,
    backgroundColor: RED,
    padding: 12,
  },
  scrubText: {
    color: ON_RED,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  launchBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: RED,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  launchText: {
    color: ON_RED,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  launchArrow: {
    color: ON_RED,
    fontSize: 18,
    fontWeight: '800',
  },
});
