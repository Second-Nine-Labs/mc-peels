/**
 * The Eats home — tonight, staged.
 *
 * One thing dominates: tonight's feature, a full-bleed poster wearing its
 * kitchen's whole costume (backdrop, art, voice), rotating deterministically
 * by day across the featured dishes. Under it: the rest of tonight's picks
 * as an art rail, the kitchens as storefronts (doors into worlds, not
 * banners), and one quiet concierge strip for Ask + the Shelf. Search
 * demotes to a masthead icon — a ~30-dish catalog doesn't earn a hero pill.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
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

import { DishTile, PosterCard } from './art';
import { KITCHEN_COSTUMES } from './costumes';
import { FEATURED_PICKS, RESTAURANTS, searchEats } from './restaurants';
import type { Restaurant, RestaurantId } from './types';

interface HomeTokens {
  canvas: string;
  card: string;
  ink: string;
  muted: string;
  hairline: string;
  gold: string;
  onGold: string;
  strip: string;
  onStrip: string;
  onStripMuted: string;
}

const light: HomeTokens = {
  canvas: '#F5F2EA',
  card: '#FFFFFF',
  ink: '#1D2433',
  muted: '#6E7686',
  hairline: '#E7E4DB',
  gold: '#FFC531',
  onGold: '#1D2433',
  strip: '#1D2433',
  onStrip: '#EAF2FE',
  onStripMuted: '#97A6C2',
};

const dark: HomeTokens = {
  canvas: '#0B1626',
  card: '#13233A',
  ink: '#EAF2FE',
  muted: '#97A6C2',
  hairline: '#243953',
  gold: '#FFC531',
  onGold: '#20180A',
  strip: '#13233A',
  onStrip: '#EAF2FE',
  onStripMuted: '#97A6C2',
};

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Pinboard rhythm — tall next to short, cycling so columns stay uneven. */
const WALL_HEIGHTS = [196, 168, 182, 204, 172, 190];

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
  previewMode?: boolean;
  onOpenRestaurant: (id: RestaurantId, dishId?: string) => void;
  onOpenAsk?: () => void;
  onOpenShelf?: () => void;
}

export function HomeScreen({
  householdName,
  previewMode = false,
  onOpenRestaurant,
  onOpenAsk,
  onOpenShelf,
}: HomeScreenProps) {
  const t = useColorScheme() === 'dark' ? dark : light;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchEats(query), [query]);

  const feature = FEATURED_PICKS[tonightIndex(FEATURED_PICKS.length)];
  const railPicks = FEATURED_PICKS.filter((pick) => pick.dish.id !== feature?.dish.id);

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
            {/* ---- Z2 · tonight's feature — the whole thesis ---- */}
            {feature ? (
              <FeatureHero
                restaurant={feature.restaurant}
                dishName={feature.dish.name}
                dishSub={feature.dish.sub}
                minutes={feature.dish.minutes}
                description={feature.dish.description}
                onPress={() => onOpenRestaurant(feature.restaurant.id, feature.dish.id)}
              />
            ) : null}

            {/* ---- Z3 · the poster wall — every pick is a tiny poster,
                 tall-next-to-short like a pinboard, each in its kitchen's
                 own template (ration card / seed packet / lotería card) ---- */}
            {railPicks.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: t.muted }]}>MORE FOR TONIGHT</Text>
                <View style={styles.wall}>
                  {[0, 1].map((column) => (
                    <View key={column} style={styles.wallColumn}>
                      {railPicks
                        .filter((_, index) => index % 2 === column)
                        .map(({ dish, restaurant }, rowIndex) => (
                          <Pressable
                            key={dish.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${dish.name} at ${restaurant.name}`}
                            onPress={() => onOpenRestaurant(restaurant.id, dish.id)}
                            style={({ pressed }) => [
                              { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                            ]}
                          >
                            <PosterCard
                              restaurant={restaurant}
                              dish={dish}
                              height={WALL_HEIGHTS[(column + rowIndex * 2) % WALL_HEIGHTS.length]}
                            />
                            <Text style={[styles.wallMeta, { color: t.muted }]} numberOfLines={1}>
                              {restaurant.name} · {dish.minutes} min
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* ---- Z4 · the kitchens — storefronts, not banners ---- */}
            <Text style={[styles.sectionLabel, { color: t.muted }]}>THE KITCHENS</Text>
            <View style={styles.storefronts}>
              {RESTAURANTS.map((restaurant) => (
                <Storefront
                  key={restaurant.id}
                  restaurant={restaurant}
                  onPress={() => onOpenRestaurant(restaurant.id)}
                />
              ))}
            </View>

            {/* ---- Z5 · the concierge strip — the superpower, stated once ---- */}
            <View style={[styles.strip, { backgroundColor: t.strip }]}>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenAsk}
                disabled={!onOpenAsk}
                style={({ pressed }) => [styles.stripMain, { opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[styles.stripDot, { backgroundColor: t.gold }]}>
                  <Ionicons name="sparkles" size={14} color={t.onGold} />
                </View>
                <View style={styles.stripBody}>
                  <Text style={[styles.stripTitle, { color: t.onStrip }]}>
                    Or just tell MC Peels
                  </Text>
                  <Text style={[styles.stripText, { color: t.onStripMuted }]} numberOfLines={2}>
                    {previewMode
                      ? 'Plain-language carts live on the Ask tab of the real app.'
                      : 'Say it in plain words — the cart builds with your household rules.'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onOpenShelf}
                disabled={!onOpenShelf}
                style={({ pressed }) => [
                  styles.stripShelf,
                  { borderColor: t.onStripMuted, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={[styles.stripShelfText, { color: t.onStrip }]}>the shelf →</Text>
              </Pressable>
            </View>

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
  restaurant: Restaurant;
  dishName: string;
  dishSub?: string;
  minutes: number;
  description: string;
  onPress: () => void;
}

function FeatureHero({ restaurant, dishName, dishSub, minutes, description, onPress }: FeatureHeroProps) {
  const costume = KITCHEN_COSTUMES[restaurant.id];
  const day = WEEKDAYS[new Date().getDay()];
  if (!costume) return null;
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
// Z4 — storefronts. Each kitchen's face at full volume on neutral ground;
// brand islands, not app surfaces (they keep their colors in both themes).

function Storefront({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  const body =
    restaurant.id === 'stolovaya-7' ? (
      <View style={[styles.front, { backgroundColor: '#2E509F' }]}>
        <View style={styles.frontStolovayaRule} />
        <View style={styles.frontStolovayaRing} />
        <Text style={[styles.frontTitleHeavy, { color: '#F2E8D5' }]}>СТОЛОВАЯ № 7</Text>
        <Text style={[styles.frontSub, { color: 'rgba(242, 232, 213, 0.8)' }]}>
          Canteen No. 7 — {restaurant.cuisine.toLowerCase()}
        </Text>
        <Text style={[styles.frontMeta, { color: 'rgba(242, 232, 213, 0.65)' }]}>
          {restaurant.meta.toUpperCase()}
        </Text>
      </View>
    ) : restaurant.id === 'greenhouse' ? (
      <View style={[styles.front, styles.frontGreenhouse]}>
        <Text style={styles.frontTitleSerif}>greenhouse</Text>
        <Text style={[styles.frontSub, { color: '#7C8074' }]}>{restaurant.tagline}</Text>
        <Text style={[styles.frontMeta, { color: '#4E5D43' }]}>
          {restaurant.meta.toUpperCase()}
        </Text>
        <View style={styles.frontLeaf} />
        <View style={[styles.frontLeaf, styles.frontLeafSmall]} />
      </View>
    ) : (
      <View style={[styles.front, { backgroundColor: '#F2A007' }]}>
        <View style={styles.frontPicadoRow}>
          {['#E84B8A', '#159F94', '#FBF3E4', '#8A4FD0', '#E84B8A', '#159F94', '#FBF3E4', '#8A4FD0'].map(
            (color, index) => (
              <View
                key={index}
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 9,
                  borderRightWidth: 9,
                  borderTopWidth: 14,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: color,
                }}
              />
            ),
          )}
        </View>
        <Text style={[styles.frontTitleHeavy, styles.frontMilpaTitle]}>LA MILPA</Text>
        <Text style={[styles.frontSub, { color: '#241430' }]}>
          {restaurant.sub} — {restaurant.cuisine.toLowerCase()}
        </Text>
        <Text style={[styles.frontMeta, { color: 'rgba(36, 20, 48, 0.7)' }]}>
          {restaurant.meta.toUpperCase()}
        </Text>
      </View>
    );

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
      {body}
    </Pressable>
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

  // Z5
  strip: {
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stripMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stripDot: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripBody: { flex: 1, gap: 1 },
  stripTitle: { fontSize: 13, fontWeight: '800' },
  stripText: { fontSize: 11, lineHeight: 15 },
  stripShelf: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  stripShelfText: { fontSize: 11.5, fontWeight: '700' },
  footnote: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 20 },

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
