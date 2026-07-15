/**
 * The kitchen chassis — one restaurant screen, worn by every costume.
 *
 * Four zones, engineered once (proposal: "build the restaurant once,
 * costume it forever"):
 *
 *   Z1  hero        — the costume's backdrop, art, and letterhead. All art
 *                     is anchored here; it can never occlude the menu.
 *   Z2  sticky bar  — kitchen mark + course chips; pins under the notch and
 *                     jumps between sections.
 *   Z3  menu        — scannable dish cards (tile · name · sub · meta · add)
 *                     that unfold into the full spec (story, note, GOST line,
 *                     ingredients) in place.
 *   Z4  order bar   — pinned once anything is selected; launches the plan
 *                     through the same usePlan flow the bespoke screens used.
 *
 * The chassis knows nothing about any one kitchen; costumes supply tokens,
 * voice, and render slots (see costume.tsx). Menu content comes straight
 * from the Restaurant data. Behavior — selection, consolidation, cart
 * launch, deep links — is byte-for-byte the old flow.
 */

import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DishTile } from './art';
import type { KitchenCostume } from './costume';
import type { Dish, RestaurantScreenProps } from './types';
import { usePlan } from './usePlan';

const MONO = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: '"Courier New", monospace',
});

interface KitchenScreenProps extends RestaurantScreenProps {
  costume: KitchenCostume;
}

export function KitchenScreen({
  costume,
  householdId,
  previewMode = false,
  initialDishId,
  onCartBuilt,
  onBack,
}: KitchenScreenProps) {
  const { restaurant, tokens: t, voice } = costume;
  const family = costume.mono ? MONO : undefined;

  const [openId, setOpenId] = useState<string | null>(initialDishId ?? null);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const dishY = useRef<Record<string, number>>({});
  const menuTop = useRef(0);
  const didDeepLink = useRef(false);

  const { selected, toggle, chosen, plan, building, error, launch } = usePlan({
    dishes: restaurant.dishes,
    householdId,
    previewMode,
    signedOutMessage: voice.signedOut,
    onCartBuilt,
  });

  const sections = useMemo(
    () =>
      restaurant.sections
        .map((section) => ({
          section,
          dishes: restaurant.dishes.filter((dish) => dish.section === section.key),
        }))
        .filter((entry) => entry.dishes.length > 0),
    [restaurant],
  );

  // Deep link (home search / picks rail): unfold the dish and bring it up
  // once its row has reported a layout position.
  useEffect(() => {
    if (!initialDishId || didDeepLink.current) return;
    const timer = setTimeout(() => {
      const y = dishY.current[initialDishId];
      if (y != null) {
        didDeepLink.current = true;
        scrollRef.current?.scrollTo({ y: Math.max(0, menuTop.current + y - 120), animated: true });
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [initialDishId]);

  const jumpTo = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, menuTop.current + y - 64), animated: true });
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, chosen.length > 0 && styles.scrollWithOrder]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Z1 · hero — the costume owns this box entirely ---- */}
        <View style={styles.hero}>
          <View style={StyleSheet.absoluteFill}>{costume.renderHeroBackdrop()}</View>
          {costume.renderHeroArt ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {costume.renderHeroArt()}
            </View>
          ) : null}
          <View style={styles.heroContent}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                onPress={onBack}
                style={[styles.back, { borderColor: t.onHero }]}
              >
                <Text style={[styles.backText, { color: t.onHero, fontFamily: family }]}>
                  {voice.back}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.backSpacer} />
            )}
            <View style={styles.heroTitle}>
              {costume.renderHeroTitle()}
              {costume.renderHeroBadge ? (
                <View style={styles.heroBadge}>{costume.renderHeroBadge()}</View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ---- Z2 · sticky identity bar ---- */}
        <View style={[styles.bar, { backgroundColor: t.bar }]}>
          <View style={styles.barInner}>
            <Text
              style={[styles.barMark, { color: t.onBar, fontFamily: family }]}
              numberOfLines={1}
            >
              {costume.barMark}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {sections.map(({ section }) => (
                  <Pressable
                    key={section.key}
                    accessibilityRole="button"
                    onPress={() => jumpTo(section.key)}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: t.onBar, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: t.onBar, fontFamily: family }]}>
                      {costume.chipLabel
                        ? costume.chipLabel(section.key, section.label)
                        : section.label.toLowerCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* ---- Z3 · the menu ---- */}
        <View
          style={[styles.menu, { backgroundColor: t.paper }]}
          onLayout={(e) => {
            menuTop.current = e.nativeEvent.layout.y;
          }}
        >
          <View style={styles.menuInner}>
            {costume.headerLine ? (
              <Text style={[styles.headerLine, { color: t.ink, fontFamily: family }]}>
                {costume.headerLine()}
              </Text>
            ) : null}
            {voice.instruction ? (
              <Text style={[styles.instruction, { color: t.inkSoft, fontFamily: family }]}>
                {voice.instruction}
              </Text>
            ) : null}

            {sections.map(({ section, dishes }) => (
              <View
                key={section.key}
                style={styles.section}
                onLayout={(e) => {
                  sectionY.current[section.key] = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionLabel, { color: t.ink, fontFamily: family }]}>
                    {section.label}
                  </Text>
                  {section.sub ? (
                    <Text style={[styles.sectionSub, { color: t.inkSoft, fontFamily: family }]}>
                      {section.sub}
                    </Text>
                  ) : null}
                  <View style={[styles.sectionRule, { backgroundColor: t.accent }]} />
                </View>

                {dishes.map((dish) => (
                  <View
                    key={dish.id}
                    onLayout={(e) => {
                      dishY.current[dish.id] =
                        (sectionY.current[section.key] ?? 0) + e.nativeEvent.layout.y;
                    }}
                  >
                    <DishCard
                      costume={costume}
                      dish={dish}
                      family={family}
                      open={openId === dish.id}
                      inPlan={selected.has(dish.id)}
                      onOpen={() => setOpenId(openId === dish.id ? null : dish.id)}
                      onToggle={() => toggle(dish.id)}
                    />
                  </View>
                ))}
              </View>
            ))}

            <Text style={[styles.footnote, { color: t.inkSoft, fontFamily: family }]}>
              {voice.footnote}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ---- Z4 · the order bar — pinned, one thumb away ---- */}
      {chosen.length > 0 ? (
        <View style={[styles.order, { backgroundColor: t.order }]}>
          {error ? (
            <View style={[styles.scrub, { backgroundColor: t.accent }]}>
              <Text style={[styles.scrubText, { color: t.onAccent }]}>{error}</Text>
            </View>
          ) : null}
          <View style={styles.orderRow}>
            <View style={styles.orderSummary}>
              <Text style={[styles.orderCount, { color: t.onOrder, fontFamily: family }]}>
                {chosen.length} {chosen.length === 1 ? 'dish' : 'dishes'} · {plan.items.length}{' '}
                cart items
              </Text>
              {plan.sharedCount > 0 ? (
                <Text style={[styles.orderShared, { color: t.onOrder, fontFamily: family }]}>
                  {plan.sharedCount} ingredients work double shifts
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={launch}
              disabled={building}
              style={({ pressed }) => [
                styles.launch,
                { backgroundColor: t.accent, opacity: pressed || building ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.launchText, { color: t.onAccent, fontFamily: family }]}>
                {building ? voice.launching : voice.launch}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

interface DishCardProps {
  costume: KitchenCostume;
  dish: Dish;
  family?: string;
  open: boolean;
  inPlan: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function DishCard({ costume, dish, family, open, inPlan, onOpen, onToggle }: DishCardProps) {
  const { restaurant, tokens: t, voice } = costume;
  const meta = costume.dishMeta?.(dish) ?? null;

  return (
    <View style={[styles.dish, { backgroundColor: t.card }]}>
      {/* Siblings, not nested pressables — a <button> can't contain one on web. */}
      <View style={styles.dishTop}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={onOpen}
          style={({ pressed }) => [styles.dishOpen, { opacity: pressed ? 0.75 : 1 }]}
        >
          <DishTile restaurant={restaurant} dish={dish} size={56} />
          <View style={styles.dishBody}>
            <Text style={[styles.dishName, { color: t.ink }]} numberOfLines={1}>
              {dish.name}
            </Text>
            {dish.sub ? (
              <Text style={[styles.dishSub, { color: t.inkSoft, fontFamily: family }]} numberOfLines={1}>
                {dish.sub}
              </Text>
            ) : null}
            <Text style={[styles.dishDesc, { color: t.inkSoft }]} numberOfLines={open ? 0 : 1}>
              {dish.description}
            </Text>
            {meta ? (
              <Text style={[styles.dishMeta, { color: t.inkSoft, fontFamily: family }]} numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inPlan ? voice.remove : voice.add}
          accessibilityState={{ selected: inPlan }}
          onPress={onToggle}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addDot,
            inPlan
              ? { backgroundColor: t.accent, borderColor: t.accent }
              : { borderColor: t.inkSoft },
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.addDotText, { color: inPlan ? t.onAccent : t.inkSoft }]}>
            {inPlan ? '✓' : '+'}
          </Text>
        </Pressable>
      </View>

      {open ? (
        <View style={[styles.detail, { borderTopColor: t.paper }]}>
          {dish.note ? (
            <Text style={[styles.note, { color: t.ink }]}>“{dish.note}”</Text>
          ) : null}
          <View style={styles.specHead}>
            {dish.gost ? (
              <Text style={[styles.gost, { color: t.accent, fontFamily: family }]}>{dish.gost}</Text>
            ) : null}
            <Text style={[styles.specMeta, { color: t.inkSoft, fontFamily: family }]}>
              {dish.minutes} min · serves {dish.serves}
            </Text>
          </View>
          <View style={styles.specList}>
            {dish.ingredients.map((ingredient) => (
              <Text key={ingredient.name} style={[styles.specLine, { color: t.ink, fontFamily: family }]}>
                {ingredient.pantry
                  ? `— ${ingredient.name} · pantry, assumed`
                  : `— ${[ingredient.quantity, ingredient.unit, ingredient.name]
                      .filter(Boolean)
                      .join(' ')}`}
              </Text>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: inPlan }}
            onPress={onToggle}
            style={({ pressed }) => [
              styles.detailAction,
              inPlan ? { backgroundColor: t.accent, borderColor: t.accent } : { borderColor: t.accent },
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text
              style={[
                styles.detailActionText,
                { color: inPlan ? t.onAccent : t.accent, fontFamily: family },
              ]}
            >
              {inPlan ? voice.remove : voice.add}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  scrollWithOrder: { paddingBottom: 132 },

  // Z1
  hero: { minHeight: 252, overflow: 'hidden', position: 'relative' },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 18,
    maxWidth: 660,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  backSpacer: { height: 30 },
  heroTitle: { marginTop: 26 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },

  // Z2
  bar: { zIndex: 10 },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    maxWidth: 660,
    width: '100%',
    alignSelf: 'center',
  },
  barMark: { fontSize: 13, fontWeight: '900', letterSpacing: 1, flexShrink: 0 },
  chips: { flexDirection: 'row', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4.5 },
  chipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },

  // Z3
  menu: { flexGrow: 1 },
  menuInner: {
    padding: 16,
    paddingTop: 18,
    maxWidth: 660,
    width: '100%',
    alignSelf: 'center',
  },
  headerLine: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  instruction: { fontSize: 11.5, marginTop: 4 },
  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '900', letterSpacing: 1.6 },
  sectionSub: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  sectionRule: { flex: 1, height: 2.5, borderRadius: 2, marginLeft: 4 },
  footnote: { fontSize: 11, lineHeight: 16, marginTop: 26 },

  // Dish card
  dish: {
    borderRadius: 14,
    marginBottom: 9,
    boxShadow: '0px 8px 20px rgba(20, 16, 12, 0.14)',
  },
  dishTop: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  dishOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dishBody: { flex: 1, gap: 1 },
  dishName: { fontSize: 16, fontWeight: '900', letterSpacing: -0.1 },
  dishSub: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  dishDesc: { fontSize: 12, lineHeight: 16.5, marginTop: 2 },
  dishMeta: { fontSize: 10, letterSpacing: 0.6, marginTop: 3, fontWeight: '700' },
  addDot: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDotText: { fontSize: 17, fontWeight: '800', lineHeight: 20 },

  // Dish detail
  detail: { borderTopWidth: 1.5, padding: 12, paddingTop: 10, gap: 8 },
  note: { fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 13.5, lineHeight: 19 },
  specHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  gost: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  specMeta: { fontSize: 11 },
  specList: { gap: 2 },
  specLine: { fontSize: 12, lineHeight: 17 },
  detailAction: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
  },
  detailActionText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },

  // Z4
  order: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    paddingBottom: 18,
    gap: 10,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 660,
    width: '100%',
    alignSelf: 'center',
  },
  orderSummary: { flex: 1, gap: 1 },
  orderCount: { fontSize: 13, fontWeight: '800' },
  orderShared: { fontSize: 10.5, opacity: 0.75 },
  launch: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    minHeight: 48,
    justifyContent: 'center',
  },
  launchText: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.4 },
  scrub: { padding: 10, borderRadius: 8, maxWidth: 660, width: '100%', alignSelf: 'center' },
  scrubText: { fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
});
