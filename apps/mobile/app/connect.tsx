/**
 * Agent-connect handoff page (consent-screen UX without full OAuth).
 *
 * An agent host (e.g. Third Brain) links the user here:
 *   /connect?name=Chief+of+Staff&redirect_uri=https://brainos.../callback&state=xyz
 *
 * The user signs in (inline) and taps Approve. MC Peels mints an mcp_ personal
 * access token and returns it in the URL FRAGMENT (never sent to servers/logs):
 *   <redirect_uri>#token=mcp_...&state=xyz     (or #error=access_denied&state=xyz)
 *
 * redirect_uri must be https (http allowed for localhost) and its origin must
 * be allowlisted (EXPO_PUBLIC_CONNECT_REDIRECT_ORIGINS, comma-separated).
 * Without a redirect_uri this degrades to a copy-the-token screen.
 * Full contract: docs/third-brain-connect.md.
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
import { api, getErrorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const DEFAULT_ALLOWED_ORIGINS = ['https://brainos.secondninelabs.com'];

function allowedOrigins(): string[] {
  const fromEnv = (process.env.EXPO_PUBLIC_CONNECT_REDIRECT_ORIGINS ?? '')
    .split(',')
    .map((s: string) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

type RedirectCheck =
  | { kind: 'none' }
  | { kind: 'ok'; url: URL }
  | { kind: 'rejected'; reason: string };

function checkRedirect(raw: string | undefined): RedirectCheck {
  if (!raw) return { kind: 'none' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'rejected', reason: 'The redirect_uri is not a valid absolute URL.' };
  }
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    return { kind: 'rejected', reason: 'The redirect_uri must use https.' };
  }
  // localhost is always allowed (standard practice for local agent development;
  // an attacker cannot receive tokens on the victim's own machine).
  if (isLocalhost || allowedOrigins().includes(url.origin)) {
    return { kind: 'ok', url };
  }
  return {
    kind: 'rejected',
    reason: `${url.origin} is not an approved destination for MC Peels tokens.`,
  };
}

function buildFragment(fields: Record<string, string | undefined>): string {
  const parts = Object.entries(fields)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return `#${parts.join('&')}`;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function ConnectScreen() {
  const p = usePalette();
  const params = useLocalSearchParams<{
    name?: string | string[];
    redirect_uri?: string | string[];
    state?: string | string[];
  }>();
  const agentName = (first(params.name) ?? 'Third Brain').slice(0, 60);
  const redirectRaw = first(params.redirect_uri);
  const state = first(params.state);

  const { session, membership, ready } = useSession();
  const redirect = useMemo(() => checkRedirect(redirectRaw), [redirectRaw]);

  // Inline auth state
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Copy-fallback state (no redirect_uri, or native)
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canRedirect = redirect.kind === 'ok' && Platform.OS === 'web';

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

  const approve = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const created = await api.createToken(agentName);
      if (canRedirect && redirect.kind === 'ok') {
        window.location.replace(
          redirect.url.toString() + buildFragment({ token: created.token, state }),
        );
        return; // navigating away
      }
      setMintedToken(created.token);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (canRedirect && redirect.kind === 'ok') {
      window.location.replace(
        redirect.url.toString() + buildFragment({ error: 'access_denied', state }),
      );
    }
  };

  const copyToken = async () => {
    if (!mintedToken) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(mintedToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Selection fallback is always available below.
    }
  };

  const shell = (children: React.ReactNode) => (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Ionicons name="link-outline" size={40} color={p.onBg} />
            <Text style={[styles.title, { color: p.onBg }]}>Connect {agentName}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  if (!ready) return shell(null);

  // A bad redirect target is a hard stop — never mint into an unknown origin.
  if (redirect.kind === 'rejected') {
    return shell(<ErrorBanner message={`Connection blocked: ${redirect.reason}`} />);
  }

  // Token minted, no redirect available: copy-paste handoff.
  if (mintedToken) {
    return shell(
      <Card>
        <SuccessBanner message={`${agentName} access token created.`} />
        <Text style={[styles.tokenValue, { color: p.tint }]} selectable>
          {mintedToken}
        </Text>
        {Platform.OS === 'web' ? (
          <Button title={copied ? 'Copied!' : 'Copy token'} onPress={copyToken} icon="copy-outline" />
        ) : null}
        <Text style={[styles.note, { color: p.textMuted }]}>
          Paste this into {agentName}. It won’t be shown again — you can revoke it any time from
          the Household tab.
        </Text>
      </Card>,
    );
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
        <Button title={`Connect ${agentName}`} onPress={approve} loading={busy} />
        {canRedirect ? (
          <Button title="Cancel" variant="secondary" onPress={cancel} disabled={busy} />
        ) : null}
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
  tokenValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    marginVertical: 12,
  },
});
