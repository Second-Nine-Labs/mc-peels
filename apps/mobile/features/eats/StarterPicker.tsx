/**
 * The starter picker — onboarding's last step, and the app's first lesson.
 *
 * Pick three dishes you'd actually eat; three of one cuisine opens that
 * kitchen on the spot. The picker teaches the loop while you tap ("one more
 * Indian pick and the kitchen opens"), and the mint moment names the rule
 * that governs everything after: four saves of one cuisine opens the next
 * kitchen. Two thresholds on purpose — the first kitchen is a gift, the rest
 * are earned.
 *
 * Picks become real shelf recipes (POST /recipes/starters), so the gifted
 * kitchen rides the same genesis rails as every kitchen after it. Wears the
 * design-system costume (brand blue), not an Eats one: this screen belongs
 * to onboarding, and the kitchens it opens do the dressing up.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BananaRain } from '@/components/BananaRain';
import { Button, DisplayTitle, ErrorBanner, EyebrowChip, LoadingView } from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { usePalette } from '@/lib/theme';
import { useScrollBottomInset } from '@/lib/use-scroll-bottom-inset';
import type { StarterDishWire } from '@/lib/types';

import { STARTER_OPEN_THRESHOLD, cuisineLabel, kitchenIdForCuisine } from './genesis';

const HEAT_GLYPH = '◆';

export interface StarterPickerProps {
  /** Household to seed; undefined only in the signed-out preview. */
  householdId?: string;
  /** Preview keeps picking live but scrubs the seed; mint is a demo. */
  previewMode?: boolean;
  /** Preview surfaces inject a sample catalog; no network is touched. */
  previewStarters?: StarterDishWire[];
  /** Route into the freshly opened kitchen (host owns navigation). */
  onWalkIn: (kitchenId: string) => void;
  /** Land on the home tabs without the kitchen detour. */
  onGoHome: () => void;
  /** Rendered as a ghost "Skip for now" when present (onboarding). */
  onSkip?: () => void;
  /** Rendered as a back chevron when present (the /first-kitchen route). */
  onBack?: () => void;
}

interface MintedKitchen {
  cuisine: string;
  label: string;
  kitchenId: string;
}

export function StarterPicker({
  householdId,
  previewMode = false,
  previewStarters,
  onWalkIn,
  onGoHome,
  onSkip,
  onBack,
}: StarterPickerProps) {
  const p = usePalette();
  const bottomInset = useScrollBottomInset();

  const [starters, setStarters] = useState<StarterDishWire[] | null>(previewStarters ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<MintedKitchen | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const load = () => {
    if (previewStarters) return;
    setLoadError(null);
    api
      .getStarters()
      .then((data) => setStarters(data.starters))
      .catch((err) => {
        setLoadError(getErrorMessage(err));
        setStarters((previous) => previous ?? []);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  /** Catalog order is curation order — group by cuisine, first-seen wins. */
  const groups = useMemo(() => {
    const byCuisine = new Map<string, StarterDishWire[]>();
    for (const dish of starters ?? []) {
      const list = byCuisine.get(dish.cuisine) ?? [];
      list.push(dish);
      byCuisine.set(dish.cuisine, list);
    }
    return [...byCuisine.entries()];
  }, [starters]);

  /** Pick counts per cuisine — the live lesson. */
  const counts = useMemo(() => {
    const byId = new Map((starters ?? []).map((dish) => [dish.id, dish]));
    const tally = new Map<string, number>();
    for (const id of picked) {
      const dish = byId.get(id);
      if (!dish) continue;
      tally.set(dish.cuisine, (tally.get(dish.cuisine) ?? 0) + 1);
    }
    return tally;
  }, [picked, starters]);

  const best = useMemo(() => {
    let leader: { cuisine: string; count: number } | null = null;
    for (const [cuisine, count] of counts) {
      if (!leader || count > leader.count) leader = { cuisine, count };
    }
    return leader;
  }, [counts]);

  const armed = (best?.count ?? 0) >= STARTER_OPEN_THRESHOLD;

  const teaching = (() => {
    if (!best) return 'Anything that looks like dinner works — the kitchen figures itself out.';
    const label = cuisineLabel(best.cuisine);
    const remaining = STARTER_OPEN_THRESHOLD - best.count;
    if (remaining === 2) return `Two more ${label} picks and that kitchen opens tonight.`;
    if (remaining === 1) return `One more ${label} pick — the sign is being painted.`;
    if (remaining <= 0) return `The ${label} kitchen is ready. Open the doors.`;
    return `Two more ${label} picks and that kitchen opens tonight.`;
  })();

  const toggle = (id: string) => {
    setError(null);
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const submit = async () => {
    if (seeding || picked.size === 0) return;
    setError(null);

    const opened = armed && best ? best.cuisine : null;

    if (previewMode || !householdId) {
      if (opened) {
        // Demo the payoff; the seed itself is scrubbed without a session.
        setMinted({
          cuisine: opened,
          label: cuisineLabel(opened),
          kitchenId: kitchenIdForCuisine(opened),
        });
        setBurstKey((key) => key + 1);
      } else {
        setError('Sign in and the picks become real dishes — this is the showcase.');
      }
      return;
    }

    setSeeding(true);
    try {
      await api.seedStarters({ household_id: householdId, starter_ids: [...picked] });
      if (opened) {
        setMinted({
          cuisine: opened,
          label: cuisineLabel(opened),
          kitchenId: kitchenIdForCuisine(opened),
        });
        setBurstKey((key) => key + 1);
      } else {
        // Scattered picks: no kitchen yet, but the home's teases take over
        // the teaching from here.
        onGoHome();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  if (starters === null) {
    return <LoadingView message="Setting out the starter menu…" />;
  }

  if (minted) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
        <BananaRain burstKey={burstKey} />
        <View style={styles.mintWrap}>
          <EyebrowChip label="Grand opening" surface="brand" />
          <DisplayTitle
            text={`The ${minted.label} kitchen is open`}
            emphasis="open"
            size={30}
            style={styles.mintTitle}
          />
          <Text style={[styles.mintCopy, { color: p.onBgMuted }]}>
            That was the whole trick — feed MC Peels dishes and kitchens happen. From here it
            takes four saves of one cuisine: paste TikToks, pins, or any recipe link onto the
            shelf, and when a cuisine hits four, its doors open. Every dish carts through your
            household rules.
          </Text>
          <Text style={[styles.mintCopy, styles.mintCopyTight, { color: p.onBgMuted }]}>
            The more you feed it, the more kitchens appear — and the smarter your carts get.
          </Text>
          <Button
            title="Walk in"
            onPress={() => onWalkIn(minted.kitchenId)}
            style={styles.mintButton}
          />
          <Button title="Take me home" variant="ghost" onPress={onGoHome} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset }]}>
        <View style={styles.hero}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={p.onBg} />
            </Pressable>
          ) : null}
          <EyebrowChip label="Your first kitchen" surface="brand" />
          <DisplayTitle text="Stock your first kitchen" emphasis="kitchen" size={32} style={styles.heroTitle} />
          <Text style={[styles.subtitle, { color: p.onBgMuted }]}>
            Pick three dishes you would actually eat. Three from one cuisine opens that kitchen
            tonight — shopping list included.
          </Text>
        </View>

        <ErrorBanner message={error ?? loadError} />
        {loadError ? (
          <Button title="Try again" variant="secondary" onPress={load} style={styles.retry} />
        ) : null}

        {groups.map(([cuisine, dishes]) => {
          const count = counts.get(cuisine) ?? 0;
          return (
            <View key={cuisine} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupLabel, { color: p.onBg }]}>{cuisineLabel(cuisine)}</Text>
                <Text
                  style={[
                    styles.groupProgress,
                    { color: count >= STARTER_OPEN_THRESHOLD ? p.accent : p.onBgMuted },
                  ]}
                >
                  {count > 0
                    ? count >= STARTER_OPEN_THRESHOLD
                      ? 'opens tonight'
                      : `${count} of ${STARTER_OPEN_THRESHOLD}`
                    : ''}
                </Text>
              </View>
              <View style={styles.grid}>
                {dishes.map((dish) => {
                  const selected = picked.has(dish.id);
                  return (
                    <Pressable
                      key={dish.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`Pick ${dish.title}`}
                      onPress={() => toggle(dish.id)}
                      style={[
                        styles.tile,
                        {
                          backgroundColor: p.card,
                          borderColor: selected ? p.tint : p.border,
                          borderWidth: selected ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.tileTop}>
                        <Text style={[styles.tileTitle, { color: p.text }]} numberOfLines={2}>
                          {dish.title}
                        </Text>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={selected ? p.tint : p.border}
                        />
                      </View>
                      {dish.sub ? (
                        <Text style={[styles.tileSub, { color: p.textMuted }]} numberOfLines={1}>
                          {dish.sub}
                        </Text>
                      ) : null}
                      <Text style={[styles.tileMeta, { color: p.textMuted }]} numberOfLines={1}>
                        {dish.minutes} min · serves {dish.serves}
                        {dish.heat !== null && dish.heat > 0 ? (
                          <Text style={{ color: '#D85A30' }}>
                            {' '}
                            {HEAT_GLYPH.repeat(Math.min(dish.heat, 3))}
                          </Text>
                        ) : null}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.footer}>
          <Text style={[styles.teaching, { color: p.onBgMuted }]}>{teaching}</Text>
          <Button
            title={
              armed && best
                ? `Open the ${cuisineLabel(best.cuisine)} kitchen`
                : picked.size > 0
                  ? 'Save picks and head in'
                  : `Pick ${STARTER_OPEN_THRESHOLD} dishes`
            }
            variant={armed ? 'accent' : 'primary'}
            onPress={submit}
            loading={seeding}
            disabled={picked.size === 0}
          />
          {onSkip ? (
            <Button title="Skip for now" variant="ghost" onPress={onSkip} disabled={seeding} style={styles.skip} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    padding: 24,
    paddingBottom: 48,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { gap: 12, marginBottom: 20 },
  back: { alignSelf: 'flex-start', marginBottom: 4, marginLeft: -6 },
  heroTitle: { marginTop: 2 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  retry: { marginBottom: 16 },

  group: { marginBottom: 22 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupLabel: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  groupProgress: { fontSize: 12.5, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tileTitle: { fontSize: 14.5, fontWeight: '700', flex: 1, lineHeight: 19 },
  tileSub: { fontSize: 12.5 },
  tileMeta: { fontSize: 12 },

  footer: { marginTop: 6, gap: 12 },
  teaching: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  skip: { marginTop: -4 },

  mintWrap: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  mintTitle: { marginTop: 10 },
  mintCopy: { fontSize: 14.5, lineHeight: 21, marginTop: 12 },
  mintCopyTight: { marginTop: 8, marginBottom: 18 },
  mintButton: { marginBottom: 8 },
});
