import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorBanner, Field, SuccessBanner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

export default function SignUpScreen() {
  const p = usePalette();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    if (loading) return;
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Enter an email and a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!data.session) {
      // Email confirmation is enabled on the Supabase project.
      setInfo('Almost there — check your email to confirm your account, then sign in.');
    }
    // If a session was returned, the auth gate in app/_layout.tsx routes onward.
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Image
              source={require('../../assets/brand/banana.png')}
              style={styles.mascot}
              contentFit="contain"
              accessibilityLabel="MC Peels banana mascot"
            />
            <Text style={[styles.title, { color: p.text }]}>Create your account</Text>
            <Text style={[styles.subtitle, { color: p.textMuted }]}>
              One account per person — you&apos;ll create or join your household next.
            </Text>
          </View>

          <ErrorBanner message={error} />
          <SuccessBanner message={info} />

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
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
            onSubmitEditing={signUp}
          />

          <Button title="Create account" onPress={signUp} loading={loading} />

          <View style={styles.switchRow}>
            <Text style={{ color: p.textMuted }}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" style={[styles.link, { color: p.tint }]}>
              Sign in
            </Link>
          </View>
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
    marginBottom: 28,
  },
  mascot: {
    width: 56,
    height: 66,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  link: {
    fontWeight: '600',
  },
});
