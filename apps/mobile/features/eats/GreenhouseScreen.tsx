/**
 * greenhouse — the menu as a botanical index.
 *
 * Opposite costume to the canteen on purpose: warm-white canvas, sage ink,
 * lowercase Georgia italics, hairline dividers, and negative space doing the
 * decorating. You browse by *benefit* (glow / fuel / reset / morning ritual),
 * not by course — rows are quiet one-liners with macro-honest small caps, and
 * the detail sheet reads like a plant tag, not an ad.
 */

import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GREENHOUSE } from './data/greenhouse';
import type { Dish, RestaurantScreenProps } from './types';
import { usePlan } from './usePlan';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const CANVAS = '#FAF9F3';
const CARD = '#FFFFFF';
const INK = '#2A2E26';
const MUTED = '#7C8074';
const SAGE = '#4E5D43';
const SAGE_SOFT = '#EEF1E6';
const HAIRLINE = '#E4E2D6';

type BenefitKey = 'all' | string;

export function GreenhouseScreen({
  householdId,
  previewMode = false,
  initialDishId,
  onCartBuilt,
  onBack,
}: RestaurantScreenProps) {
  const [benefit, setBenefit] = useState<BenefitKey>('all');
  const [detailId, setDetailId] = useState<string | null>(initialDishId ?? null);
  const { selected, toggle, chosen, plan, building, error, launch } = usePlan({
    dishes: GREENHOUSE.dishes,
    householdId,
    previewMode,
    signedOutMessage: 'the garden gate is closed — sign in to harvest a real basket.',
    onCartBuilt,
  });

  const sections = useMemo(() => {
    const keys =
      benefit === 'all'
        ? GREENHOUSE.sections
        : GREENHOUSE.sections.filter((section) => section.key === benefit);
    return keys.map((section) => ({
      section,
      dishes: GREENHOUSE.dishes.filter((dish) => dish.section === section.key),
    }));
  }, [benefit]);

  const detail = detailId
    ? (GREENHOUSE.dishes.find((dish) => dish.id === detailId) ?? null)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>← back</Text>
          </Pressable>
        ) : null}

        <View style={styles.header}>
          <LeafMark />
          <Text style={styles.title}>greenhouse</Text>
          <Text style={styles.tagline}>eat like the sun is out — market-fresh, macro-honest</Text>
        </View>

        <View style={styles.rail}>
          {[{ key: 'all', label: 'everything' }, ...GREENHOUSE.sections].map((entry) => {
            const active = benefit === entry.key;
            return (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setBenefit(entry.key)}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sections.map(({ section, dishes }) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <Text style={styles.sectionSub}>{section.sub}</Text>
            </View>
            {dishes.map((dish) => (
              <IndexRow
                key={dish.id}
                dish={dish}
                inBasket={selected.has(dish.id)}
                onOpen={() => setDetailId(dish.id)}
                onToggle={() => toggle(dish.id)}
              />
            ))}
          </View>
        ))}

        <Text style={styles.footnote}>
          quantities feed four · your household profile applies at build time · you review and
          pay on instacart
        </Text>
      </ScrollView>

      {chosen.length > 0 ? (
        <View style={styles.basketBar}>
          {error ? <Text style={styles.basketError}>{error}</Text> : null}
          <View style={styles.basketRow}>
            <Text style={styles.basketSummary}>
              {chosen.length} {chosen.length === 1 ? 'dish' : 'dishes'} · {plan.items.length}{' '}
              ingredients
              {plan.sharedCount > 0 ? ` · ${plan.sharedCount} pull double duty` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={launch}
              disabled={building}
              style={({ pressed }) => [
                styles.basketButton,
                { opacity: pressed || building ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.basketButtonText}>
                {building ? 'harvesting…' : 'harvest the basket →'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal
        visible={detail !== null}
        transparent
        animationType="none"
        onRequestClose={() => setDetailId(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="close"
            onPress={() => setDetailId(null)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(42, 46, 38, 0.4)' }]}
          />
          {detail ? (
            <PlantTag
              dish={detail}
              inBasket={selected.has(detail.id)}
              onToggle={() => toggle(detail.id)}
              onClose={() => setDetailId(null)}
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

/** A single leaf, drawn — a square with two opposite corners fully rounded. */
function LeafMark({ size = 22 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: SAGE,
        borderTopLeftRadius: size,
        borderBottomRightRadius: size,
        transform: [{ rotate: '45deg' }],
        marginBottom: 6,
      }}
    />
  );
}

function macros(dish: Dish): string {
  return [
    dish.kcal ? `${dish.kcal} kcal` : null,
    dish.protein ? `${dish.protein}g protein` : null,
    `${dish.minutes} min`,
  ]
    .filter(Boolean)
    .join(' · ');
}

interface IndexRowProps {
  dish: Dish;
  inBasket: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function IndexRow({ dish, inBasket, onOpen, onToggle }: IndexRowProps) {
  return (
    <View style={[styles.row, inBasket && styles.rowInBasket]}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.rowBody, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.rowName}>{dish.name}</Text>
        <Text style={styles.rowDescription}>{dish.description}</Text>
        <Text style={styles.rowMacros}>{macros(dish).toUpperCase()}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={inBasket ? `remove ${dish.name}` : `add ${dish.name}`}
        accessibilityState={{ selected: inBasket }}
        onPress={onToggle}
        hitSlop={8}
        style={({ pressed }) => [
          styles.rowAdd,
          inBasket && styles.rowAddSelected,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.rowAddText, inBasket && styles.rowAddTextSelected]}>
          {inBasket ? '✓' : '+'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface PlantTagProps {
  dish: Dish;
  inBasket: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function PlantTag({ dish, inBasket, onToggle, onClose }: PlantTagProps) {
  const section = GREENHOUSE.sections.find((entry) => entry.key === dish.section);
  return (
    <View style={styles.tag}>
      <View style={styles.tagHead}>
        <Text style={styles.tagBenefit}>{section?.label ?? dish.section}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} hitSlop={10}>
          <Text style={styles.tagClose}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.tagTitle}>{dish.name}</Text>
      <Text style={styles.tagDescription}>{dish.description}</Text>
      <Text style={styles.tagMacros}>{macros(dish).toUpperCase()}</Text>

      <View style={styles.tagDivider} />
      <Text style={styles.tagListLabel}>what's inside</Text>
      {dish.ingredients.map((ingredient) => (
        <Text key={ingredient.name} style={styles.tagIngredient}>
          {ingredient.pantry
            ? `${ingredient.name} — from your pantry`
            : [ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
        </Text>
      ))}
      {dish.note ? <Text style={styles.tagNote}>“{dish.note}”</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: inBasket }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.tagAction,
          inBasket && styles.tagActionSelected,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.tagActionText}>
          {inBasket ? 'in your basket ✓ — tap to remove' : 'add to basket'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CANVAS },
  scroll: {
    padding: 22,
    paddingBottom: 30,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
    backgroundColor: CARD,
  },
  backText: {
    color: MUTED,
    fontSize: 13,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: INK,
    fontSize: 38,
  },
  tagline: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  rail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: CARD,
  },
  pillActive: {
    backgroundColor: SAGE,
    borderColor: SAGE,
  },
  pillText: {
    color: INK,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  pillTextActive: {
    color: '#F7F6EE',
  },
  section: {
    marginTop: 22,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: SAGE,
    fontSize: 22,
  },
  sectionSub: {
    color: MUTED,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowInBasket: {
    backgroundColor: SAGE_SOFT,
    marginHorizontal: -10,
    paddingHorizontal: 14,
    borderBottomColor: 'transparent',
    borderRadius: 14,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowName: {
    fontFamily: SERIF,
    color: INK,
    fontSize: 19,
  },
  rowDescription: {
    color: MUTED,
    fontSize: 13.5,
    lineHeight: 19,
  },
  rowMacros: {
    color: SAGE,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  rowAdd: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: SAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAddSelected: {
    backgroundColor: SAGE,
  },
  rowAddText: {
    color: SAGE,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 21,
  },
  rowAddTextSelected: {
    color: '#F7F6EE',
  },
  footnote: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 30,
  },
  basketBar: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: CANVAS,
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 20,
    gap: 8,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  basketError: {
    color: '#A2543F',
    fontSize: 13,
    lineHeight: 18,
  },
  basketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  basketSummary: {
    flex: 1,
    color: INK,
    fontSize: 13,
    lineHeight: 18,
    minWidth: 160,
  },
  basketButton: {
    backgroundColor: SAGE,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 13,
    minHeight: 48,
    justifyContent: 'center',
  },
  basketButtonText: {
    color: '#F7F6EE',
    fontSize: 14.5,
    fontWeight: '600',
  },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  tag: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 460,
    gap: 6,
  },
  tagHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagBenefit: {
    color: SAGE,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  tagClose: {
    color: MUTED,
    fontSize: 17,
  },
  tagTitle: {
    fontFamily: SERIF,
    color: INK,
    fontSize: 26,
    marginTop: 2,
  },
  tagDescription: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
  },
  tagMacros: {
    color: SAGE,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  tagDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
    marginVertical: 10,
  },
  tagListLabel: {
    color: INK,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'lowercase',
    marginBottom: 2,
  },
  tagIngredient: {
    color: INK,
    fontSize: 13.5,
    lineHeight: 20,
  },
  tagNote: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: SAGE,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 8,
  },
  tagAction: {
    marginTop: 14,
    backgroundColor: SAGE,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tagActionSelected: {
    backgroundColor: INK,
  },
  tagActionText: {
    color: '#F7F6EE',
    fontSize: 14.5,
    fontWeight: '600',
  },
});
