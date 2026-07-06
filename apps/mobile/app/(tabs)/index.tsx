import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BananaLoader } from '@/components/BananaLoader';
import { BananaRain } from '@/components/BananaRain';
import { MascotMark } from '@/components/MascotMark';
import { Button, ErrorBanner } from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { rememberCartResult } from '@/lib/cart-cache';
import { useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';

const EXAMPLES = [
  'Organic bananas, blueberries, and grass-fed beef',
  'Milk, eggs, and sourdough bread',
  'Taco night for the family',
];

// Secret "requests" that throw a banana party instead of building a cart.
const SECRET_PARTY = new Set([
  'party',
  'party mode',
  'banana party',
  'go bananas',
  'going bananas',
  'mc peels',
  '🍌',
  '🎉',
]);

export default function AskScreen() {
  const p = usePalette();
  const router = useRouter();
  const { membership } = useSession();

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- easter eggs ---
  const [party, setParty] = useState(0); // bump to drop a banana rain
  const spin = useRef(new Animated.Value(0)).current; // 0→1 barrel roll

  const throwParty = useCallback(() => setParty((n) => n + 1), []);
  const barrelRoll = useCallback(() => {
    spin.setValue(0);
    Animated.timing(spin, {
      toValue: 1,
      duration: 850,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [spin]);

  const stopTyping = () => {
    if (typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
  };

  // Tapping a suggestion "types" it into the box instead of dumping it in.
  const typeOut = (full: string) => {
    stopTyping();
    setText('');
    let i = 0;
    typingRef.current = setInterval(() => {
      i += 1;
      setText(full.slice(0, i));
      if (i >= full.length) stopTyping();
    }, 26);
  };

  useEffect(() => stopTyping, []);

  // Konami code on web (↑↑↓↓←→←→ B A) → full banana party.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      pos = k === seq[pos] ? pos + 1 : k === seq[0] ? 1 : 0;
      if (pos === seq.length) {
        pos = 0;
        throwParty();
        barrelRoll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [throwParty, barrelRoll]);

  const submit = async () => {
    stopTyping();
    const requestText = text.trim();
    if (!requestText || building) return;

    // Secret "requests" — a wink for the curious, never a real cart.
    const secret = requestText.toLowerCase();
    if (secret === 'do a barrel roll' || secret === 'barrel roll') {
      setText('');
      barrelRoll();
      return;
    }
    if (SECRET_PARTY.has(secret)) {
      setText('');
      throwParty();
      if (secret.includes('banana')) barrelRoll();
      return;
    }

    setError(null);
    setBuilding(true);

    try {
      const result = await api.createCart({
        household_id: membership?.household_id,
        request_text: requestText,
      });
      // Keep the full response (resolved items + partial-success notes) so the
      // detail screen can show "what MC Peels applied" immediately.
      rememberCartResult(result);
      setText('');
      router.push({ pathname: '/cart/[id]', params: { id: result.cart_id } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBuilding(false);
    }
  };

  if (building) {
    return <BananaLoader />;
  }

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]} edges={['top']}>
      <Animated.View style={[styles.flex, { transform: [{ rotate: spinDeg }] }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.mascot}>
              <MascotMark size={60} onStreak={throwParty} />
            </View>
            <Text style={[styles.brand, { color: p.tint }]}>MC Peels</Text>
            <Text style={[styles.title, { color: p.text }]}>What do you need?</Text>
            <Text style={[styles.subtitle, { color: p.textMuted }]}>
              Say it in plain language — we&apos;ll build an Instacart cart with{' '}
              {membership?.household.name ?? 'your household'}&apos;s dietary rules applied.
            </Text>
          </View>

          <ErrorBanner message={error} />

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={'e.g. "go buy organic bananas, blueberries, and grass-fed beef"'}
            placeholderTextColor={p.textMuted}
            multiline
            textAlignVertical="top"
            style={[
              styles.input,
              { backgroundColor: p.card, borderColor: p.border, color: p.text },
            ]}
          />

          <Button
            title="Build my cart"
            icon="cart-outline"
            onPress={submit}
            disabled={!text.trim()}
          />

          <Text style={[styles.examplesLabel, { color: p.textMuted }]}>Try something like</Text>
          <View style={styles.examples}>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                onPress={() => typeOut(example)}
                style={[styles.example, { backgroundColor: p.card, borderColor: p.border }]}
              >
                <Ionicons name="bulb-outline" size={16} color={p.tint} />
                <Text style={[styles.exampleText, { color: p.text }]}>{example}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.footnote, { color: p.textMuted }]}>
            You&apos;ll review and pay on Instacart — MC Peels never handles payment.
          </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
      <BananaRain burstKey={party} />
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
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    marginBottom: 24,
  },
  mascot: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  brand: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
    marginBottom: 16,
  },
  examplesLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 28,
    marginBottom: 10,
  },
  examples: {
    gap: 8,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 28,
  },
});
