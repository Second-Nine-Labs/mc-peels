import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
import { Button, DisplayTitle, ErrorBanner, EyebrowChip, StatusChip } from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { rememberCartResult } from '@/lib/cart-cache';
import { formatDate, prettifyRetailerKey } from '@/lib/format';
import { useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';
import { useScrollBottomInset } from '@/lib/use-scroll-bottom-inset';
import type { CartSummary, UsualItem } from '@/lib/types';

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
  const bottomInset = useScrollBottomInset();
  const router = useRouter();
  const { membership, me } = useSession();
  const householdId = membership?.household_id;

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [usuals, setUsuals] = useState<UsualItem[]>([]);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The household's cart history — folded in from the old standalone Carts tab.
  const [carts, setCarts] = useState<CartSummary[] | null>(null);
  const [cartsError, setCartsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retailerNames, setRetailerNames] = useState<Record<string, string>>({});

  // The household's recurring items (best-effort; hidden when there are none).
  useEffect(() => {
    let cancelled = false;
    api
      .getUsuals({ household_id: householdId })
      .then((r) => {
        if (!cancelled) setUsuals(r.usuals);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [householdId]);

  const loadCarts = useCallback(async () => {
    if (!householdId) return;
    try {
      const data = await api.listCarts({ household_id: householdId, limit: 50 });
      setCarts(data.carts);
      setCartsError(null);
    } catch (err) {
      setCartsError(getErrorMessage(err));
      setCarts((previous) => previous ?? []);
    }
  }, [householdId]);

  // Refresh history whenever the tab regains focus — a cart built here appears
  // the moment you return from its detail screen.
  useFocusEffect(
    useCallback(() => {
      loadCarts();
    }, [loadCarts]),
  );

  // Best-effort retailer_key -> display name for the history rows.
  useFocusEffect(
    useCallback(() => {
      if (!householdId) return;
      let cancelled = false;
      api
        .getRetailers({ household_id: householdId })
        .then((data) => {
          if (cancelled) return;
          const names: Record<string, string> = {};
          for (const retailer of data.retailers) names[retailer.retailer_key] = retailer.name;
          setRetailerNames(names);
        })
        .catch(() => {
          // Falls back to prettified retailer keys.
        });
      return () => {
        cancelled = true;
      };
    }, [householdId]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCarts();
    setRefreshing(false);
  }, [loadCarts]);

  // Tap a usual to append it to the request (deduped, comma-joined).
  const addUsual = useCallback((name: string) => {
    setText((prev) => {
      const trimmed = prev.trim();
      const parts = trimmed ? trimmed.split(',').map((s) => s.trim().toLowerCase()) : [];
      if (parts.includes(name.toLowerCase())) return prev;
      return trimmed ? `${trimmed}, ${name}` : name;
    });
  }, []);

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
  const hasCarts = (carts?.length ?? 0) > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]} edges={['top']}>
      <Animated.View style={[styles.flex, { transform: [{ rotate: spinDeg }] }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.container, { paddingBottom: bottomInset }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.onBg} />
            }
          >
          <View style={styles.hero}>
            <View style={styles.mascot}>
              <MascotMark size={60} onStreak={throwParty} />
            </View>
            <EyebrowChip label="Groceries, in plain words" onCanvas />
            <DisplayTitle text="What do you need?" emphasis="need" size={38} style={styles.heroTitle} />
            <Text style={[styles.subtitle, { color: p.onBgMuted }]}>
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

          {usuals.length > 0 ? (
            <>
              <Text style={[styles.examplesLabel, { color: p.onBgMuted }]}>Your usuals</Text>
              <View style={styles.usuals}>
                {usuals.map((u) => (
                  <Pressable
                    key={u.name}
                    onPress={() => addUsual(u.name)}
                    style={[styles.usualChip, { backgroundColor: p.card, borderColor: p.border }]}
                  >
                    <Ionicons name="add" size={15} color={p.tint} />
                    <Text style={[styles.usualText, { color: p.text }]}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {/* Prompts are a first-run helper — once there's history to lean on,
              they'd just be noise, so they retire when carts exist. */}
          {!hasCarts ? (
            <>
              <Text style={[styles.examplesLabel, { color: p.onBgMuted }]}>Try something like</Text>
              <View style={styles.examples}>
                {EXAMPLES.map((example) => (
                  <Pressable
                    key={example}
                    onPress={() => typeOut(example)}
                    style={[styles.example, { backgroundColor: p.card }]}
                  >
                    <Ionicons name="bulb-outline" size={16} color={p.tint} />
                    <Text style={[styles.exampleText, { color: p.text }]}>{example}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {/* Recent carts — the household's history, folded in from the old
              standalone Carts tab. Ordered + in-progress carts both live here. */}
          <ErrorBanner message={cartsError} />
          {hasCarts ? (
            <View style={styles.history}>
              <Text style={[styles.examplesLabel, { color: p.onBgMuted }]}>Recent carts</Text>
              {carts!.map((item) => {
                // retailer_key is null when a cart was built via the
                // partial-success path (no preferred retailer, lookup empty).
                const retailerName = item.retailer_key
                  ? (retailerNames[item.retailer_key] ?? prettifyRetailerKey(item.retailer_key))
                  : null;
                const createdBy = item.created_by_user_id === me?.user.id ? 'you' : 'a household member';
                const title = item.title?.trim() || item.request_text?.trim() || 'Grocery cart';
                const meta = [retailerName, formatDate(item.created_at), `by ${createdBy}`]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push({ pathname: '/cart/[id]', params: { id: item.id } })}
                    style={({ pressed }) => [
                      styles.cartRow,
                      { backgroundColor: p.card, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={styles.cartRowHeader}>
                      <Text style={[styles.cartRowTitle, { color: p.text }]} numberOfLines={2}>
                        {title}
                      </Text>
                      <StatusChip status={item.status} />
                    </View>
                    <Text style={[styles.cartRowMeta, { color: p.textMuted }]} numberOfLines={1}>
                      {meta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.footnote, { color: p.onBgMuted }]}>
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
    // Top-aligned now that cart history can extend the screen well past a
    // viewport — the composer no longer floats centered.
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 24,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    marginTop: 12,
    marginBottom: 24,
    gap: 12,
  },
  mascot: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  heroTitle: {
    marginTop: 2,
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
  usuals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  usualChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 7,
  },
  usualText: {
    fontSize: 14,
    fontWeight: '500',
  },
  examples: {
    gap: 8,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxShadow: '0px 10px 22px rgba(21, 34, 56, 0.10)',
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
  history: {
    gap: 10,
  },
  cartRow: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
    boxShadow: '0px 12px 26px rgba(21, 34, 56, 0.10)',
  },
  cartRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cartRowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  cartRowMeta: {
    fontSize: 13,
  },
});
