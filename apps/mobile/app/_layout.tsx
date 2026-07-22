import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { EnvSetupScreen } from '@/components/EnvSetupScreen';
import { LoadingView } from '@/components/ui';
import { SessionProvider, useSession } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ThemeProvider, usePalette, useThemeMode } from '@/lib/theme';

/**
 * Standalone pages that own their whole auth UX — the gate never redirects
 * into or out of them:
 * - connect: agent-token consent (inline sign-in, query params load-bearing)
 * - oauth: OAuth code-flow consent (same rules)
 * - auth: /auth/handoff signs the browser in itself via a one-time nonce
 * - welcome: one-time arrived-from-Third-Brain explainer, renders signed-out
 * - eats-preview: signed-out showcase, static menus only
 * - reset-password: recovery-email landing with its own short-lived session
 * - green-room: the backstage playground (nothing personal on it)
 */
const STANDALONE_ROUTES = [
  'connect',
  'oauth',
  'auth',
  'welcome',
  'eats-preview',
  'reset-password',
  'green-room',
];

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

    // WEB DEEP-LINK GUARD — the address bar is the only truth during boot.
    // The navigator sits on its DEFAULT route (the (auth) front door) until
    // the deep link is applied, and useSegments() reports that default; an
    // effect firing in that window used to hijack standalone pages (observed
    // live, repeatedly: /welcome → home for a signed-in member, because
    // segments said "(auth)"). window.location is synchronously correct from
    // the first frame, so exempt by URL first, segments second.
    if (Platform.OS === 'web') {
      const urlFirst = window.location.pathname.split('/').filter(Boolean)[0] ?? null;
      if (urlFirst && STANDALONE_ROUTES.includes(urlFirst)) return;
    }
    // Native (and settled web): segments are authoritative.
    if (STANDALONE_ROUTES.includes((segments as string[])[0] ?? '')) return;
    // Router not hydrated yet — location unknown, never redirect blind. (The
    // cast: the typed route tuple claims length ≥ 1, untrue mid-hydration.)
    if ((segments as string[]).length === 0) return;

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
