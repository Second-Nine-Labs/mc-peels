/**
 * «Столовая № 7» — the menu as a document, not a card grid.
 *
 * One cream paper sheet floats on an ink-dark canvas: a pre-printed letterhead
 * (heavy sans, red double rule) with the day's menu typewritten onto it
 * (monospace ledger rows, dotted leaders). Tapping a line expands it in place
 * — an accordion, like unfolding the carbon copy — and stamping a dish
 * В ПЛАН marks the row with a red numeral block and an ОДОБРЕНО stamp.
 *
 * Visual rules inherited from the Book: red is the Bureau's voice, red never
 * touches ink without a cream boundary, no state insignia, Cyrillic is typeset.
 */

import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stamp } from '@/features/book/components';

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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>← НАЗАД · back</Text>
          </Pressable>
        ) : null}

        <View style={styles.paper}>
          {/* --- pre-printed letterhead --- */}
          <View style={styles.letterheadRow}>
            <Text style={styles.letterheadSmall}>НАРПИТ · ОБЩЕПИТ</Text>
            <Stamp label="УТВЕРЖДЕНО" sub="approved for service" tone="ink" rotate={2} />
          </View>
          <Text style={styles.masthead}>СТОЛОВАЯ № 7</Text>
          <Text style={styles.mastheadSub}>canteen no. 7 — the bureau of the evening meal</Text>
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
      </ScrollView>

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: INK_CANVAS },
  scroll: {
    padding: 14,
    paddingBottom: 28,
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
  paper: {
    backgroundColor: PAPER,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  letterheadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  letterheadSmall: {
    color: INK_SOFT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginTop: 4,
  },
  masthead: {
    color: INK,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mastheadSub: {
    color: INK_SOFT,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 2,
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
    backgroundColor: RED,
    paddingVertical: 14,
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
