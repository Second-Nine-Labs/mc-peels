/**
 * Landing pad for cross-app sign-in (Third Brain → MC Peels). The browser
 * arrives at /auth/handoff#t=<one-time nonce> — the nonce rides the fragment
 * so it never appears in anyone's access logs, and we scrub it from the
 * address bar before doing anything async. Redeem trades it for a short-lived
 * Supabase token_hash, verifyOtp establishes the member's normal session, and
 * a full-page replace lands them on the stored destination (fresh boot, so
 * the auth gate sees the new session). Contract: docs/fix-third-brain-connect.md.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, ErrorBanner, LoadingView } from '@/components/ui';
import { redeemHandoff } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

export default function AuthHandoffScreen() {
  const p = usePalette();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setFailed(true);
      return;
    }
    const hash = window.location.hash;
    const nonce = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get('t');
    window.history.replaceState(null, '', window.location.pathname);
    if (!nonce) {
      setFailed(true);
      return;
    }
    (async () => {
      try {
        const { token_hash, redirect_to } = await redeemHandoff(nonce);
        const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash });
        if (error) throw error;
        window.location.replace(redirect_to);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  if (!failed) return <LoadingView />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Ionicons name="link-outline" size={40} color={p.onBg} />
          <Text style={[styles.title, { color: p.onBg }]}>Opening MC Peels</Text>
        </View>
        <Card>
          <ErrorBanner message="This sign-in link has expired or was already used. Head back to Third Brain and tap MC Peels again — links only live for a minute." />
          <Button title="Continue to MC Peels" onPress={() => router.replace('/')} />
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
});
