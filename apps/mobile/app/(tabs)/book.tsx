import { useRouter } from 'expo-router';

import { BookScreenBody } from '@/features/book/BookScreen';
import { rememberCartResult } from '@/lib/cart-cache';
import { useSession } from '@/lib/session';

export default function BookScreen() {
  const router = useRouter();
  const { membership } = useSession();

  return (
    <BookScreenBody
      householdId={membership?.household_id}
      onCartBuilt={(result) => {
        // Same hand-off as the Ask flow: remember the resolved items + notes,
        // then land on the standard cart detail screen for the Instacart link.
        rememberCartResult(result);
        router.push({ pathname: '/cart/[id]', params: { id: result.cart_id } });
      }}
    />
  );
}
