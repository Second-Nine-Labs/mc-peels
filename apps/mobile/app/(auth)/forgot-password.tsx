import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotMark } from '@/components/MascotMark';
import { Button, Card, DisplayTitle, ErrorBanner, EyebrowChip, Field, SuccessBanner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

// Where Supabase sends the recovery link. Web returns to the same origin so it
// works in dev (localhost) and prod alike; native uses the app scheme. Both
// paths must be on the project's Auth "Redirect URLs" allow-list. Mirrors the
// web/native split in lib/kroger-connect.ts.
const RESET_PATH = 'reset-password';
function resetRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/${RESET_PATH}`;
  }
  return `mcpeels://${RESET_PATH}`;
}

export default function ForgotPasswordScreen() {
  const p = usePalette();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendLink = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim()) {
      setError('Enter the email you signed up with.');
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirectTo(),
    });
    setLoading(false);

    // Supabase does not reveal whether the address exists (anti-enumeration),
    // so on anything but a transport/rate-limit error we show the same
    // confirmation regardless.
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  };

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
            <EyebrowChip label="Account help" surface="brand" />
            <DisplayTitle text="Forgot your password?" emphasis="password" size={34} />
            <Text style={[styles.subtitle, { color: p.onBgMuted }]}>
              Enter your email and we&apos;ll send a link to set a new one.
            </Text>
          </View>

          <Card elevated style={styles.formCard}>
            {sent ? (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>Check your email.</Text>
                <SuccessBanner
                  message={`If an account exists for ${email.trim()}, a reset link is on its way. It expires in about an hour.`}
                />
                <Text style={[styles.help, { color: p.textMuted }]}>
                  Didn&apos;t get it? Check spam, or head back and try again.
                </Text>
                <View style={styles.switchRow}>
                  <Link href="/(auth)/sign-in" style={[styles.link, { color: p.tint }]}>
                    Back to sign in
                  </Link>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { color: p.text }]}>Reset your password.</Text>
                <ErrorBanner message={error} />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  onSubmitEditing={sendLink}
                />
                <Button title="Send reset link" onPress={sendLink} loading={loading} />
                <View style={styles.switchRow}>
                  <Text style={{ color: p.textMuted }}>Remember it? </Text>
                  <Link href="/(auth)/sign-in" style={[styles.link, { color: p.tint }]}>
                    Sign in
                  </Link>
                </View>
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
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
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
