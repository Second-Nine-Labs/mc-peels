import { Stack, useRouter } from 'expo-router';

import { ShelfScreen } from '@/features/shelf/ShelfScreen';
import { rememberCartResult } from '@/lib/cart-cache';
import { useSession } from '@/lib/session';

/**
 * The shelf's doorway. Cart hand-off matches the restaurants: remember the
 * resolved items, land on the standard cart detail for the Instacart link.
 */
export default function ShelfRoute() {
  const router = useRouter();
  const { membership } = useSession();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ShelfScreen
        householdId={membership?.household_id}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        onCartBuilt={(result) => {
          rememberCartResult(result);
          router.push({ pathname: '/cart/[id]', params: { id: result.cart_id } });
        }}
      />
    </>
  );
}
