import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeScreen } from '@/features/eats/HomeScreen';
import { KitchenScreen } from '@/features/eats/KitchenScreen';
import type { KitchenCostume } from '@/features/eats/costume';
import { costumeForShelfKitchen } from '@/features/eats/costumes/factory';
import { deriveGenesis } from '@/features/eats/genesis';
import { PREVIEW_IDENTITIES } from '@/features/eats/preview-identities';
import { PREVIEW_SHELF } from '@/features/eats/preview-shelf';
import { PREVIEW_STARTERS } from '@/features/eats/preview-starters';
import { StarterPicker } from '@/features/eats/StarterPicker';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';

/** The showcase's minted kitchens, grown from the sample shelf: 山城 (a
 * hand-built flagship) and บ้านริมน้ำ (a *generated* Thai identity — bespoke
 * palette + voice + procedural hero). Nothing here is pre-built; this is what
 * the household grows on its own. */
const PREVIEW_COSTUMES: Record<string, KitchenCostume> = {};
for (const kitchen of deriveGenesis(PREVIEW_SHELF, PREVIEW_IDENTITIES).kitchens) {
  PREVIEW_COSTUMES[kitchen.restaurant.id] = costumeForShelfKitchen(
    kitchen.cuisine,
    kitchen.restaurant,
    kitchen.identity,
  );
}

/**
 * Signed-out showcase of the Eats experience (auth-gate exempt). No pre-built
 * restaurants — the home grows from a sample shelf, so the showcase demos a
 * flagship kitchen (山城), a generated one (บ้านริมน้ำ), and the "open your
 * first kitchen" starter flow. Every launch scrubs without a session; nothing
 * here reads or writes household data.
 */
type View_ = string;

const STOPS: Array<{ key: View_; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'shelf-sichuan-chongqing', label: '山城' },
  { key: 'shelf-thai', label: 'บ้านริมน้ำ' },
  { key: 'first-kitchen', label: 'first kitchen' },
  { key: 'shelf', label: 'the shelf' },
];

export default function EatsPreviewScreen() {
  const [view, setView] = useState<View_>('home');
  const [dishId, setDishId] = useState<string | undefined>(undefined);

  const open = (id: View_, dish?: string) => {
    setDishId(dish);
    setView(id);
  };
  const home = () => {
    setDishId(undefined);
    setView('home');
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.switcher}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.switcherRow}>
          {STOPS.map((stop) => {
            const active = view === stop.key;
            return (
              <Pressable
                key={stop.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => (stop.key === 'home' ? home() : open(stop.key))}
                style={[styles.stop, active && styles.stopActive]}
              >
                <Text style={[styles.stopText, active && styles.stopTextActive]}>{stop.label}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.badge}>PREVIEW</Text>
        </ScrollView>
      </View>

      {view === 'home' ? (
        <HomeScreen
          previewMode
          previewShelf={PREVIEW_SHELF}
          previewIdentities={PREVIEW_IDENTITIES}
          onOpenRestaurant={open}
          onOpenShelf={() => open('shelf')}
          onOpenFirstKitchen={() => open('first-kitchen')}
        />
      ) : view === 'shelf' ? (
        <ShelfScreen previewMode onBack={home} />
      ) : view === 'first-kitchen' ? (
        <StarterPicker
          previewMode
          previewStarters={PREVIEW_STARTERS}
          onBack={home}
          onGoHome={home}
          onWalkIn={(kitchenId) => open(kitchenId ?? 'home')}
        />
      ) : PREVIEW_COSTUMES[view] ? (
        <KitchenScreen costume={PREVIEW_COSTUMES[view]} previewMode initialDishId={dishId} onBack={home} />
      ) : (
        <HomeScreen
          previewMode
          previewShelf={PREVIEW_SHELF}
          previewIdentities={PREVIEW_IDENTITIES}
          onOpenRestaurant={open}
          onOpenShelf={() => open('shelf')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1626' },
  switcher: {
    backgroundColor: '#0B1626',
    borderBottomWidth: 1,
    borderBottomColor: '#243953',
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stop: {
    borderWidth: 1,
    borderColor: '#243953',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stopActive: {
    backgroundColor: '#EAF2FE',
    borderColor: '#EAF2FE',
  },
  stopText: {
    color: '#97A6C2',
    fontSize: 12.5,
    fontWeight: '700',
  },
  stopTextActive: {
    color: '#0B1626',
  },
  badge: {
    color: '#97A6C2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginLeft: 4,
  },
});
