/**
 * The Eats home — MC Peels' front door, redrawn calm.
 *
 * The loud brand-blue canvas steps back to warm paper; the banana keeps its
 * job as the mark, not the wallpaper. One search field covers every menu —
 * dish names, ingredients, tags, restaurant names — and results say *why*
 * they matched. Below it: tonight's picks across kitchens, then the three
 * restaurants as brand cards, each wearing its own face. The Ask flow stays
 * one tap away; this screen is the browse path, not a replacement for it.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Platform,
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

import { FEATURED_PICKS, RESTAURANTS, searchEats } from './restaurants';
import type { Restaurant, RestaurantId } from './types';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

interface HomeTokens {
  canvas: string;
  card: string;
  ink: string;
  muted: string;
  hairline: string;
  gold: string;
  onGold: string;
}

const light: HomeTokens = {
  canvas: '#F7F5F0',
  card: '#FFFFFF',
  ink: '#1D2433',
  muted: '#6E7686',
  hairline: '#E7E4DB',
  gold: '#FFC531',
  onGold: '#1D2433',
};

const dark: HomeTokens = {
  canvas: '#0B1626',
  card: '#13233A',
  ink: '#EAF2FE',
  muted: '#97A6C2',
  hairline: '#243953',
  gold: '#FFC531',
  onGold: '#20180A',
};

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
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchEats(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.canvas }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.masthead}>
          <MascotMark size={34} />
          <View>
            <Text style={[styles.wordmark, { color: t.ink }]}>MC PEELS</Text>
            <Text style={[styles.wordmarkSub, { color: t.muted }]}>
              {householdName ? `cooking for ${householdName}` : 'the grocery concierge'}
            </Text>
          </View>
        </View>

        <Text style={[styles.greeting, { color: t.ink }]}>
          <Text style={{ fontWeight: '300' }}>What sounds </Text>
          <Text style={{ fontWeight: '800' }}>good tonight?</Text>
        </Text>

        <View style={[styles.search, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <Ionicons name="search-outline" size={18} color={t.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search dishes, ingredients, or restaurants"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: t.ink }]}
          />
          {searching ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.muted} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          <SearchResults
            tokens={t}
            results={results}
            onOpenRestaurant={onOpenRestaurant}
          />
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: t.muted }]}>TONIGHT'S PICKS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              style={styles.railWrap}
            >
              {FEATURED_PICKS.map(({ dish, restaurant }) => (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  onPress={() => onOpenRestaurant(restaurant.id, dish.id)}
                  style={({ pressed }) => [
                    styles.pick,
                    { backgroundColor: t.card, borderColor: t.hairline, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  {/* Typographic tile until dish photography lands. */}
                  <View style={[styles.pickTile, { backgroundColor: restaurant.accent }]}>
                    <Text style={[styles.pickInitial, { color: restaurant.onAccent }]}>
                      {dish.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.pickName, { color: t.ink }]} numberOfLines={2}>
                    {dish.name}
                  </Text>
                  <Text style={[styles.pickMeta, { color: t.muted }]} numberOfLines={1}>
                    {restaurant.name} · {dish.minutes} min
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.sectionLabel, { color: t.muted }]}>RESTAURANTS</Text>
            <View style={styles.restaurants}>
              {RESTAURANTS.map((restaurant) => (
                <BrandCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  onPress={() => onOpenRestaurant(restaurant.id)}
                />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onOpenShelf}
              disabled={!onOpenShelf}
              style={({ pressed }) => [
                styles.askCard,
                { backgroundColor: t.card, borderColor: t.hairline, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.askBadge, { backgroundColor: t.gold }]}>
                <Ionicons name="download-outline" size={18} color={t.onGold} />
              </View>
              <View style={styles.askBody}>
                <Text style={[styles.askTitle, { color: t.ink }]}>The shelf</Text>
                <Text style={[styles.askText, { color: t.muted }]}>
                  {previewMode
                    ? 'Send MC Peels a TikTok, a pin, or any recipe link — it becomes a dish you can cart.'
                    : 'Paste a TikTok, a pin, or any recipe link — it becomes a dish you can cart. Enough of one cuisine and a kitchen opens.'}
                </Text>
              </View>
              {onOpenShelf ? (
                <Ionicons name="chevron-forward" size={18} color={t.muted} />
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onOpenAsk}
              disabled={!onOpenAsk}
              style={({ pressed }) => [
                styles.askCard,
                { backgroundColor: t.card, borderColor: t.hairline, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.askBadge, { backgroundColor: t.gold }]}>
                <Ionicons name="sparkles" size={18} color={t.onGold} />
              </View>
              <View style={styles.askBody}>
                <Text style={[styles.askTitle, { color: t.ink }]}>Or just say it</Text>
                <Text style={[styles.askText, { color: t.muted }]}>
                  {previewMode
                    ? 'Plain-language carts live on the Ask tab of the real app.'
                    : 'Type a request in plain language — we build the cart with your household rules.'}
                </Text>
              </View>
              {onOpenAsk ? (
                <Ionicons name="chevron-forward" size={18} color={t.muted} />
              ) : null}
            </Pressable>

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
          <View style={styles.resultBody}>
            <Text style={[styles.resultName, { color: t.ink }]}>{dish.name}</Text>
            <Text style={[styles.resultMeta, { color: t.muted }]}>
              at {restaurant.name}
              {reason ? ` · ${reason}` : ''}
            </Text>
          </View>
          <View style={[styles.resultChip, { borderColor: restaurant.accent }]}>
            <Text style={[styles.resultChipText, { color: t.muted }]}>
              {dish.minutes} min
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Brand cards — each restaurant's face on neutral ground. These keep their
// own colors in both themes; they are brand islands, not app surfaces.

function BrandCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  const body =
    restaurant.id === 'stolovaya-7' ? (
      <View style={[styles.brand, { backgroundColor: '#2E509F' }]}>
        <View style={styles.brandStolovayaRule} />
        <Text style={[styles.brandTitleHeavy, { color: '#F2E8D5' }]}>СТОЛОВАЯ № 7</Text>
        <Text style={[styles.brandSub, { color: 'rgba(242, 232, 213, 0.8)' }]}>
          Canteen No. 7 — {restaurant.cuisine.toLowerCase()}
        </Text>
        <Text style={[styles.brandMeta, { color: 'rgba(242, 232, 213, 0.65)' }]}>
          {restaurant.meta.toUpperCase()}
        </Text>
      </View>
    ) : restaurant.id === 'greenhouse' ? (
      <View style={[styles.brand, styles.brandGreenhouse]}>
        <Text style={styles.brandTitleSerif}>greenhouse</Text>
        <Text style={[styles.brandSub, { color: '#7C8074' }]}>{restaurant.tagline}</Text>
        <Text style={[styles.brandMeta, { color: '#4E5D43' }]}>
          {restaurant.meta.toUpperCase()}
        </Text>
        <View style={styles.brandLeaf} />
      </View>
    ) : (
      <View style={[styles.brand, { backgroundColor: '#F2A007' }]}>
        <View style={styles.brandPicadoRow}>
          {['#E84B8A', '#159F94', '#FBF3E4', '#8A4FD0', '#E84B8A', '#159F94'].map(
            (color, index) => (
              <View
                key={index}
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 8,
                  borderRightWidth: 8,
                  borderTopWidth: 13,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: color,
                }}
              />
            ),
          )}
        </View>
        <Text style={[styles.brandTitleHeavy, styles.brandMilpaTitle]}>LA MILPA</Text>
        <Text style={[styles.brandSub, { color: '#241430' }]}>
          {restaurant.sub} — {restaurant.cuisine.toLowerCase()}
        </Text>
        <Text style={[styles.brandMeta, { color: 'rgba(36, 20, 48, 0.7)' }]}>
          {restaurant.meta.toUpperCase()}
        </Text>
      </View>
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${restaurant.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.brandWrap, { opacity: pressed ? 0.85 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    padding: 20,
    paddingBottom: 32,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  wordmarkSub: {
    fontSize: 12,
    marginTop: 1,
  },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 16,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 50,
    marginBottom: 22,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  railWrap: {
    marginHorizontal: -20,
    marginBottom: 24,
  },
  rail: {
    paddingHorizontal: 20,
    gap: 10,
  },
  pick: {
    width: 152,
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    gap: 6,
  },
  pickTile: {
    height: 88,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickInitial: {
    fontSize: 40,
    fontWeight: '900',
    opacity: 0.9,
  },
  pickName: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 17,
    paddingHorizontal: 2,
  },
  pickMeta: {
    fontSize: 11,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  restaurants: {
    gap: 12,
    marginBottom: 24,
  },
  brandWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  brand: {
    padding: 18,
    minHeight: 118,
    justifyContent: 'center',
    gap: 3,
  },
  brandStolovayaRule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: '#C8332B',
  },
  brandGreenhouse: {
    backgroundColor: '#F1F3E8',
    borderWidth: 1,
    borderColor: '#DDE1CC',
    borderRadius: 20,
  },
  brandTitleHeavy: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandMilpaTitle: {
    color: '#241430',
    textShadowColor: '#E84B8A',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  brandTitleSerif: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 26,
    color: '#4E5D43',
  },
  brandSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  brandMeta: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 5,
  },
  brandLeaf: {
    position: 'absolute',
    right: 20,
    top: 24,
    width: 26,
    height: 26,
    backgroundColor: '#7A8C6E',
    borderTopLeftRadius: 26,
    borderBottomRightRadius: 26,
    transform: [{ rotate: '45deg' }],
  },
  brandPicadoRow: {
    position: 'absolute',
    top: 0,
    left: 12,
    flexDirection: 'row',
    gap: 5,
  },
  askCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  askBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBody: {
    flex: 1,
    gap: 2,
  },
  askTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  askText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 24,
  },
  results: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  resultBody: {
    flex: 1,
    gap: 1,
  },
  resultName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  resultMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  resultChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resultChipText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  emptyResult: {
    fontSize: 13.5,
    lineHeight: 19,
    paddingVertical: 12,
  },
});
