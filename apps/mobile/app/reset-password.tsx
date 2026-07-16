/**
 * Password-recovery landing page.
 *
 * Supabase's recovery email links to Auth's /verify endpoint, which then
 * redirects here with the session in the URL fragment:
 *
 *   /reset-password#access_token=…&refresh_token=…&type=recovery      (success)
 *   /reset-password#error=…&error_code=otp_expired&error_description=…  (expired)
 *
 * The client is configured with detectSessionInUrl:false (lib/supabase.ts), so
 * we parse the fragment ourselves, establish the recovery session with
 * setSession, and let the user set a new password via updateUser. This route is
 * excluded from the AuthGate (app/_layout.tsx) so the recovery session doesn't
 * bounce the user into the app before they've finished.
 */

import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotMark } from '@/components/MascotMark';
import {
  Button,
  Card,
  DisplayTitle,
  ErrorBanner,
  Field,
  LoadingView,
  SuccessBanner,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

type Stage = 'verifying' | 'form' | 'error' | 'done';

/** Parse both the `#fragment` and `?query` of a redirect URL into a flat map. */
function parseParams(url: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!url) return out;
  const grab = (chunk: string) => {
    for (const part of chunk.split('&')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      const key = decodeURIComponent(eq >= 0 ? part.slice(0, eq) : part);
      const val = decodeURIComponent((eq >= 0 ? part.slice(eq + 1) : '').replace(/\+/g, ' '));
      if (key) out[key] = val;
    }
  };
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  if (queryAt >= 0) grab(url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined));
  if (hashAt >= 0) grab(url.slice(hashAt + 1));
  return out;
}

function friendlyError(params: Record<string, string>): string {
  if (params.error_code === 'otp_expired' || params.error === 'access_denied') {
    return 'This reset link has expired or was already used. Request a fresh one from the sign-in screen.';
  }
  return params.error_description || 'This reset link is invalid or has already been used.';
}

export default function ResetPasswordScreen() {
  const p = usePalette();
  const router = useRouter();
  const linkedUrl = Linking.useURL();

  const [stage, setStage] = useState<Stage>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const handled = useRef(false);

  // Pull the recovery token out of the incoming URL and open a recovery
  // session. The token rides in the URL fragment, which can be absent on the
  // very first web render (router normalisation) and arrives a tick after
  // mount on a native deep link — so this is safe to call repeatedly and only
  // ever commits once (handled ref). Returns true once it has acted on a URL
  // that actually carried a token or an error.
  const consumeRecoveryUrl = useCallback((): boolean => {
    if (handled.current) return true;

    const source =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : linkedUrl;
    const params = parseParams(source);
    const hasTokens = Boolean(params.access_token && params.refresh_token);
    const hasError = Boolean(params.error || params.error_code || params.error_description);

    // Nothing usable in the URL yet — let a later render or the timeout retry.
    if (!hasTokens && !hasError) return false;

    handled.current = true;

    if (hasError) {
      setError(friendlyError(params));
      setStage('error');
      return true;
    }
    if (params.type && params.type !== 'recovery') {
      setError('This reset link is invalid or has already been used.');
      setStage('error');
      return true;
    }

    supabase.auth
      .setSession({ access_token: params.access_token, refresh_token: params.refresh_token })
      .then(({ error: sessErr }) => {
        if (sessErr) {
          setError('This reset link has expired. Request a fresh one from the sign-in screen.');
          setStage('error');
        } else {
          setStage('form');
        }
      })
      .catch(() => {
        setError('This reset link has expired. Request a fresh one from the sign-in screen.');
        setStage('error');
      });
    return true;
  }, [linkedUrl]);

  // Consume the recovery token from the URL, polling briefly before giving up.
  // On web the fragment is racy during boot — Expo Router strips it and re-adds
  // it while normalising the URL, so a single read can miss a perfectly valid
  // token. On native the deep link arrives a tick after mount. Poll until the
  // token shows up (the common case resolves on the first read) or the window
  // elapses, then declare the link invalid.
  useEffect(() => {
    if (handled.current || consumeRecoveryUrl()) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 25; // ~3s at 120ms
    const id = setInterval(() => {
      if (handled.current || consumeRecoveryUrl()) {
        clearInterval(id);
        return;
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(id);
        handled.current = true;
        setError('This reset link is invalid or has already been used.');
        setStage('error');
      }
    }, 120);
    return () => clearInterval(id);
  }, [consumeRecoveryUrl]);

  // Note on the token in the URL fragment: Expo Router owns the web URL and
  // reconciles the fragment back on every render, so a history.replaceState
  // strip won't stick while we stay on this route. That's acceptable here — the
  // fragment is client-only (never sent to a server), the recovery token is
  // single-use and consumed by setSession above, and finishing the flow calls
  // router.replace('/(auth)/sign-in'), which drops this history entry (and
  // signOut revokes the session) so nothing lingers afterward.

  const save = async () => {
    if (saving) return;
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setStage('done');
  };

  // Finish on the sign-in screen with a clean, signed-out state so the user
  // confirms the new password works.
  const backToSignIn = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  };

  const goRequestNew = () => router.replace('/(auth)/forgot-password');

  if (stage === 'verifying') {
    return <LoadingView message="Checking your reset link…" />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.mascot}>
              <MascotMark size={72} />
            </View>
            <DisplayTitle
              text={stage === 'done' ? 'You’re all set.' : 'Set a new password.'}
              emphasis={stage === 'done' ? 'set' : 'password'}
              size={34}
            />
          </View>

          <Card elevated style={styles.formCard}>
            {stage === 'error' ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>Link didn&apos;t work.</Text>
                <ErrorBanner message={error} />
                <Button title="Request a new link" onPress={goRequestNew} />
                <View style={styles.switchRow}>
                  <Text style={{ color: p.textMuted }}>Changed your mind? </Text>
                  <Text
                    onPress={() => router.replace('/(auth)/sign-in')}
                    style={[styles.link, { color: p.tint }]}
                  >
                    Sign in
                  </Text>
                </View>
              </>
            ) : stage === 'done' ? (
              <>
                <SuccessBanner message="Your password has been updated." />
                <Text style={[styles.help, { color: p.textMuted }]}>
                  Sign in with your new password to pick up where you left off.
                </Text>
                <Button title="Back to sign in" onPress={backToSignIn} />
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>Choose something new.</Text>
                <ErrorBanner message={error} />
                <Field
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <Field
                  label="Confirm password"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Same password again"
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={save}
                />
                <Button title="Update password" onPress={save} loading={saving} />
              </>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    marginBottom: 24,
    gap: 14,
  },
  mascot: {
    alignSelf: 'flex-start',
  },
  formCard: {
    padding: 22,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  help: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  link: {
    fontWeight: '700',
  },
});
