import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { LoadingView } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';

/**
 * Auth gate (task + PRD section 6):
 * - signed out            -> (auth) group
 * - signed in, no household -> onboarding
 * - signed in + household   -> (tabs)
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { session, membership, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
    } else if (!membership) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, session, membership, segments, router]);

  if (!ready) {
    return <LoadingView />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const p = usePalette();

  return (
    <SessionProvider>
      <AuthGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: p.card },
            headerTintColor: p.tint,
            headerTitleStyle: { color: p.text },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: p.background },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="cart/[id]" options={{ title: 'Cart' }} />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </SessionProvider>
  );
}
