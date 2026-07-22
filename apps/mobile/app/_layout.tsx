import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';

import { EnvSetupScreen } from '@/components/EnvSetupScreen';
import { LoadingView } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ThemeProvider, usePalette, useThemeMode } from '@/lib/theme';

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

    // On web the router hydrates asynchronously and useSegments() is [] until
    // it does. Redirecting on "location unknown" is how exempted routes got
    // bounced (observed live: /welcome → /onboarding for a signed-in member
    // with a warm cache — every standalone route below had the same latent
    // race). The effect re-fires once segments populate; wait for it. The
    // cast exists because the typed route tuple claims length ≥ 1 — untrue
    // mid-hydration.
    if ((segments as string[]).length === 0) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    // /connect is a standalone consent page (agent-token handoff). It manages
    // its own sign-in inline and must keep its query params, so never redirect
    // into or out of it.
    if (segments[0] === 'connect') return;

    // /oauth/authorize is the same consent UX for the OAuth code flow — same
    // rules: inline sign-in, query params are load-bearing.
    if (segments[0] === 'oauth') return;

    // /auth/handoff signs the browser in itself (one-time nonce from an agent
    // host); redirecting away would eat the nonce mid-flight.
    if (segments[0] === 'auth') return;

    // /welcome is the one-time arrived-from-Third-Brain explainer — it renders
    // for signed-out members too (its buttons lead into the gated app).
    if (segments[0] === 'welcome') return;

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

  // ThemeProvider sits above the auth gate so the very first painted frame —
  // sign-in included — already honours the stored preference.
  return (
    <ThemeProvider>
      <RootChrome />
    </ThemeProvider>
  );
}

/** Everything that needs the resolved theme, so it can read the context. */
function RootChrome() {
  const p = usePalette();
  const { scheme } = useThemeMode();

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
          <Stack.Screen name="oauth/authorize" options={{ headerShown: false }} />
          <Stack.Screen name="auth/handoff" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack>
      </AuthGate>
      {/* Driven by the same resolved scheme as the palette, so an explicit
          Light choice on a dark-mode phone still gets dark status-bar text
          instead of "auto" reading the OS and getting it backwards. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SessionProvider>
  );
}
