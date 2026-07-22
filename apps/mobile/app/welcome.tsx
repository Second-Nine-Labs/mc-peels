/**
 * One-time post-connect explainer for members arriving from Third Brain
 * (workplan item 5, household-os/docs/mcpeels-connect-workplan.md). Third
 * Brain points both doorways here — the SSO handoff's redirect_to and its
 * plain fallback link. Self-gating: the first view per browser marks it seen
 * and every later visit bounces straight to the app, so it is always safe to
 * send anyone here, linked or not.
 */
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { usePalette } from '@/lib/theme';

const SEEN_KEY = 'mcpeels.welcome.seen';
const THIRD_BRAIN_URL = 'https://brainos.secondninelabs.com';

function alreadySeen(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode) → just show the card
  }
}

function markSeen(): void {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do — worst case the member sees the card twice.
  }
}

// Module scope on purpose: router hydration can remount this screen, and a
// remount that re-read localStorage would find the first mount's own mark and
// bounce the card it was meant to show. The show/bounce decision is made ONCE
// per page load, at render time — declaratively via <Redirect>, never in an
// effect racing hydration. Real navigation re-evaluates it fresh.
let decision: 'show' | 'bounce' | null = null;

export default function WelcomeScreen() {
  const p = usePalette();
  const router = useRouter();

  if (decision === null) {
    decision = alreadySeen() ? 'bounce' : 'show';
    if (Platform.OS === 'web') {
      // Deploy-verification marker: which revision of this screen is running.
      (window as unknown as Record<string, unknown>).__welcomeRev = 4;
    }
  }

  useEffect(() => {
    if (decision === 'show') markSeen();
  }, []);

  if (decision === 'bounce') return <Redirect href="/" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Ionicons name="link-outline" size={40} color={p.onBg} />
          <Text style={[styles.title, { color: p.onBg }]}>Welcome to MC Peels</Text>
          <Text style={[styles.subtitle, { color: p.onBgMuted }]}>
            You came from Third Brain — here’s how the two fit together.
          </Text>
        </View>

        <Card>
          <View style={styles.pathRow}>
            <Ionicons name="storefront-outline" size={22} color={p.tint} />
            <View style={styles.pathText}>
              <Text style={[styles.pathTitle, { color: p.text }]}>Curate your kitchen here</Text>
              <Text style={[styles.pathBody, { color: p.textMuted }]}>
                Stores, dietary profile, staples, saved recipes — MC Peels is where your
                household’s food preferences live, and every cart gets them applied automatically.
              </Text>
            </View>
          </View>

          <View style={styles.pathRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={p.tint} />
            <View style={styles.pathText}>
              <Text style={[styles.pathTitle, { color: p.text }]}>Build carts back in Third Brain</Text>
              <Text style={[styles.pathBody, { color: p.textMuted }]}>
                Just ask in chat — “grab organic bananas” — and you get a checkout-ready
                Instacart link. You always review and pay yourself.
              </Text>
            </View>
          </View>

          <Button title="Set up my kitchen" onPress={() => router.replace('/(tabs)/household')} />
          {Platform.OS === 'web' ? (
            <Button
              title="Back to Third Brain"
              variant="secondary"
              onPress={() => {
                window.location.href = THIRD_BRAIN_URL;
              }}
            />
          ) : null}
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  pathText: {
    flex: 1,
  },
  pathTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  pathBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
