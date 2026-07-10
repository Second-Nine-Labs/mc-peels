/**
 * «Книга» — The Book, v2. The Soviet playground for recipe construction.
 *
 * Layout borrows the proven recipe-app grammar (search + filter chips, a
 * two-column card grid with compact metadata, tap-through detail, actions at
 * the thumb) and dresses it in the poster language: constructivist motifs on
 * the deep cobalt canvas, cream paper cards, red for the Bureau's voice,
 * ochre demoted to accent duty.
 *
 * The flow is unchanged: stamp dishes В ПЛАН, the thrift solver consolidates,
 * Поехали sends structured line_items to the existing POST /carts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, getErrorMessage } from '@/lib/api';
import type { CreateCartResponse } from '@/lib/types';

import { CANON, consolidatePlan, planToLineItems, type CanonRecipe } from './canon';
import { ConstructivistBackdrop, CrestMark, QuotaMeter, SpecTag, Stamp } from './components';
import { useSovietPalette, type SovietPalette } from './palette';
import { POSTERS } from './posters';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

const LAUNCH_STAGES = [
  'Т-минус — collecting the plan…',
  'Stage one — the Bureau consolidates…',
  'Stage two — the household standard applies…',
  'Orbit — awaiting the Instacart link…',
];

const CATEGORY_LABEL: Record<CanonRecipe['category'], string> = {
  soup: 'Soup',
  main: 'Main',
  breakfast: 'Breakfast',
  salad: 'Salad',
};

const FILTERS: Array<{ key: 'all' | CanonRecipe['category']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'main', label: 'Mains' },
  { key: 'soup', label: 'Soups' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'salad', label: 'Salads' },
];

interface BookScreenBodyProps {
  /** Household to build the cart for; undefined in the signed-out preview. */
  householdId?: string;
  /** Receives the successful create response (remember + navigate). */
  onCartBuilt?: (result: CreateCartResponse) => void;
  /** Preview mode keeps the visuals live but scrubs the launch. */
  previewMode?: boolean;
}

export function BookScreenBody({ householdId, onCartBuilt, previewMode = false }: BookScreenBodyProps) {
  const p = useSovietPalette();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState(0);
  const [scrub, setScrub] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = useMemo(
    () => consolidatePlan(CANON.filter((recipe) => selected.has(recipe.id))),
    [selected],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CANON.filter((recipe) => {
      if (filter !== 'all' && recipe.category !== filter) return false;
      if (needle.length === 0) return true;
      return (
        recipe.name.toLowerCase().includes(needle) ||
        recipe.cyrillic.includes(needle) ||
        recipe.origin.toLowerCase().includes(needle) ||
        recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(needle))
      );
    });
  }, [query, filter]);

  const detail = detailId ? (CANON.find((recipe) => recipe.id === detailId) ?? null) : null;

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const toggle = (id: string) => {
    setScrub(null);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const launch = async () => {
    if (building || selected.size === 0) return;
    setScrub(null);

    if (previewMode || !householdId) {
      setScrub('The Bureau requires a signed-in comrade. Open the real tab to launch.');
      return;
    }

    setBuilding(true);
    setStage(0);
    stageTimer.current = setInterval(
      () => setStage((s) => Math.min(s + 1, LAUNCH_STAGES.length - 1)),
      1100,
    );

    try {
      const result = await api.createCart({
        household_id: householdId,
        line_items: planToLineItems(plan),
      });
      onCartBuilt?.(result);
      setSelected(new Set());
    } catch (err) {
      setScrub(`Launch scrubbed — ${getErrorMessage(err)} The Bureau will investigate.`);
    } finally {
      if (stageTimer.current) {
        clearInterval(stageTimer.current);
        stageTimer.current = null;
      }
      setBuilding(false);
    }
  };

  const dishCount = selected.size;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.canvas }]} edges={['top']}>
      <ConstructivistBackdrop />
      {POSTERS.cutoutWorker ? (
        <Image source={POSTERS.cutoutWorker} resizeMode="contain" style={styles.cutout} />
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(recipe) => recipe.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <CrestMark size={44} />
              <View style={styles.headerText}>
                <Text style={[styles.brand, { color: p.creamMuted }]}>РЕЖИМ БАБУШКИ</Text>
                <Text style={[styles.title, { color: p.cream }]}>
                  The Book <Text style={{ color: p.creamMuted }}>· книга</Text>
                </Text>
              </View>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder='Search the canon — try "beets" or "Georgian"'
              placeholderTextColor={p.creamMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.search,
                { borderColor: p.canvasLine, color: p.cream, backgroundColor: p.track },
              ]}
            />

            <View style={styles.chips}>
              {FILTERS.map((entry) => {
                const active = filter === entry.key;
                return (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(entry.key)}
                    style={[
                      styles.chip,
                      active
                        ? { backgroundColor: p.cream, borderColor: p.cream }
                        : { borderColor: p.creamMuted },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? p.ink : p.creamMuted }]}>
                      {entry.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <GridCard
            recipe={item}
            palette={p}
            selected={selected.has(item.id)}
            onOpen={() => setDetailId(item.id)}
            onToggle={() => toggle(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: p.creamMuted }]}>
            Nothing in the canon matches. The Bureau accepts proposals.
          </Text>
        }
        ListFooterComponent={
          <Text style={[styles.footnote, { color: p.creamMuted }]}>
            Recipes carry their own quantities. Your household profile is applied at build
            time; you review and pay on Instacart — the Bureau never handles money.
          </Text>
        }
      />

      {dishCount > 0 ? (
        <View style={[styles.planBar, { backgroundColor: p.canvas, borderTopColor: p.canvasLine }]}>
          {scrub ? (
            <View style={[styles.scrub, { borderColor: p.cream, backgroundColor: p.red }]}>
              <Text style={[styles.scrubText, { color: p.onRed }]}>{scrub}</Text>
            </View>
          ) : null}
          <Text style={[styles.planSummary, { color: p.cream }]}>
            {dishCount} {dishCount === 1 ? 'dish' : 'dishes'} → {plan.items.length} cart items
            {plan.pantryAssumed.length > 0 ? ` · ${plan.pantryAssumed.length} pantry staples assumed` : ''}
          </Text>
          <QuotaMeter shared={plan.sharedCount} count={plan.items.length} />
          <Pressable
            accessibilityRole="button"
            onPress={launch}
            disabled={building}
            style={({ pressed }) => [
              styles.launchBand,
              { backgroundColor: p.red, opacity: pressed || building ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.launchText, { color: p.onRed }]}>
              {building ? LAUNCH_STAGES[stage] : `Поехали — build the cart`}
            </Text>
            {!building ? <Text style={[styles.launchArrow, { color: p.onRed }]}>→</Text> : null}
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
            accessibilityLabel="Close"
            onPress={() => setDetailId(null)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23, 20, 23, 0.62)' }]}
          />
          {detail ? (
            <DetailSheet
              recipe={detail}
              palette={p}
              selected={selected.has(detail.id)}
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

interface GridCardProps {
  recipe: CanonRecipe;
  palette: SovietPalette;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

function GridCard({ recipe, palette: p, selected, onOpen, onToggle }: GridCardProps) {
  // Sibling pressables only — nesting renders nested <button>s on web.
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: p.card,
          borderColor: p.cardLine,
          transform: [{ rotate: selected ? '-0.5deg' : '0deg' }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.cardGost, { color: p.red }]}>{recipe.gost}</Text>
        <Text style={[styles.cardTitle, { color: p.ink }]} numberOfLines={2}>
          {recipe.name}
        </Text>
        <Text style={[styles.cardCyrillic, { color: p.inkSoft }]} numberOfLines={1}>
          {recipe.cyrillic} · {recipe.origin}
        </Text>
        <Text style={[styles.cardMeta, { color: p.inkSoft }]}>
          {CATEGORY_LABEL[recipe.category]} · serves {recipe.serves} ·{' '}
          {recipe.ingredients.length} ing
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.cardAction,
          selected
            ? { backgroundColor: p.red, borderColor: p.red }
            : { borderColor: p.red },
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.cardActionText, { color: selected ? p.onRed : p.red }]}>
          {selected ? 'В ПЛАНЕ ✓' : 'В ПЛАН +'}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface DetailSheetProps {
  recipe: CanonRecipe;
  palette: SovietPalette;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function DetailSheet({ recipe, palette: p, selected, onToggle, onClose }: DetailSheetProps) {
  return (
    <View style={[styles.sheet, { backgroundColor: p.card, borderColor: p.cardLine }]}>
      <View style={styles.sheetTags}>
        <SpecTag color={p.red}>{recipe.gost}</SpecTag>
        <SpecTag>{CATEGORY_LABEL[recipe.category]}</SpecTag>
        <SpecTag>{recipe.origin}</SpecTag>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={10}
          style={styles.sheetClose}
        >
          <Text style={[styles.sheetCloseText, { color: p.ink }]}>✕</Text>
        </Pressable>
      </View>

      <Text style={[styles.sheetTitle, { color: p.ink }]}>
        {recipe.name} <Text style={{ color: p.inkSoft }}>· {recipe.cyrillic}</Text>
      </Text>
      <Text style={[styles.sheetStory, { color: p.ink }]}>{recipe.story}</Text>
      <Text style={[styles.sheetNote, { color: p.inkSoft }]}>“{recipe.note}”</Text>

      <View style={[styles.sheetSpec, { borderTopColor: p.cardLine }]}>
        <Text style={[styles.sheetSpecTitle, { color: p.inkSoft }]}>
          SPEC SHEET · SERVES {recipe.serves}
        </Text>
        {recipe.ingredients.map((ingredient) => (
          <Text key={ingredient.name} style={[styles.sheetSpecLine, { color: p.ink }]}>
            {ingredient.pantry
              ? `— ${ingredient.name} · pantry, assumed`
              : `— ${[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}`}
          </Text>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.sheetAction,
          selected ? { backgroundColor: p.ink } : { backgroundColor: p.red },
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.sheetActionText, { color: p.cream }]}>
          {selected ? 'Убрать — remove from the plan' : 'В ПЛАН — add to the plan'}
        </Text>
      </Pressable>

      {selected ? (
        <Stamp label="В ПЛАН" sub="into the plan" tone="red" rotate={7} style={styles.sheetStamp} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: {
    padding: 16,
    paddingBottom: 24,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  gridRow: {
    gap: 10,
  },
  header: {
    marginBottom: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  search: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 32,
  },
  card: {
    flex: 1,
    borderWidth: 2,
    padding: 12,
    marginBottom: 10,
    gap: 8,
    justifyContent: 'space-between',
  },
  cardBody: {
    gap: 3,
  },
  cardGost: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  cardCyrillic: {
    fontSize: 12,
  },
  cardMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  cardAction: {
    borderWidth: 1.5,
    paddingVertical: 7,
    alignItems: 'center',
  },
  cardActionText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footnote: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
  },
  planBar: {
    borderTopWidth: 1.5,
    padding: 16,
    paddingBottom: 20,
    gap: 12,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  planSummary: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  launchBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  launchText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  launchArrow: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrub: {
    borderWidth: 2,
    padding: 12,
  },
  scrubText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  cutout: {
    position: 'absolute',
    top: 64,
    right: -22,
    width: 150,
    height: 230,
    transform: [{ rotate: '-5deg' }],
    pointerEvents: 'none',
  },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    borderWidth: 2,
    padding: 18,
    gap: 8,
    width: '100%',
    maxWidth: 480,
  },
  sheetTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sheetClose: {
    marginLeft: 'auto',
    paddingHorizontal: 4,
  },
  sheetCloseText: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sheetStory: {
    fontSize: 14,
    lineHeight: 20,
  },
  sheetNote: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: SERIF,
    fontStyle: 'italic',
  },
  sheetSpec: {
    borderTopWidth: 1.5,
    paddingTop: 10,
    marginTop: 6,
    gap: 3,
  },
  sheetSpecTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 3,
  },
  sheetSpecLine: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  sheetAction: {
    marginTop: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sheetActionText: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sheetStamp: {
    position: 'absolute',
    top: 12,
    right: 44,
    pointerEvents: 'none',
  },
});
