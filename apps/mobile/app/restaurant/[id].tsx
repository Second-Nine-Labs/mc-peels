import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { KitchenScreen } from '@/features/eats/KitchenScreen';
import { KITCHEN_COSTUMES } from '@/features/eats/costumes';
import { rememberCartResult } from '@/lib/cart-cache';
import { useSession } from '@/lib/session';

/**
 * The doorway to a restaurant. Every kitchen renders through the shared
 * KitchenScreen chassis wearing its costume from the rack; the shared
 * contract (household, deep-linked dish, cart hand-off) is wired here once.
 * Cart hand-off matches the Ask and Book flows: remember the resolved
 * items, land on the standard cart detail for the Instacart link.
 */
export default function RestaurantRoute() {
  const { id, dish } = useLocalSearchParams<{ id: string; dish?: string }>();
  const router = useRouter();
  const { membership } = useSession();

  const costume = id ? KITCHEN_COSTUMES[id] : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {costume ? (
        <KitchenScreen
          costume={costume}
          householdId={membership?.household_id}
          initialDishId={dish}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          onCartBuilt={(result) => {
            rememberCartResult(result);
            router.push({ pathname: '/cart/[id]', params: { id: result.cart_id } });
          }}
        />
      ) : (
        <View style={styles.missing}>
          <Text style={styles.missingText}>This kitchen isn't on the block yet.</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
