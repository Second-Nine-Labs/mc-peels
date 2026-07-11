/**
 * La Milpa — the menu as a lotería deck.
 *
 * A deep-plum mercado night with papel picado strung across the top. Every
 * dish is a numbered card in a thick colored frame (the accents rotate:
 * rosa, marigold, teal, violeta), Spanish title big, chile dots for heat.
 * Tapping a card flips to its "back" — story, mercado list, abuela's line.
 * Third costume, same machinery: AL CARRITO stamps a dish into the plan.
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

import { LA_MILPA } from './data/lamilpa';
import type { Dish, RestaurantScreenProps } from './types';
import { usePlan } from './usePlan';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const PLUM = '#241430';
const CREAM = '#FBF3E4';
const INK = '#2B1A24';
const MUTED = '#7A6470';
const ROSA = '#E84B8A';
const MARIGOLD = '#F2A007';
const TEAL = '#159F94';
const VIOLETA = '#8A4FD0';
const CHILE = '#D2372C';

const ACCENTS = [ROSA, MARIGOLD, TEAL, VIOLETA];

function accentFor(dish: Dish): string {
  return ACCENTS[((dish.cardNo ?? 1) - 1) % ACCENTS.length];
}

export function LaMilpaScreen({
  householdId,
  previewMode = false,
  initialDishId,
  onCartBuilt,
  onBack,
}: RestaurantScreenProps) {
  const [detailId, setDetailId] = useState<string | null>(initialDishId ?? null);
  const { selected, toggle, chosen, plan, building, error, launch } = usePlan({
    dishes: LA_MILPA.dishes,
    householdId,
    previewMode,
    signedOutMessage: '¡Momento! Sign in first — the mercado only fills baskets for comrades… ahem, customers.',
    onCartBuilt,
  });

  const sections = useMemo(
    () =>
      LA_MILPA.sections.map((section) => ({
        section,
        dishes: LA_MILPA.dishes.filter((dish) => dish.section === section.key),
      })),
    [],
  );

  const detail = detailId
    ? (LA_MILPA.dishes.find((dish) => dish.id === detailId) ?? null)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PapelPicado />

        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>← al mercado</Text>
          </Pressable>
        ) : null}

        <View style={styles.header}>
          <Text style={styles.title}>LA MILPA</Text>
          <Text style={styles.subtitle}>cocina de mercado</Text>
          <Text style={styles.tagline}>
            Every dish is a card — la suerte está en la cocina. Pick your hand, we buy the
            mercado run.
          </Text>
        </View>

        {sections.map(({ section, dishes }) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.banner}>
              <Text style={styles.bannerLabel}>{section.label.toUpperCase()}</Text>
              <Text style={styles.bannerSub}>{section.sub}</Text>
            </View>
            <View style={styles.grid}>
              {dishes.map((dish) => (
                <LoteriaCard
                  key={dish.id}
                  dish={dish}
                  inCart={selected.has(dish.id)}
                  onOpen={() => setDetailId(dish.id)}
                  onToggle={() => toggle(dish.id)}
                />
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.footnote}>
          Feeds four, always. You review and pay on Instacart — La Milpa only writes the
          shopping list.
        </Text>
      </ScrollView>

      {chosen.length > 0 ? (
        <View style={styles.cartBar}>
          {error ? (
            <View style={styles.cartError}>
              <Text style={styles.cartErrorText}>{error}</Text>
            </View>
          ) : null}
          <Text style={styles.cartSummary}>
            {chosen.length} {chosen.length === 1 ? 'platillo' : 'platillos'} →{' '}
            {plan.items.length} items del mercado
            {plan.sharedCount > 0 ? ` · ${plan.sharedCount} shared` : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={launch}
            disabled={building}
            style={({ pressed }) => [
              styles.cartButton,
              { opacity: pressed || building ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.cartButtonText}>
              {building ? 'armando el carrito…' : '¡Vámonos! — build the cart →'}
            </Text>
          </Pressable>
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
            accessibilityLabel="cerrar"
            onPress={() => setDetailId(null)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(36, 20, 48, 0.72)' }]}
          />
          {detail ? (
            <CardBack
              dish={detail}
              inCart={selected.has(detail.id)}
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

/** A string of cut-paper flags across the top of the mercado. */
function PapelPicado() {
  const colors = [ROSA, MARIGOLD, TEAL, CREAM, VIOLETA, MARIGOLD, ROSA, TEAL, CREAM, VIOLETA];
  return (
    <View style={styles.picadoWrap}>
      <View style={styles.picadoString} />
      <View style={styles.picadoRow}>
        {colors.map((color, index) => (
          <View
            key={index}
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 13,
              borderRightWidth: 13,
              borderTopWidth: 22,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function HeatDots({ heat = 0 }: { heat?: number }) {
  if (heat === 0) {
    return <Text style={styles.heatNone}>dulce</Text>;
  }
  return (
    <View style={styles.heatRow}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.heatDot,
            { backgroundColor: index < heat ? CHILE : 'transparent', borderColor: CHILE },
          ]}
        />
      ))}
    </View>
  );
}

interface LoteriaCardProps {
  dish: Dish;
  inCart: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function LoteriaCard({ dish, inCart, onOpen, onToggle }: LoteriaCardProps) {
  const accent = accentFor(dish);
  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.75 : 1 }]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.cardNo, { color: accent }]}>
            № {dish.cardNo}
          </Text>
          <HeatDots heat={dish.heat} />
        </View>
        <Text style={styles.cardSpanish}>{dish.sub?.toUpperCase()}</Text>
        <Text style={styles.cardName}>{dish.name}</Text>
        <Text style={styles.cardDescription} numberOfLines={3}>
          {dish.description}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: inCart }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.cardAction,
          { backgroundColor: inCart ? INK : accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.cardActionText}>{inCart ? '¡LISTO! ✓' : 'AL CARRITO +'}</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface CardBackProps {
  dish: Dish;
  inCart: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function CardBack({ dish, inCart, onToggle, onClose }: CardBackProps) {
  const accent = accentFor(dish);
  return (
    <View style={[styles.backCard, { borderColor: accent }]}>
      <View style={[styles.backInner, { borderColor: accent }]}>
        <View style={styles.backHead}>
          <View style={[styles.backNo, { backgroundColor: accent }]}>
            <Text style={styles.backNoText}>№ {dish.cardNo}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="cerrar" onPress={onClose} hitSlop={10}>
            <Text style={styles.backClose}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.backSpanish}>{dish.sub?.toUpperCase()}</Text>
        <Text style={styles.backName}>{dish.name}</Text>
        <View style={styles.backMetaRow}>
          <HeatDots heat={dish.heat} />
          <Text style={styles.backMeta}>
            · {dish.minutes} min · feeds {dish.serves}
          </Text>
        </View>
        <Text style={styles.backDescription}>{dish.description}</Text>

        <Text style={[styles.backListLabel, { color: accent }]}>DEL MERCADO</Text>
        {dish.ingredients.map((ingredient) => (
          <Text key={ingredient.name} style={styles.backIngredient}>
            •{' '}
            {ingredient.pantry
              ? `${ingredient.name} — ya lo tienes (pantry)`
              : [ingredient.quantity, ingredient.unit, ingredient.name]
                  .filter(Boolean)
                  .join(' ')}
          </Text>
        ))}
        {dish.note ? <Text style={styles.backNote}>“{dish.note}” — la abuela</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: inCart }}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.backAction,
            { backgroundColor: inCart ? INK : accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.backActionText}>
            {inCart ? '¡LISTO! ✓ — quitar del carrito' : 'AL CARRITO +'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PLUM },
  scroll: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 28,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  picadoWrap: {
    marginHorizontal: -16,
    marginBottom: 14,
  },
  picadoString: {
    height: 2,
    backgroundColor: CREAM,
    opacity: 0.7,
  },
  picadoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  back: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: CREAM,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  backText: {
    color: CREAM,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: MARIGOLD,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: ROSA,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  subtitle: {
    color: CREAM,
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 17,
    marginTop: 2,
  },
  tagline: {
    color: 'rgba(251, 243, 228, 0.75)',
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 8,
  },
  section: {
    marginTop: 18,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: CREAM,
    paddingBottom: 6,
    marginBottom: 12,
  },
  bannerLabel: {
    color: CREAM,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  bannerSub: {
    color: 'rgba(251, 243, 228, 0.65)',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    backgroundColor: CREAM,
    borderWidth: 3,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
    justifyContent: 'space-between',
  },
  cardBody: {
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNo: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardSpanish: {
    color: INK,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardName: {
    color: INK,
    fontSize: 13,
    fontWeight: '600',
  },
  cardDescription: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 16.5,
    marginTop: 2,
  },
  cardAction: {
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cardActionText: {
    color: CREAM,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heatRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heatDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
  },
  heatNone: {
    color: MUTED,
    fontSize: 10.5,
    fontStyle: 'italic',
  },
  footnote: {
    color: 'rgba(251, 243, 228, 0.6)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 26,
  },
  cartBar: {
    borderTopWidth: 2,
    borderTopColor: CREAM,
    backgroundColor: MARIGOLD,
    padding: 16,
    paddingBottom: 20,
    gap: 10,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  cartError: {
    backgroundColor: CREAM,
    borderRadius: 8,
    padding: 10,
  },
  cartErrorText: {
    color: INK,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  cartSummary: {
    color: PLUM,
    fontSize: 13.5,
    fontWeight: '800',
  },
  cartButton: {
    backgroundColor: PLUM,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  cartButtonText: {
    color: MARIGOLD,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backCard: {
    backgroundColor: CREAM,
    borderWidth: 4,
    borderRadius: 14,
    padding: 7,
    width: '100%',
    maxWidth: 440,
  },
  backInner: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    gap: 5,
  },
  backHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  backNo: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  backNoText: {
    color: CREAM,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  backClose: {
    color: MUTED,
    fontSize: 18,
    fontWeight: '700',
  },
  backSpanish: {
    color: INK,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  backName: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  backMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  backMeta: {
    color: MUTED,
    fontSize: 12,
  },
  backDescription: {
    color: INK,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 6,
  },
  backListLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 10,
    marginBottom: 2,
  },
  backIngredient: {
    color: INK,
    fontSize: 13,
    lineHeight: 19,
  },
  backNote: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: INK,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 8,
  },
  backAction: {
    marginTop: 14,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  backActionText: {
    color: CREAM,
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
