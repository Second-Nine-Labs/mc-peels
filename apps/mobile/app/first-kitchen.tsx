import { Stack, useRouter } from 'expo-router';

import { StarterPicker } from '@/features/eats/StarterPicker';
import { useSession } from '@/lib/session';

/**
 * The starter picker as a standalone door — for households that skipped it
 * during onboarding (the Eats home nudges here until a first kitchen opens).
 * Same component as the onboarding step; only the exits differ.
 */
export default function FirstKitchenRoute() {
  const router = useRouter();
  const { membership } = useSession();

  const goHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StarterPicker
        householdId={membership?.household_id}
        onBack={goHome}
        onGoHome={goHome}
        onWalkIn={(kitchenId) => {
          router.replace('/(tabs)');
          router.push({ pathname: '/restaurant/[id]', params: { id: kitchenId } });
        }}
      />
    </>
  );
}
