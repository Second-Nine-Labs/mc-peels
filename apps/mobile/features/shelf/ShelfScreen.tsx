/**
 * The shelf — where sent links become dishes.
 *
 * Paste (or later: share) a TikTok, pin, reel, or recipe URL; the API reads
 * what the link honestly yields, extracts one cartable recipe, and it lands
 * here grouped by cuisine. Every save is instantly orderable: selection flows
 * through the Book's thrift solver into POST /carts, exactly like a
 * restaurant menu — because a saved recipe IS a menu of one.
 *
 * Honesty carries through the UI: dishes rebuilt from thin sources wear a
 * REBUILT tag, extraction notes are shown, and cuisine sections count toward
 * the day a kitchen opens on the block.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisplayTitle, EyebrowChip } from '@/components/ui';
import type { Dish } from '@/features/eats/types';
import { usePlan } from '@/features/eats/usePlan';
import { api, getErrorMessage } from '@/lib/api';
import type { CreateCartResponse, SavedRecipe } from '@/lib/types';
import { usePalette, type Palette } from '@/lib/theme';
import { useScrollBottomInset } from '@/lib/use-scroll-bottom-inset';

const KITCHEN_THRESHOLD = 8;

const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italian',
  mexican: 'Mexican',
  indian: 'Indian',
  'sichuan-chongqing': 'Sichuan & Chongqing',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  mediterranean: 'Mediterranean',
  'middle-eastern': 'Middle Eastern',
  french: 'French',
  'american-comfort': 'American comfort',
  'southern-bbq': 'Southern & BBQ',
  latin: 'Latin American',
  caribbean: 'Caribbean',
  african: 'African',
  'post-soviet': 'Post-Soviet',
  breakfast: 'Breakfast',
  'baking-dessert': 'Baking & dessert',
  other: 'Uncharted',
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  web: 'the open web',
};

function cuisineLabel(cuisine: string): string {
  return CUISINE_LABELS[cuisine] ?? cuisine;
}

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

/** A saved recipe is a menu of one — this makes it speak the Dish contract
 * so the thrift solver and cart launch treat it like any restaurant dish. */
function recipeToDish(recipe: SavedRecipe): Dish {
  return {
    id: recipe.id,
    name: recipe.title,
    sub: recipe.sub ?? undefined,
    description: recipe.description ?? '',
    section: recipe.cuisine,
    tags: [recipe.cuisine, recipe.dish_type],
    serves: recipe.serves,
    minutes: recipe.minutes,
    heat: (recipe.heat ?? undefined) as Dish['heat'],
    ingredients: recipe.ingredients.map((ingredient) => ({
      name: ingredient.name,
      ...(ingredient.quantity !== null ? { quantity: ingredient.quantity } : {}),
      ...(ingredient.unit !== null ? { unit: ingredient.unit } : {}),
      ...(ingredient.pantry ? { pantry: true } : {}),
    })),
  };
}

export interface ShelfScreenProps {
  /** Household to read/save/build for; undefined in the signed-out preview. */
  householdId?: string;
  /** Preview keeps the shelf browsable but scrubs saves and launches. */
  previewMode?: boolean;
  onBack?: () => void;
  onCartBuilt?: (result: CreateCartResponse) => void;
}

export function ShelfScreen({
  householdId,
  previewMode = false,
  onBack,
  onCartBuilt,
}: ShelfScreenProps) {
  const p = usePalette();
  const bottomInset = useScrollBottomInset();

  const [recipes, setRecipes] = useState<SavedRecipe[] | null>(previewMode ? SAMPLE_RECIPES : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullNote, setPullNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewMode) return;
    if (!householdId) {
      setRecipes([]);
      return;
    }
    setLoadError(null);
    try {
      const listing = await api.listRecipes({ household_id: householdId });
      setRecipes(listing.recipes);
    } catch (err) {
      setLoadError(getErrorMessage(err));
      setRecipes((previous) => previous ?? []);
    }
  }, [householdId, previewMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const dishes = useMemo(() => (recipes ?? []).map(recipeToDish), [recipes]);
  const plan = usePlan({
    dishes,
    householdId,
    previewMode,
    signedOutMessage: 'Sign in and the shelf builds real carts — this one is a showcase.',
    onCartBuilt,
  });

  const sections = useMemo(() => {
    const byCuisine = new Map<string, SavedRecipe[]>();
    for (const recipe of recipes ?? []) {
      const list = byCuisine.get(recipe.cuisine) ?? [];
      list.push(recipe);
      byCuisine.set(recipe.cuisine, list);
    }
    return [...byCuisine.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
  }, [recipes]);

  const pullIn = async () => {
    const url = link.trim();
    setPullError(null);
    setPullNote(null);
    if (url.length === 0) return;
    if (previewMode || !householdId) {
      setPullError(
        previewMode
          ? 'Sign in and MC Peels pulls recipes in for real — this shelf is a showcase.'
          : 'Set up your household first — the shelf saves per household.',
      );
      return;
    }
    setPulling(true);
    try {
      const result = await api.ingestRecipe({ household_id: householdId, url });
      setLink('');
      if (result.already_saved) {
        setPullNote(`“${result.recipe.title}” was already on the shelf.`);
      } else {
        setRecipes((previous) => [result.recipe, ...(previous ?? [])]);
        const firstNote = result.recipe.notes[0];
        setPullNote(
          `“${result.recipe.title}” is on the shelf${firstNote ? ` — ${firstNote.toLowerCase().replace(/\.$/, '')}` : ''}.`,
        );
      }
      setExpanded((previous) => new Set(previous).add(result.recipe.id));
    } catch (err) {
      setPullError(getErrorMessage(err));
    } finally {
      setPulling(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setConfirmingDelete(null);
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const removeRecipe = async (recipe: SavedRecipe) => {
    if (previewMode || !householdId) {
      setPullError('The showcase shelf keeps its dishes. Sign in to curate your own.');
      setConfirmingDelete(null);
      return;
    }
    if (confirmingDelete !== recipe.id) {
      setConfirmingDelete(recipe.id);
      return;
    }
    setConfirmingDelete(null);
    try {
      await api.deleteRecipe(recipe.id);
      setRecipes((previous) => (previous ?? []).filter((r) => r.id !== recipe.id));
    } catch (err) {
      setPullError(getErrorMessage(err));
    }
  };

  const openSource = (recipe: SavedRecipe) => {
    void Linking.openURL(recipe.source_url).catch(() => {
      setPullError('That link would not open here — it is still saved on the recipe.');
    });
  };

  const loading = recipes === null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              hitSlop={10}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={22} color={p.onBg} />
            </Pressable>
          ) : null}
          <EyebrowChip label="Send a link, get a dish" surface="brand" />
          <DisplayTitle text="Menu builder" emphasis="builder" size={34} />
          <Text style={[styles.subtitle, { color: p.onBgMuted }]}>
            the shelf of dishes you sent us — enough of one cuisine and its kitchen opens
          </Text>
        </View>

        <View style={[styles.pastePanel, { backgroundColor: p.card }]}>
          <View style={styles.pasteRow}>
            <Ionicons name="link-outline" size={18} color={p.textMuted} />
            <TextInput
              value={link}
              onChangeText={(value) => {
                setLink(value);
                setPullError(null);
                setPullNote(null);
              }}
              placeholder="Paste a TikTok, pin, reel, or recipe link"
              placeholderTextColor={p.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={Platform.OS === 'ios' ? 'url' : 'default'}
              editable={!pulling}
              onSubmitEditing={pullIn}
              style={[styles.pasteInput, { color: p.text }]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={pullIn}
            disabled={pulling || link.trim().length === 0}
            style={({ pressed }) => [
              styles.pullButton,
              {
                backgroundColor: p.accent,
                opacity: pulling || link.trim().length === 0 ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {pulling ? (
              <>
                <ActivityIndicator size="small" color={p.onAccent} />
                <Text style={[styles.pullButtonText, { color: p.onAccent }]}>Reading the recipe…</Text>
              </>
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color={p.onAccent} />
                <Text style={[styles.pullButtonText, { color: p.onAccent }]}>Pull it in</Text>
              </>
            )}
          </Pressable>
          {pullError ? <Text style={[styles.pullError, { color: p.danger }]}>{pullError}</Text> : null}
          {pullNote ? <Text style={[styles.pullNote, { color: p.textMuted }]}>{pullNote}</Text> : null}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={p.onBg} />
          </View>
        ) : loadError ? (
          <View style={[styles.notice, { backgroundColor: p.card }]}>
            <Text style={[styles.noticeText, { color: p.textMuted }]}>{loadError}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()}>
              <Text style={[styles.noticeAction, { color: p.text }]}>Try again</Text>
            </Pressable>
          </View>
        ) : sections.length === 0 ? (
          <View style={[styles.notice, { backgroundColor: p.card }]}>
            <Text style={[styles.noticeTitle, { color: p.text }]}>Nothing on the shelf yet</Text>
            <Text style={[styles.noticeText, { color: p.textMuted }]}>
              Send MC Peels a TikTok, a pin, or any recipe link and it becomes a dish here —
              ingredients ready to cart. Save enough of one cuisine and a kitchen opens on the
              block.
            </Text>
            <Text style={[styles.noticeFootnote, { color: p.textMuted }]}>
              Instagram links often arrive with the caption locked; those dishes get rebuilt and
              say so.
            </Text>
          </View>
        ) : (
          sections.map(([cuisine, list]) => (
            <View key={cuisine} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: p.onBg }]}>
                  {cuisineLabel(cuisine).toUpperCase()}
                </Text>
                <Text style={[styles.sectionProgress, { color: p.onBgMuted }]}>
                  {list.length >= KITCHEN_THRESHOLD
                    ? `${list.length} saved · enough to open a kitchen — soon`
                    : `${list.length} saved · ${KITCHEN_THRESHOLD - list.length} more and a kitchen opens`}
                </Text>
              </View>
              {list.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  palette={p}
                  recipe={recipe}
                  selected={plan.selected.has(recipe.id)}
                  expanded={expanded.has(recipe.id)}
                  confirmingDelete={confirmingDelete === recipe.id}
                  onToggleSelect={() => plan.toggle(recipe.id)}
                  onToggleExpand={() => toggleExpanded(recipe.id)}
                  onOpenSource={() => openSource(recipe)}
                  onDelete={() => void removeRecipe(recipe)}
                />
              ))}
            </View>
          ))
        )}

        <View style={styles.scrollFoot} />
      </ScrollView>

      {plan.chosen.length > 0 ? (
        <View style={[styles.launchBand, { backgroundColor: p.card }]}>
          <View style={styles.launchMeta}>
            <Text style={[styles.launchCount, { color: p.text }]}>
              {plan.chosen.length} {plan.chosen.length === 1 ? 'dish' : 'dishes'} ·{' '}
              {plan.plan.items.length} items
            </Text>
            <Text style={[styles.launchShared, { color: p.textMuted }]}>
              {plan.plan.sharedCount > 0
                ? `${plan.plan.sharedCount} shared ${plan.plan.sharedCount === 1 ? 'worker' : 'workers'} across dishes`
                : 'no overlap — every item pulls one shift'}
            </Text>
            {plan.error ? <Text style={[styles.launchError, { color: p.danger }]}>{plan.error}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void plan.launch()}
            disabled={plan.building}
            style={({ pressed }) => [
              styles.launchButton,
              { backgroundColor: p.accent, opacity: plan.building ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {plan.building ? (
              <ActivityIndicator size="small" color={p.onAccent} />
            ) : (
              <Text style={[styles.launchButtonText, { color: p.onAccent }]}>Build the cart</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

interface RecipeRowProps {
  palette: Palette;
  recipe: SavedRecipe;
  selected: boolean;
  expanded: boolean;
  confirmingDelete: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onOpenSource: () => void;
  onDelete: () => void;
}

function RecipeRow({
  palette: p,
  recipe,
  selected,
  expanded,
  confirmingDelete,
  onToggleSelect,
  onToggleExpand,
  onOpenSource,
  onDelete,
}: RecipeRowProps) {
  const shopping = recipe.ingredients.filter((ingredient) => !ingredient.pantry);
  const pantry = recipe.ingredients.filter((ingredient) => ingredient.pantry);

  return (
    <View style={[styles.row, { backgroundColor: p.card }]}>
      <View style={styles.rowMain}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Select ${recipe.title}`}
          onPress={onToggleSelect}
          hitSlop={8}
          style={[
            styles.selectDot,
            { borderColor: selected ? p.accent : p.border, backgroundColor: selected ? p.accent : 'transparent' },
          ]}
        >
          {selected ? <Ionicons name="checkmark" size={14} color={p.onAccent} /> : null}
        </Pressable>

        <Pressable accessibilityRole="button" onPress={onToggleExpand} style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
            <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
              {recipe.title}
            </Text>
            {recipe.sub ? (
              <Text style={[styles.rowSub, { color: p.textMuted }]} numberOfLines={1}>
                {recipe.sub}
              </Text>
            ) : null}
          </View>
          <View style={styles.rowMetaLine}>
            <Text style={[styles.rowMeta, { color: p.textMuted }]} numberOfLines={1}>
              serves {recipe.serves} · {recipe.minutes} min
              {recipe.heat !== null && recipe.heat > 0 ? ` · ${'◆'.repeat(recipe.heat)}` : ''} · via{' '}
              {platformLabel(recipe.source_platform)}
              {recipe.creator ? ` · ${recipe.creator}` : ''}
            </Text>
            {recipe.provenance === 'reconstructed' ? (
              <View style={[styles.rebuiltPill, { borderColor: p.border }]}>
                <Text style={[styles.rebuiltPillText, { color: p.textMuted }]}>REBUILT</Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Details" onPress={onToggleExpand} hitSlop={8}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={p.textMuted} />
        </Pressable>
      </View>

      {expanded ? (
        <View style={[styles.detail, { borderTopColor: p.border }]}>
          {recipe.description ? (
            <Text style={[styles.detailDescription, { color: p.text }]}>{recipe.description}</Text>
          ) : null}
          {recipe.notes.length > 0 ? (
            <Text style={[styles.detailNotes, { color: p.textMuted }]}>{recipe.notes.join(' ')}</Text>
          ) : null}

          <Text style={[styles.detailLabel, { color: p.textMuted }]}>INGREDIENTS</Text>
          {shopping.map((ingredient, index) => (
            <View key={`${ingredient.name}-${index}`} style={styles.ingredientLine}>
              <Text style={[styles.ingredientName, { color: p.text }]}>{ingredient.name}</Text>
              <Text style={[styles.ingredientQty, { color: p.textMuted }]}>
                {ingredient.quantity !== null
                  ? `${ingredient.quantity}${ingredient.unit ? ` ${ingredient.unit}` : ''}`
                  : 'to taste at the store'}
              </Text>
            </View>
          ))}
          {pantry.length > 0 ? (
            <Text style={[styles.pantryLine, { color: p.textMuted }]}>
              assumed on hand: {pantry.map((ingredient) => ingredient.name).join(', ')}
            </Text>
          ) : null}

          {recipe.steps.length > 0 ? (
            <>
              <Text style={[styles.detailLabel, { color: p.textMuted }]}>THE MOVES</Text>
              {recipe.steps.map((step, index) => (
                <View key={index} style={styles.stepLine}>
                  <Text style={[styles.stepNumber, { color: p.textMuted }]}>{index + 1}</Text>
                  <Text style={[styles.stepText, { color: p.text }]}>{step}</Text>
                </View>
              ))}
            </>
          ) : null}

          <View style={styles.detailActions}>
            <Pressable accessibilityRole="button" onPress={onOpenSource} style={styles.detailAction}>
              <Ionicons name="open-outline" size={14} color={p.textMuted} />
              <Text style={[styles.detailActionText, { color: p.textMuted }]}>Open the original</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDelete} style={styles.detailAction}>
              <Ionicons name="trash-outline" size={14} color={confirmingDelete ? p.danger : p.textMuted} />
              <Text
                style={[styles.detailActionText, { color: confirmingDelete ? p.danger : p.textMuted }]}
              >
                {confirmingDelete ? 'Tap again to remove' : 'Off the shelf'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The showcase shelf — what the signed-out preview browses. Doubles as a
// picture of where this feature goes: cravings clustering toward kitchens.

const SAMPLE_RECIPES: SavedRecipe[] = [
  {
    art_url: null,
    art_status: 'none',
    id: 'sample-xiaomian',
    household_id: 'preview',
    source_url: 'https://www.tiktok.com/@mala.queen/video/1',
    source_platform: 'tiktok',
    creator: 'mala.queen',
    title: 'Chongqing xiaomian',
    sub: '重庆小面',
    description: 'The alley noodle — chili oil, numbing tingle, ten-minute ritual.',
    cuisine: 'sichuan-chongqing',
    dish_type: 'main',
    serves: 2,
    minutes: 20,
    heat: 3,
    ingredients: [
      { name: 'fresh alkaline wheat noodles', quantity: 1, unit: 'lb', pantry: false },
      { name: 'chili crisp', quantity: 1, unit: 'jar', pantry: false },
      { name: 'sichuan peppercorns', quantity: null, unit: null, pantry: true },
      { name: 'baby bok choy', quantity: 1, unit: 'lb', pantry: false },
      { name: 'green onions', quantity: 1, unit: 'bunch', pantry: false },
      { name: 'roasted peanuts', quantity: 1, unit: 'each', pantry: false },
    ],
    steps: [
      'Build the sauce in the bowl: chili crisp, ground peppercorns, soy, a ladle of noodle water.',
      'Boil noodles with the bok choy riding on top.',
      'Everything into the bowl; peanuts and scallions over.',
    ],
    provenance: 'transcribed',
    confidence: 'high',
    notes: [],
    created_at: '2026-07-10T00:00:00.000Z',
  },
  {
    art_url: null,
    art_status: 'none',
    id: 'sample-laziji',
    household_id: 'preview',
    source_url: 'https://www.tiktok.com/@mala.queen/video/2',
    source_platform: 'tiktok',
    creator: 'mala.queen',
    title: 'Chongqing chicken',
    sub: '辣子鸡',
    description: 'Crisp chicken hiding in a mountain of toasted chiles.',
    cuisine: 'sichuan-chongqing',
    dish_type: 'main',
    serves: 4,
    minutes: 45,
    heat: 3,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 1.5, unit: 'lb', pantry: false },
      { name: 'dried red chiles', quantity: 4, unit: 'oz', pantry: false },
      { name: 'sichuan peppercorns', quantity: null, unit: null, pantry: true },
      { name: 'garlic', quantity: 1, unit: 'head', pantry: false },
      { name: 'fresh ginger', quantity: 1, unit: 'each', pantry: false },
    ],
    steps: [
      'Cube, marinate, and double-fry the chicken until deeply crisp.',
      'Toast the chiles and peppercorns; the kitchen should make you cough a little.',
      'Toss hard, thirty seconds, out.',
    ],
    provenance: 'transcribed',
    confidence: 'high',
    notes: [],
    created_at: '2026-07-09T00:00:00.000Z',
  },
  {
    art_url: null,
    art_status: 'none',
    id: 'sample-butter-chicken',
    household_id: 'preview',
    source_url: 'https://www.pinterest.com/pin/sample-butter-chicken',
    source_platform: 'pinterest',
    creator: 'The Curry Files',
    title: 'Butter chicken',
    sub: 'murgh makhani',
    description: 'The gateway gravy — charred thighs in tomato silk.',
    cuisine: 'indian',
    dish_type: 'main',
    serves: 4,
    minutes: 60,
    heat: 1,
    ingredients: [
      { name: 'boneless chicken thighs', quantity: 2, unit: 'lb', pantry: false },
      { name: 'plain whole milk yogurt', quantity: 1, unit: 'each', pantry: false },
      { name: 'garam masala', quantity: null, unit: null, pantry: true },
      { name: 'crushed tomatoes', quantity: 1, unit: 'can', pantry: false },
      { name: 'heavy cream', quantity: 1, unit: 'each', pantry: false },
      { name: 'butter', quantity: 1, unit: 'each', pantry: false },
      { name: 'basmati rice', quantity: 2, unit: 'lb', pantry: false },
    ],
    steps: [
      'Marinate the chicken in yogurt and spices; char it hard under the broiler.',
      'Simmer tomatoes, butter, and cream into silk.',
      'Marry them. Rice underneath. Silence at the table.',
    ],
    provenance: 'transcribed',
    confidence: 'high',
    notes: [],
    created_at: '2026-07-08T00:00:00.000Z',
  },
  {
    art_url: null,
    art_status: 'none',
    id: 'sample-mcmuffin',
    household_id: 'preview',
    source_url: 'https://www.instagram.com/reel/sample-breakfast',
    source_platform: 'instagram',
    creator: null,
    title: 'Breakfast sandwich, golden-arches style',
    sub: null,
    description: 'The round egg, the griddled muffin, the cheese at the exact melt point.',
    cuisine: 'breakfast',
    dish_type: 'breakfast',
    serves: 4,
    minutes: 15,
    heat: null,
    ingredients: [
      { name: 'english muffins', quantity: 1, unit: 'pack', pantry: false },
      { name: 'large eggs', quantity: 1, unit: 'dozen', pantry: false },
      { name: 'canadian bacon', quantity: 1, unit: 'pack', pantry: false },
      { name: 'american cheese slices', quantity: 1, unit: 'pack', pantry: false },
      { name: 'butter', quantity: 1, unit: 'each', pantry: false },
    ],
    steps: [
      'Griddle the muffins in butter — this is the whole secret.',
      'Cook eggs in a ring (a mason jar lid works) until just set.',
      'Stack: muffin, cheese, egg, bacon, muffin. Wrap in paper if you want the full effect.',
    ],
    provenance: 'reconstructed',
    confidence: 'medium',
    notes: ['Instagram kept the caption behind the login wall; the dish was rebuilt and flagged.'],
    created_at: '2026-07-07T00:00:00.000Z',
  },
  {
    art_url: null,
    art_status: 'none',
    id: 'sample-hoagie',
    household_id: 'preview',
    source_url: 'https://blog.example/italian-hoagie',
    source_platform: 'web',
    creator: 'Corner Deli Papers',
    title: 'Italian hoagie',
    sub: null,
    description: 'Salami, capicola, provolone — dressed in oil, vinegar, and oregano.',
    cuisine: 'italian',
    dish_type: 'main',
    serves: 4,
    minutes: 15,
    heat: null,
    ingredients: [
      { name: 'french bread', quantity: 2, unit: 'each', pantry: false },
      { name: 'genoa salami', quantity: 0.5, unit: 'lb', pantry: false },
      { name: 'capicola', quantity: 0.5, unit: 'lb', pantry: false },
      { name: 'sliced provolone', quantity: 0.5, unit: 'lb', pantry: false },
      { name: 'shredded lettuce', quantity: 1, unit: 'each', pantry: false },
      { name: 'tomatoes', quantity: 1, unit: 'lb', pantry: false },
      { name: 'red onion', quantity: 1, unit: 'each', pantry: false },
      { name: 'red wine vinegar', quantity: null, unit: null, pantry: true },
      { name: 'dried oregano', quantity: null, unit: null, pantry: true },
    ],
    steps: [
      'Split the bread; layer meats and cheese with intent.',
      'Lettuce, tomato, onion; oil and vinegar until it glistens.',
      'Oregano like you mean it. Press gently. Six minutes, freaky fresh.',
    ],
    provenance: 'transcribed',
    confidence: 'high',
    notes: [],
    created_at: '2026-07-06T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  scrollFoot: { height: 96 },
  header: { marginBottom: 22, gap: 12 },
  backButton: { alignSelf: 'flex-start' },
  subtitle: { fontSize: 14, lineHeight: 20 },

  pastePanel: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 20,
    boxShadow: '0px 12px 26px rgba(21, 34, 56, 0.10)',
  },
  pasteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pasteInput: { flex: 1, fontSize: 14.5, paddingVertical: 6 },
  pullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 11,
  },
  pullButtonText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  pullError: { fontSize: 12.5, lineHeight: 17 },
  pullNote: { fontSize: 12.5, lineHeight: 17 },

  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  notice: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    boxShadow: '0px 12px 26px rgba(21, 34, 56, 0.10)',
  },
  noticeTitle: { fontSize: 15.5, fontWeight: '800' },
  noticeText: { fontSize: 13.5, lineHeight: 19 },
  noticeFootnote: { fontSize: 12, lineHeight: 16 },
  noticeAction: { fontSize: 13.5, fontWeight: '700', marginTop: 2 },

  section: { marginBottom: 18 },
  sectionHeader: { marginBottom: 8, gap: 2 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  sectionProgress: { fontSize: 12 },

  row: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    boxShadow: '0px 8px 18px rgba(21, 34, 56, 0.08)',
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  selectDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 3 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  rowTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  rowSub: { fontSize: 12.5 },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMeta: { fontSize: 12, flexShrink: 1 },
  rebuiltPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  rebuiltPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  detail: { borderTopWidth: 1, padding: 12, gap: 6 },
  detailDescription: { fontSize: 13.5, lineHeight: 19 },
  detailNotes: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
  detailLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 8 },
  ingredientLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  ingredientName: { fontSize: 13.5, flexShrink: 1 },
  ingredientQty: { fontSize: 13 },
  pantryLine: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  stepLine: { flexDirection: 'row', gap: 8, marginTop: 2 },
  stepNumber: { fontSize: 12.5, fontWeight: '800', width: 16, textAlign: 'right' },
  stepText: { fontSize: 13.5, lineHeight: 19, flex: 1 },
  detailActions: { flexDirection: 'row', gap: 18, marginTop: 10 },
  detailAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailActionText: { fontSize: 12.5, fontWeight: '600' },

  launchBand: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0px -6px 24px rgba(6, 25, 46, 0.18)',
  },
  launchMeta: { flex: 1, gap: 1 },
  launchCount: { fontSize: 14, fontWeight: '800' },
  launchShared: { fontSize: 12 },
  launchError: { fontSize: 12, marginTop: 2 },
  launchButton: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  launchButtonText: { fontSize: 14, fontWeight: '800' },
});
