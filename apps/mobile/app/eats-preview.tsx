import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeScreen } from '@/features/eats/HomeScreen';
import { KitchenScreen } from '@/features/eats/KitchenScreen';
import { KITCHEN_COSTUMES } from '@/features/eats/costumes';
import type { RestaurantId } from '@/features/eats/types';
import { ShelfScreen } from '@/features/shelf/ShelfScreen';

/**
 * Signed-out showcase of the Eats experience — the auth gate exempts this
 * segment (same deal as /book-preview). Static menus only: navigation stays
 * inside the preview and every launch scrubs without a session, so nothing
 * here can read or write household data.
 */

type View_ = 'home' | 'shelf' | RestaurantId;

const STOPS: Array<{ key: View_; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'stolovaya-7', label: '№ 7' },
  { key: 'greenhouse', label: 'greenhouse' },
  { key: 'la-milpa', label: 'La Milpa' },
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
                <Text style={[styles.stopText, active && styles.stopTextActive]}>
                  {stop.label}
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.badge}>PREVIEW</Text>
        </ScrollView>
      </View>

      {view === 'home' ? (
        <HomeScreen previewMode onOpenRestaurant={open} onOpenShelf={() => open('shelf')} />
      ) : view === 'shelf' ? (
        <ShelfScreen previewMode onBack={home} />
      ) : (
        <KitchenScreen
          costume={KITCHEN_COSTUMES[view]}
          previewMode
          initialDishId={dishId}
          onBack={home}
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
