import { useRouter } from 'expo-router';

import { HomeScreen } from '@/features/eats/HomeScreen';
import { useSession } from '@/lib/session';

/** The front door: browse the restaurants or hop to the Ask flow. */
export default function HomeTab() {
  const router = useRouter();
  const { membership } = useSession();

  return (
    <HomeScreen
      householdName={membership?.household.name}
      onOpenRestaurant={(id, dishId) =>
        router.push({ pathname: '/restaurant/[id]', params: { id, ...(dishId ? { dish: dishId } : {}) } })
      }
      onOpenAsk={() => router.push('/(tabs)/ask')}
      onOpenShelf={() => router.push('/shelf')}
    />
  );
}
