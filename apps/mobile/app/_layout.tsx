import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { EnvSetupScreen } from '@/components/EnvSetupScreen';
import { LoadingView } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase';
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

    // /connect is a standalone consent page (agent-token handoff). It manages
    // its own sign-in inline and must keep its query params, so never redirect
    // into or out of it.
    if (segments[0] === 'connect') return;

    // /eats-preview is the signed-out showcase of the Eats home + restaurants:
    // static menus only, launches scrub without a session.
    if (segments[0] === 'eats-preview') return;

    // /reset-password is reached from a recovery email while signed out, and
    // establishes a short-lived recovery session of its own. Never redirect
    // into or out of it — it routes onward once the new password is saved.
    if (segments[0] === 'reset-password') return;

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

  // Without Supabase config there is no auth to run; show setup guidance
  // instead of mounting SessionProvider (which would call supabase.auth).
  if (!isSupabaseConfigured) {
    return (
      <>
        <EnvSetupScreen />
        <StatusBar style="auto" />
      </>
    );
  }

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
          <Stack.Screen name="connect" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="cart/[id]" options={{ title: 'Cart' }} />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </SessionProvider>
  );
}
