/**
 * Shown when required EXPO_PUBLIC_* env vars are missing, instead of crashing
 * or bouncing the user through auth against a nonexistent backend. Purely
 * informational — no network calls.
 */
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/theme';

interface EnvVar {
  name: string;
  present: boolean;
  hint: string;
}

const ENV_VARS: EnvVar[] = [
  {
    name: 'EXPO_PUBLIC_SUPABASE_URL',
    present: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').length > 0,
    hint: 'https://<project-ref>.supabase.co',
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    present: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').length > 0,
    hint: 'Supabase project anon/public key',
  },
  {
    name: 'EXPO_PUBLIC_API_URL',
    present: (process.env.EXPO_PUBLIC_API_URL ?? '').length > 0,
    hint: 'https://<your-mc-peels-api>.vercel.app',
  },
];

export function EnvSetupScreen() {
  const p = usePalette();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: p.background }]}
      contentContainerStyle={styles.container}
    >
      <Ionicons name="construct-outline" size={44} color={p.onBg} />
      <Text style={[styles.title, { color: p.onBg }]}>Almost there</Text>
      <Text style={[styles.subtitle, { color: p.onBgMuted }]}>
        MC Peels needs a few environment variables before it can start. Create{' '}
        <Text style={[styles.code, { color: p.text, backgroundColor: p.card }]}>apps/mobile/.env</Text>{' '}
        (copy <Text style={[styles.code, { color: p.text, backgroundColor: p.card }]}>.env.example</Text>) and
        set the values below, then the app reloads automatically.
      </Text>

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
        {ENV_VARS.map((v, i) => (
          <View
            key={v.name}
            style={[
              styles.row,
              i > 0 ? { borderTopWidth: 1, borderTopColor: p.border } : null,
            ]}
          >
            <Ionicons
              name={v.present ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={v.present ? p.success : p.onBgMuted}
            />
            <View style={styles.rowText}>
              <Text style={[styles.varName, { color: p.onBg }]}>{v.name}</Text>
              <Text style={[styles.varHint, { color: p.onBgMuted }]}>
                {v.present ? 'Set' : v.hint}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.footnote, { color: p.onBgMuted }]}>
        EXPO_PUBLIC_API_URL points the app at your deployed MC Peels backend.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
  },
  varName: {
    fontSize: 14,
    fontWeight: '600',
  },
  varHint: {
    fontSize: 13,
    marginTop: 2,
  },
  footnote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
});
