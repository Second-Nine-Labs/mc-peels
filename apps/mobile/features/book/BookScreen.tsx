/**
 * «Книга» — The Book. The Soviet playground for recipe construction.
 *
 * Twelve canon dishes as GOST spec-sheet cards on a cobalt blueprint canvas.
 * Stamp dishes В ПЛАН, watch the thrift meter, and Поехали: the selection is
 * consolidated client-side (the thrift solver v0) and sent to the existing
 * POST /carts endpoint as structured line_items — the dietary profile is
 * applied server-side like any other cart, and the hand-off reuses the
 * standard cart detail screen. Zero backend changes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, getErrorMessage } from '@/lib/api';
import type { CreateCartResponse } from '@/lib/types';

import { CANON, consolidatePlan, planToLineItems, type CanonRecipe } from './canon';
import { BlueprintGrid, CrestMark, QuotaMeter, SpecTag, Stamp } from './components';
import { useSovietPalette, type SovietPalette } from './palette';

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState(0);
  const [scrub, setScrub] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = useMemo(
    () => consolidatePlan(CANON.filter((recipe) => selected.has(recipe.id))),
    [selected],
  );

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
      <BlueprintGrid />
      <FlatList
        data={CANON}
        keyExtractor={(recipe) => recipe.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <CrestMark size={58} />
              <View style={styles.headerText}>
                <Text style={[styles.brand, { color: p.creamMuted }]}>
                  MC PEELS · РЕЖИМ БАБУШКИ
                </Text>
                <Text style={[styles.title, { color: p.cream }]}>
                  The Book <Text style={{ color: p.creamMuted }}>· книга</Text>
                </Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: p.creamMuted }]}>
              Twelve dishes of the post-Soviet table. Stamp a week В ПЛАН — the Bureau
              consolidates one thrifty cart.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SpecCard
            recipe={item}
            palette={p}
            selected={selected.has(item.id)}
            expanded={expanded === item.id}
            onToggle={() => toggle(item.id)}
            onExpand={() => setExpanded((current) => (current === item.id ? null : item.id))}
          />
        )}
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
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

interface SpecCardProps {
  recipe: CanonRecipe;
  palette: SovietPalette;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}

function SpecCard({ recipe, palette: p, selected, expanded, onToggle, onExpand }: SpecCardProps) {
  // Pressables must stay siblings — react-native-web renders them as
  // <button>, and nesting buttons is invalid HTML (hydration errors).
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: p.card,
          borderColor: p.cardLine,
          transform: [{ rotate: selected ? '-0.4deg' : '0deg' }],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onToggle}
        style={({ pressed }) => [styles.cardBody, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.cardTags}>
          <SpecTag color={p.red}>{recipe.gost}</SpecTag>
          <SpecTag>{CATEGORY_LABEL[recipe.category]}</SpecTag>
          <SpecTag>{recipe.origin}</SpecTag>
        </View>

        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: p.ink }]}>
            {recipe.name} <Text style={{ color: p.inkSoft }}>· {recipe.cyrillic}</Text>
          </Text>
        </View>

        <Text style={[styles.cardStory, { color: p.ink }]}>{recipe.story}</Text>
        <Text style={[styles.cardNote, { color: p.inkSoft }]}>“{recipe.note}”</Text>
      </Pressable>

      <View style={styles.cardFooter}>
        <Pressable onPress={onExpand} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.specLink, { color: p.ink }]}>
            {expanded ? 'Fold the spec ↑' : `Spec sheet · ${recipe.ingredients.length} ingredients ↓`}
          </Text>
        </Pressable>
        <Text style={[styles.serves, { color: p.inkSoft }]}>serves {recipe.serves}</Text>
      </View>

      {expanded ? (
        <View style={[styles.spec, { borderTopColor: p.cardLine }]}>
          {recipe.ingredients.map((ingredient) => (
            <Text key={ingredient.name} style={[styles.specLine, { color: p.ink }]}>
              {ingredient.pantry
                ? `— ${ingredient.name} · pantry, assumed`
                : `— ${[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}`}
            </Text>
          ))}
        </View>
      ) : null}

      {selected ? (
        <Stamp label="В ПЛАН" sub="into the plan" tone="red" rotate={7} style={styles.planStamp} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 8,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
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
  card: {
    borderWidth: 2,
    padding: 14,
    gap: 8,
  },
  cardBody: {
    gap: 8,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardStory: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  cardNote: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: SERIF,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  specLink: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  serves: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  spec: {
    borderTopWidth: 1.5,
    paddingTop: 8,
    gap: 3,
  },
  specLine: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  planStamp: {
    position: 'absolute',
    top: 10,
    right: 12,
  },
  footnote: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 16,
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
});
