/**
 * The Eats home — tonight, staged.
 *
 * One thing dominates: tonight's feature, a full-bleed poster wearing its
 * kitchen's whole costume (backdrop, art, voice), rotating deterministically
 * by day across the featured dishes. Under it: the kitchens as storefronts
 * (doors into worlds, not banners), then the menu builder — the block's
 * intake, where a pasted link becomes a dish and the kitchens above grow.
 * Cart-building is a different flow entirely: it lives on its own tab, and
 * the home only signposts it. Search demotes to a masthead icon.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotMark } from '@/components/MascotMark';
import { api, getErrorMessage } from '@/lib/api';
import type { SavedRecipe } from '@/lib/types';

import { DishTile } from './art';
import { costumeForShelfKitchen } from './costumes/factory';
import type { KitchenCostume } from './costume';
import { cuisineLabel, type KitchenTease } from './genesis';
import type { GeneratedIdentity } from './identity';
import { searchEats } from './restaurants';
import type { Restaurant, RestaurantId } from './types';
import { useShelfKitchens } from './useShelfKitchens';

interface HomeTokens {
  canvas: string;
  card: string;
  ink: string;
  muted: string;
  hairline: string;
  gold: string;
  onGold: string;
  /** The menu builder's gold-washed surface — the block's intake counter. */
  builderBg: string;
  builderBorder: string;
}

const light: HomeTokens = {
  canvas: '#F5F2EA',
  card: '#FFFFFF',
  ink: '#1D2433',
  muted: '#6E7686',
  hairline: '#E7E4DB',
  gold: '#FFC531',
  onGold: '#1D2433',
  builderBg: '#FBF3DC',
  builderBorder: '#EBD9A6',
};

const dark: HomeTokens = {
  canvas: '#0B1626',
  card: '#13233A',
  ink: '#EAF2FE',
  muted: '#97A6C2',
  hairline: '#243953',
  gold: '#FFC531',
  onGold: '#20180A',
  builderBg: '#221C0E',
  builderBorder: '#4A3D1C',
};

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];


/** Tonight's feature — deterministic by date, cycling the featured picks. */
function tonightIndex(count: number): number {
  if (count === 0) return 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return dayOfYear % count;
}

export interface HomeScreenProps {
  /** Household name for the greeting; omitted in the signed-out preview. */
  householdName?: string;
  /** Household id — lets the home derive shelf-born kitchens. */
  householdId?: string;
  /** Sample shelf for the signed-out showcase (no network touched). */
  previewShelf?: SavedRecipe[];
  /** Sample generated identities for the showcase (demos generated kitchens). */
  previewIdentities?: Record<string, GeneratedIdentity>;
  previewMode?: boolean;
  onOpenRestaurant: (id: RestaurantId, dishId?: string) => void;
  onOpenAsk?: () => void;
  onOpenShelf?: () => void;
  /** The starter-picker door, nudged until a first shelf kitchen exists. */
  onOpenFirstKitchen?: () => void;
}

export function HomeScreen({
  householdName,
  householdId,
  previewShelf,
  previewIdentities,
  previewMode = false,
  onOpenRestaurant,
  onOpenAsk,
  onOpenShelf,
  onOpenFirstKitchen,
}: HomeScreenProps) {
  const t = useColorScheme() === 'dark' ? dark : light;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [shelfVersion, setShelfVersion] = useState(0);
  const genesis = useShelfKitchens({
    householdId,
    previewRecipes: previewShelf,
    previewIdentities,
    refreshKey: shelfVersion,
  });
  const kitchens = useMemo(() => genesis.kitchens.map((k) => k.restaurant), [genesis.kitchens]);
  const results = useMemo(() => searchEats(query, kitchens), [query, kitchens]);

  // Tonight's feature — a dish from the household's own kitchens, rotating by
  // day. No kitchens yet → no feature; the "open your first kitchen" nudge
  // carries the home instead.
  const picks = useMemo(
    () =>
      genesis.kitchens.flatMap(({ cuisine, restaurant, identity }) =>
        restaurant.dishes.map((dish) => ({ dish, restaurant, cuisine, identity })),
      ),
    [genesis.kitchens],
  );
  const feature = picks.length > 0 ? picks[tonightIndex(picks.length)] : undefined;

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ---- Z1 · masthead — small, search demoted to a glyph ---- */}
        <View style={styles.masthead}>
          <View style={styles.brand}>
            <MascotMark size={30} />
            <View>
              <Text style={[styles.wordmark, { color: t.ink }]}>MC PEELS</Text>
              <Text style={[styles.wordmarkSub, { color: t.muted }]}>
                {householdName ? `cooking for ${householdName}` : 'the grocery concierge'}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={searching ? 'Close search' : 'Search the menus'}
            onPress={() => (searching ? closeSearch() : setSearching(true))}
            style={[styles.searchGlyph, { backgroundColor: t.card }]}
          >
            <Ionicons name={searching ? 'close' : 'search-outline'} size={17} color={t.ink} />
          </Pressable>
        </View>

        {searching ? (
          <>
            <View style={[styles.search, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <Ionicons name="search-outline" size={17} color={t.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder="Dishes, ingredients, or kitchens"
                placeholderTextColor={t.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, { color: t.ink }]}
              />
            </View>
            <SearchResults tokens={t} results={results} onOpenRestaurant={onOpenRestaurant} />
          </>
        ) : (
          <>
            {/* ---- Z2 · tonight's feature — a dish from your own kitchens,
                 dressed in that kitchen's costume ---- */}
            {feature ? (
              <FeatureHero
                costume={costumeForShelfKitchen(feature.cuisine, feature.restaurant, feature.identity)}
                restaurant={feature.restaurant}
                dishName={feature.dish.name}
                dishSub={feature.dish.sub}
                minutes={feature.dish.minutes}
                description={feature.dish.description}
                onPress={() => onOpenRestaurant(feature.restaurant.id, feature.dish.id)}
              />
            ) : null}

            {/* ---- Z4 · the kitchens — storefronts, not banners. Only the
                 ones the household has grown; nothing pre-seeded ---- */}
            {genesis.kitchens.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: t.muted }]}>YOUR KITCHENS</Text>
            ) : null}
            <View style={styles.storefronts}>
              {genesis.kitchens.map(({ cuisine, restaurant, identity }) => (
                <ShelfStorefront
                  key={restaurant.id}
                  costume={costumeForShelfKitchen(cuisine, restaurant, identity)}
                  onPress={() => onOpenRestaurant(restaurant.id)}
                />
              ))}
            </View>

            {/* ---- Z5 · the menu builder — the block's intake. Feeding lives
                 here, beside the kitchens it grows; buying lives on its own
                 tab and gets one quiet signpost below ---- */}
            <MenuBuilder
              tokens={t}
              householdId={householdId}
              previewMode={previewMode}
              teases={genesis.teases}
              hasKitchens={genesis.kitchens.length > 0}
              onSaved={() => setShelfVersion((version) => version + 1)}
              onOpenShelf={onOpenShelf}
              onOpenFirstKitchen={onOpenFirstKitchen}
            />

            {onOpenAsk ? (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenAsk}
                style={({ pressed }) => [styles.signpost, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.signpostText, { color: t.muted }]}>
                  Just need groceries? <Text style={styles.signpostStrong}>New cart</Text> builds
                  one from plain words →
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.footnote, { color: t.muted }]}>
              Menus become Instacart carts — you review and pay there. MC Peels never handles
              payment.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Z2 — tonight's feature. The kitchen's own costume dresses the box: its
// backdrop, its anchored art, its hero text colors. The home only stages it.

interface FeatureHeroProps {
  costume: KitchenCostume;
  restaurant: Restaurant;
  dishName: string;
  dishSub?: string;
  minutes: number;
  description: string;
  onPress: () => void;
}

function FeatureHero({ costume, restaurant, dishName, dishSub, minutes, description, onPress }: FeatureHeroProps) {
  const day = WEEKDAYS[new Date().getDay()];
  const { tokens } = costume;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tonight: ${dishName} at ${restaurant.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.hero, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={StyleSheet.absoluteFill}>{costume.renderHeroBackdrop()}</View>
      {costume.renderHeroArt ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {costume.renderHeroArt()}
        </View>
      ) : null}
      <View style={styles.heroInner}>
        <View style={[styles.heroDay, { borderColor: tokens.onHeroSoft }]}>
          <Text style={[styles.heroDayText, { color: tokens.onHero }]}>
            {day} · TONIGHT'S TABLE
          </Text>
        </View>
        <View style={styles.heroFoot}>
          <Text style={[styles.heroEyebrow, { color: tokens.onHeroSoft }]} numberOfLines={1}>
            {restaurant.name.toUpperCase()} · {minutes} MIN
          </Text>
          <Text
            style={[
              styles.heroDish,
              { color: tokens.onHero },
              // Long names step down instead of truncating — poster type, not ellipses.
              dishName.length > 20
                ? styles.heroDishLong
                : dishName.length > 12
                  ? styles.heroDishMid
                  : null,
            ]}
            numberOfLines={2}
          >
            {dishName}
          </Text>
          {dishSub ? (
            <Text style={[styles.heroSub, { color: tokens.onHeroSoft }]} numberOfLines={1}>
              {dishSub}
            </Text>
          ) : null}
          <Text style={[styles.heroDesc, { color: tokens.onHeroSoft }]} numberOfLines={2}>
            {description}
          </Text>
          {/* accent/onAccent is the one guaranteed-contrast pair in every costume */}
          <View style={[styles.heroCta, { backgroundColor: tokens.accent }]}>
            <Text style={[styles.heroCtaText, { color: tokens.onAccent }]}>
              Open the kitchen →
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Shelf-born kitchens: bespoke face when the costume brings one (山城),
// else a generic tokens-based front. Teases count down to opening.

function ShelfStorefront({ costume, onPress }: { costume: KitchenCostume; onPress: () => void }) {
  const { restaurant, tokens } = costume;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${restaurant.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.frontWrap,
        { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      {costume.renderStorefront ? (
        costume.renderStorefront()
      ) : (
        <View style={[styles.front, { backgroundColor: tokens.canvas }]}>
          <View style={[styles.shelfOpened, { backgroundColor: '#F2B01E' }]}>
            <Text style={styles.shelfOpenedText}>OPENED FROM YOUR SHELF</Text>
          </View>
          <Text style={[styles.frontTitleHeavy, { color: tokens.onHero }]} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={[styles.frontSub, { color: tokens.onHeroSoft }]} numberOfLines={1}>
            {restaurant.tagline}
          </Text>
          <Text style={[styles.frontMeta, { color: tokens.onHeroSoft }]}>
            {restaurant.meta.toUpperCase()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Z5 — the menu builder. Paste a link and the shelf reads it into a dish;
// the chips count each cuisine toward its opening. This zone is only ever
// about feeding the block — never about buying.

interface MenuBuilderProps {
  tokens: HomeTokens;
  householdId?: string;
  previewMode: boolean;
  teases: KitchenTease[];
  hasKitchens: boolean;
  /** A save landed — the home refetches so chips and storefronts move. */
  onSaved: () => void;
  onOpenShelf?: () => void;
  onOpenFirstKitchen?: () => void;
}

function MenuBuilder({
  tokens: t,
  householdId,
  previewMode,
  teases,
  hasKitchens,
  onSaved,
  onOpenShelf,
  onOpenFirstKitchen,
}: MenuBuilderProps) {
  const [link, setLink] = useState('');
  const [pulling, setPulling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstRun = !hasKitchens && teases.length === 0;

  const pullIn = async () => {
    const url = link.trim();
    if (url.length === 0 || pulling) return;
    setNote(null);
    setError(null);
    if (previewMode || !householdId) {
      setError('Sign in and MC Peels reads links for real — this home is a showcase.');
      return;
    }
    setPulling(true);
    try {
      const result = await api.ingestRecipe({ household_id: householdId, url });
      setLink('');
      setNote(
        result.already_saved
          ? `“${result.recipe.title}” was already on the shelf.`
          : `“${result.recipe.title}” is on the shelf — ${cuisineLabel(result.recipe.cuisine)} grows.`,
      );
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPulling(false);
    }
  };

  return (
    <View style={styles.builderWrap}>
      <Text style={[styles.sectionLabel, { color: t.muted }]}>MENU BUILDER</Text>
      <View style={[styles.builder, { backgroundColor: t.builderBg, borderColor: t.builderBorder }]}>
        <Text style={[styles.builderLead, { color: t.ink }]}>
          {firstRun
            ? 'Pick three dishes you would actually eat — thirty seconds, and your first kitchen opens.'
            : 'Feed it dishes — kitchens open themselves.'}
        </Text>

        <View style={[styles.builderField, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <Ionicons name="link-outline" size={16} color={t.muted} />
          <TextInput
            value={link}
            onChangeText={(value) => {
              setLink(value);
              setNote(null);
              setError(null);
            }}
            placeholder="Paste a TikTok, pin, or recipe link"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!pulling}
            onSubmitEditing={pullIn}
            style={[styles.builderInput, { color: t.ink }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pull the link in"
            onPress={pullIn}
            disabled={pulling || link.trim().length === 0}
            style={[
              styles.builderGo,
              { backgroundColor: t.gold, opacity: pulling || link.trim().length === 0 ? 0.45 : 1 },
            ]}
          >
            {pulling ? (
              <ActivityIndicator size="small" color={t.onGold} />
            ) : (
              <Ionicons name="arrow-down" size={15} color={t.onGold} />
            )}
          </Pressable>
        </View>

        {error ? <Text style={[styles.builderNote, { color: '#C2483B' }]}>{error}</Text> : null}
        {note ? <Text style={[styles.builderNote, { color: t.muted }]}>{note}</Text> : null}

        <View style={styles.builderChips}>
          {teases.map((tease) => (
            <Pressable
              key={tease.cuisine}
              accessibilityRole="button"
              accessibilityLabel={`${tease.label} kitchen — ${tease.needed} more ${tease.needed === 1 ? 'save' : 'saves'} to open`}
              onPress={onOpenShelf}
              disabled={!onOpenShelf}
              style={({ pressed }) => [
                styles.builderChip,
                { backgroundColor: t.gold, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.builderChipText, { color: t.onGold }]}>
                {tease.label} · {tease.saved} of {tease.saved + tease.needed}
              </Text>
            </Pressable>
          ))}
          {firstRun && onOpenFirstKitchen && !previewMode ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenFirstKitchen}
              style={({ pressed }) => [
                styles.builderChip,
                { backgroundColor: t.gold, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.builderChipText, { color: t.onGold }]}>
                open your first kitchen
              </Text>
            </Pressable>
          ) : null}
          {onOpenShelf ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOpenShelf}
              style={({ pressed }) => [
                styles.builderChipGhost,
                { borderColor: t.builderBorder, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.builderChipGhostText, { color: t.muted }]}>
                open the shelf →
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface SearchResultsProps {
  tokens: HomeTokens;
  results: ReturnType<typeof searchEats>;
  onOpenRestaurant: (id: RestaurantId, dishId?: string) => void;
}

function SearchResults({ tokens: t, results, onOpenRestaurant }: SearchResultsProps) {
  const empty = results.restaurants.length === 0 && results.dishes.length === 0;
  if (empty) {
    return (
      <Text style={[styles.emptyResult, { color: t.muted }]}>
        Nothing on any menu matches — yet. Try an ingredient (“beets”), a mood (“spicy”), or a
        kitchen by name.
      </Text>
    );
  }
  return (
    <View style={styles.results}>
      {results.restaurants.map((restaurant) => (
        <Pressable
          key={restaurant.id}
          accessibilityRole="button"
          onPress={() => onOpenRestaurant(restaurant.id)}
          style={({ pressed }) => [
            styles.resultRow,
            { backgroundColor: t.card, borderColor: t.hairline, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.resultDot, { backgroundColor: restaurant.accent }]} />
          <View style={styles.resultBody}>
            <Text style={[styles.resultName, { color: t.ink }]}>{restaurant.name}</Text>
            <Text style={[styles.resultMeta, { color: t.muted }]}>
              {restaurant.cuisine} · {restaurant.meta}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={t.muted} />
        </Pressable>
      ))}
      {results.dishes.map(({ dish, restaurant, reason }) => (
        <Pressable
          key={`${restaurant.id}:${dish.id}`}
          accessibilityRole="button"
          onPress={() => onOpenRestaurant(restaurant.id, dish.id)}
          style={({ pressed }) => [
            styles.resultRow,
            { backgroundColor: t.card, borderColor: t.hairline, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <DishTile restaurant={restaurant} dish={dish} size={38} radius={8} />
          <View style={styles.resultBody}>
            <Text style={[styles.resultName, { color: t.ink }]}>{dish.name}</Text>
            <Text style={[styles.resultMeta, { color: t.muted }]}>
              at {restaurant.name}
              {reason ? ` · ${reason}` : ''}
            </Text>
          </View>
          <View style={[styles.resultChip, { borderColor: restaurant.accent }]}>
            <Text style={[styles.resultChipText, { color: t.muted }]}>{dish.minutes} min</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },

  // Z1
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontSize: 12, fontWeight: '800', letterSpacing: 2.2 },
  wordmarkSub: { fontSize: 11, marginTop: 1 },
  searchGlyph: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 8px rgba(29, 36, 51, 0.14)',
  },

  // Z2
  hero: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 300,
    marginBottom: 22,
    boxShadow: '0px 16px 30px rgba(20, 16, 12, 0.28)',
  },
  heroInner: { flex: 1, justifyContent: 'space-between', padding: 16 },
  heroDay: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(20, 16, 12, 0.30)',
  },
  heroDayText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 2 },
  heroFoot: { marginTop: 74 },
  heroEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 2, maxWidth: '64%' },
  heroDish: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.4,
    lineHeight: 37,
    marginTop: 5,
    maxWidth: '64%',
    textTransform: 'uppercase',
  },
  heroDishMid: { fontSize: 27, lineHeight: 30 },
  heroDishLong: { fontSize: 22, lineHeight: 25 },
  heroSub: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4, marginTop: 3, maxWidth: '64%' },
  heroDesc: { fontSize: 12, lineHeight: 17, marginTop: 8, maxWidth: '68%' },
  heroCta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
  },
  heroCtaText: { fontSize: 12, fontWeight: '800' },

  // Z3
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  wall: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  wallColumn: { flex: 1, gap: 12 },
  wallMeta: { fontSize: 10.5, marginTop: 5, paddingHorizontal: 2 },

  // Z4
  storefronts: { gap: 12, marginBottom: 22 },
  frontWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0px 10px 24px rgba(29, 36, 51, 0.20)',
  },
  front: { padding: 18, minHeight: 148, justifyContent: 'flex-end', gap: 3 },
  frontStolovayaRule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#C8332B',
  },
  frontStolovayaRing: {
    position: 'absolute',
    right: -28,
    top: -34,
    width: 130,
    height: 130,
    borderRadius: 999,
    borderWidth: 22,
    borderColor: 'rgba(242, 232, 213, 0.14)',
  },
  frontGreenhouse: {
    backgroundColor: '#F1F3E8',
    borderWidth: 1,
    borderColor: '#DDE1CC',
  },
  frontTitleHeavy: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  frontMilpaTitle: {
    color: '#241430',
    textShadowColor: '#E84B8A',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  frontTitleSerif: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 28,
    color: '#4E5D43',
  },
  frontSub: { fontSize: 13, lineHeight: 18 },
  frontMeta: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: 5 },
  frontLeaf: {
    position: 'absolute',
    right: 20,
    top: 22,
    width: 30,
    height: 30,
    backgroundColor: '#7A8C6E',
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
    transform: [{ rotate: '45deg' }],
  },
  frontLeafSmall: {
    right: 54,
    top: 40,
    width: 16,
    height: 16,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 16,
    opacity: 0.55,
  },
  frontPicadoRow: {
    position: 'absolute',
    top: 0,
    left: 14,
    flexDirection: 'row',
    gap: 6,
  },
  shelfOpened: {
    position: 'absolute',
    top: 12,
    left: 18,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  shelfOpenedText: { color: '#1D2433', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },

  // Z5 — the menu builder
  builderWrap: { marginBottom: 4 },
  builder: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  builderLead: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  builderField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 44,
  },
  builderInput: { flex: 1, fontSize: 13.5, paddingVertical: 10 },
  builderGo: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderNote: { fontSize: 11.5, lineHeight: 16 },
  builderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  builderChip: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  builderChipText: { fontSize: 11.5, fontWeight: '800' },
  builderChipGhost: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  builderChipGhostText: { fontSize: 11.5, fontWeight: '700' },

  signpost: { alignSelf: 'center', marginTop: 18, paddingVertical: 4, paddingHorizontal: 8 },
  signpostText: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  signpostStrong: { fontWeight: '800' },
  footnote: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 10 },

  // Search
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  results: { gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultDot: { width: 10, height: 10, borderRadius: 5 },
  resultBody: { flex: 1, gap: 1 },
  resultName: { fontSize: 14.5, fontWeight: '700' },
  resultMeta: { fontSize: 12, lineHeight: 16 },
  resultChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  resultChipText: { fontSize: 10.5, fontWeight: '700' },
  emptyResult: { fontSize: 13.5, lineHeight: 19, paddingVertical: 12 },
});
