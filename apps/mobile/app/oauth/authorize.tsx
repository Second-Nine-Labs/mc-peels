/**
 * OAuth authorization endpoint (the human half): standard authorization-code +
 * PKCE consent screen for agent hosts. Third Brain links the user here:
 *
 *   /oauth/authorize?response_type=code&client_id=third-brain
 *     &redirect_uri=https://brainos.../api/mcpeels/callback&scope=groceries
 *     &state=xyz&code_challenge=...&code_challenge_method=S256
 *
 * The user signs in (inline) and taps Allow. The API mints a one-time
 * authorization code and we redirect with ?code=...&state=... in the QUERY
 * (codes are single-use and PKCE-bound, unlike /connect's #token fragment).
 * Deny redirects with ?error=access_denied. Contract: docs/third-brain-oauth-build.md.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, ErrorBanner, Field, SuccessBanner } from '@/components/ui';
import { checkRedirect, first } from '@/lib/agent-connect';
import { api, getErrorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const KNOWN_CLIENTS: Record<string, string> = { 'third-brain': 'Third Brain' };

export default function OauthAuthorizeScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{
    response_type?: string | string[];
    client_id?: string | string[];
    redirect_uri?: string | string[];
    scope?: string | string[];
    state?: string | string[];
    code_challenge?: string | string[];
    code_challenge_method?: string | string[];
  }>();
  const responseType = first(params.response_type);
  const clientId = first(params.client_id) ?? '';
  const redirectRaw = first(params.redirect_uri);
  const scope = first(params.scope) ?? 'groceries';
  const state = first(params.state);
  const codeChallenge = first(params.code_challenge);
  const codeChallengeMethod = first(params.code_challenge_method);

  const agentName = KNOWN_CLIENTS[clientId] ?? clientId;
  const { session, membership, ready } = useSession();
  const redirect = useMemo(() => checkRedirect(redirectRaw), [redirectRaw]);

  // Inline auth state (same UX as /connect: never leave the consent page).
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A malformed request is a hard stop — never mint a code we can't deliver
  // safely. (Message chosen for the human who lands here, not the client dev.)
  const requestProblem = useMemo(() => {
    if (redirect.kind === 'rejected') return `Connection blocked: ${redirect.reason}`;
    if (redirect.kind === 'none') return 'Connection blocked: the link is missing its return address (redirect_uri).';
    if (responseType !== 'code') return 'Connection blocked: this link is malformed (response_type must be "code").';
    if (!KNOWN_CLIENTS[clientId]) return `Connection blocked: "${clientId || '(missing client_id)'}" is not a registered agent.`;
    if (!codeChallenge || codeChallengeMethod !== 'S256')
      return 'Connection blocked: this link is malformed (PKCE S256 code_challenge is required).';
    if (Platform.OS !== 'web') return 'Open this connection link in a web browser to finish connecting.';
    return null;
  }, [redirect, responseType, clientId, codeChallenge, codeChallengeMethod]);

  const sendBack = (fields: Record<string, string | undefined>) => {
    if (redirect.kind !== 'ok') return;
    const url = new URL(redirect.url.toString());
    for (const [k, v] of Object.entries(fields)) {
      if (v) url.searchParams.set(k, v);
    }
    window.location.replace(url.toString());
  };

  const submitAuth = async () => {
    if (busy) return;
    setError(null);
    setAuthInfo(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) setError(authError.message);
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authError.message);
        } else if (!data.session) {
          setAuthInfo(
            'Check your email to confirm your account, then come back to this page — the connect link still works.',
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const allow = async () => {
    if (busy || !codeChallenge || redirect.kind !== 'ok') return;
    setError(null);
    setBusy(true);
    try {
      const { code } = await api.createOauthCode({
        client_id: clientId,
        redirect_uri: redirectRaw!,
        scope,
        code_challenge: codeChallenge,
      });
      sendBack({ code, state });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  const deny = () => sendBack({ error: 'access_denied', state });

  const shell = (children: React.ReactNode) => (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Ionicons name="link-outline" size={40} color={p.onBg} />
            <Text style={[styles.title, { color: p.onBg }]}>
              Connect {agentName || 'your agent'}
            </Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (!ready) return shell(null);

  if (requestProblem) {
    return shell(<ErrorBanner message={requestProblem} />);
  }

  // Signed out: inline sign-in / sign-up, staying on this page.
  if (!session) {
    return shell(
      <Card>
        <Text style={[styles.subtitle, { color: p.textMuted }]}>
          Sign in to your MC Peels account to connect {agentName}.
        </Text>
        <ErrorBanner message={error} />
        <SuccessBanner message={authInfo} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
          secureTextEntry
          onSubmitEditing={submitAuth}
        />
        <Button
          title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
          onPress={submitAuth}
          loading={busy}
        />
        <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          <Text style={[styles.switchLink, { color: p.tint }]}>
            {mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
          </Text>
        </Pressable>
      </Card>,
    );
  }

  // Signed in: the consent card.
  return shell(
    <>
      <Card>
        <Text style={[styles.subtitle, { color: p.textMuted }]}>
          {agentName} is asking to use MC Peels on your behalf. It will be able to:
        </Text>
        {[
          'Build Instacart carts from your grocery requests, with your household dietary profile applied automatically',
          'See your household’s carts, retailers, and dietary profile',
        ].map((line) => (
          <View key={line} style={styles.permRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={p.success} />
            <Text style={[styles.permText, { color: p.text }]}>{line}</Text>
          </View>
        ))}
        <View style={styles.permRow}>
          <Ionicons name="close-circle-outline" size={18} color={p.danger} />
          <Text style={[styles.permText, { color: p.text }]}>
            It can never complete a purchase — checkout always happens by you, on Instacart.
          </Text>
        </View>

        {!membership ? (
          <Text style={[styles.note, { color: p.textMuted }]}>
            Heads up: you haven’t set up a household yet. You can connect now, but finish setup in
            MC Peels before ordering.
          </Text>
        ) : null}

        <ErrorBanner message={error} />
        <Button title="Allow" onPress={allow} loading={busy} />
        <Button title="Deny" variant="secondary" onPress={deny} disabled={busy} />
      </Card>
      <Text style={[styles.note, styles.identity, { color: p.onBgMuted }]}>
        Signed in as {session.user.email ?? 'your account'} ·{' '}
        <Text style={{ color: p.onBg, fontWeight: '600' }} onPress={() => supabase.auth.signOut()}>
          Use a different account
        </Text>
      </Text>
    </>,
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
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
    marginBottom: 14,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  permText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  identity: {
    textAlign: 'center',
  },
  switchLink: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
  },
});
