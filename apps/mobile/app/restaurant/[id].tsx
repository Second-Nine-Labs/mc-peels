import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { GreenhouseScreen } from '@/features/eats/GreenhouseScreen';
import { LaMilpaScreen } from '@/features/eats/LaMilpaScreen';
import { StolovayaScreen } from '@/features/eats/StolovayaScreen';
import type { RestaurantScreenProps } from '@/features/eats/types';
import { rememberCartResult } from '@/lib/cart-cache';
import { useSession } from '@/lib/session';

/**
 * The doorway to a restaurant. Each id maps to its own fully-costumed screen;
 * the shared contract (household, deep-linked dish, cart hand-off) is wired
 * here once. Cart hand-off matches the Ask and Book flows: remember the
 * resolved items, land on the standard cart detail for the Instacart link.
 */
const SCREENS: Record<string, (props: RestaurantScreenProps) => React.JSX.Element> = {
  'stolovaya-7': StolovayaScreen,
  greenhouse: GreenhouseScreen,
  'la-milpa': LaMilpaScreen,
};

export default function RestaurantRoute() {
  const { id, dish } = useLocalSearchParams<{ id: string; dish?: string }>();
  const router = useRouter();
  const { membership } = useSession();

  const Screen = id ? SCREENS[id] : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {Screen ? (
        <Screen
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
