import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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

import { Button, Chip, ErrorBanner, Field, LoadingView } from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';
import type { CountryCode, Household, Retailer } from '@/lib/types';

type Mode = 'create' | 'join';

export default function OnboardingScreen() {
  const p = usePalette();
  const { signOut, refreshMe } = useSession();

  const [mode, setMode] = useState<Mode>('create');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('US');

  // Join form
  const [inviteCode, setInviteCode] = useState('');

  // Retailer step (after create). We hold off on refreshMe() until this step
  // finishes, otherwise the auth gate would navigate away immediately.
  const [createdHousehold, setCreatedHousehold] = useState<Household | null>(null);

  const createHousehold = async () => {
    if (submitting) return;
    setError(null);

    if (!name.trim() || !postalCode.trim()) {
      setError('Enter a household name and postal code.');
      return;
    }

    setSubmitting(true);
    try {
      const household = await api.createHousehold({
        name: name.trim(),
        postal_code: postalCode.trim(),
        country_code: countryCode,
      });
      setCreatedHousehold(household);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const joinHousehold = async () => {
    if (submitting) return;
    setError(null);

    if (!inviteCode.trim()) {
      setError('Enter your invite code.');
      return;
    }

    setSubmitting(true);
    try {
      await api.joinHousehold(inviteCode.trim());
      await refreshMe(); // Auth gate routes to the tabs.
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  if (createdHousehold) {
    return <RetailerStep household={createdHousehold} />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: p.text }]}>Set up your household</Text>
          <Text style={[styles.subtitle, { color: p.textMuted }]}>
            Groceries in MC Peels are shared per household — dietary rules, preferred store, and
            carts all live here.
          </Text>

          <View style={styles.modeRow}>
            <Chip label="Create a household" selected={mode === 'create'} onPress={() => setMode('create')} />
            <Chip label="Join with a code" selected={mode === 'join'} onPress={() => setMode('join')} />
          </View>

          <ErrorBanner message={error} />

          {mode === 'create' ? (
            <>
              <Field
                label="Household name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Shaffer Household"
              />
              <Field
                label="Postal code"
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="e.g. 10001"
                autoCapitalize="characters"
                helperText="Used to find Instacart retailers near you."
              />
              <Text style={[styles.fieldLabel, { color: p.textMuted }]}>Country</Text>
              <View style={styles.modeRow}>
                <Chip label="United States" selected={countryCode === 'US'} onPress={() => setCountryCode('US')} />
                <Chip label="Canada" selected={countryCode === 'CA'} onPress={() => setCountryCode('CA')} />
              </View>
              <Button title="Create household" onPress={createHousehold} loading={submitting} />
            </>
          ) : (
            <>
              <Field
                label="Invite code"
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="8-character code"
                autoCapitalize="characters"
                autoCorrect={false}
                helperText="Ask a household member to generate one from the Household tab."
              />
              <Button title="Join household" onPress={joinHousehold} loading={submitting} />
            </>
          )}

          <Button title="Sign out" onPress={signOut} variant="ghost" style={styles.signOut} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Step 2 after creating: pick a preferred retailer (skippable).

function RetailerStep({ household }: { household: Household }) {
  const p = usePalette();
  const { refreshMe } = useSession();

  const [retailers, setRetailers] = useState<Retailer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getRetailers({ household_id: household.id })
      .then((data) => {
        if (!cancelled) setRetailers(data.retailers);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(err));
          setRetailers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [household.id]);

  const finish = async (retailerKey: string | null) => {
    if (finishing) return;
    setError(null);
    setFinishing(true);
    try {
      if (retailerKey) {
        await api.updateHousehold(household.id, { preferred_retailer_key: retailerKey });
      }
      await refreshMe(); // Auth gate routes to the tabs.
    } catch (err) {
      setError(getErrorMessage(err));
      setFinishing(false);
    }
  };

  if (retailers === null) {
    return <LoadingView message="Finding stores near you…" />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: p.text }]}>Pick your store</Text>
        <Text style={[styles.subtitle, { color: p.textMuted }]}>
          Carts will be built at this retailer by default. You can change it any time in the
          Household tab.
        </Text>

        <ErrorBanner message={error ?? loadError} />

        {retailers.length === 0 && !loadError ? (
          <Text style={[styles.subtitle, { color: p.textMuted }]}>
            No retailers found near {household.postal_code}. You can skip this and set one later.
          </Text>
        ) : null}

        <View style={styles.retailerList}>
          {retailers.map((retailer) => {
            const selected = retailer.retailer_key === selectedKey;
            return (
              <Pressable
                key={retailer.retailer_key}
                onPress={() => setSelectedKey(selected ? null : retailer.retailer_key)}
                style={[
                  styles.retailerRow,
                  {
                    backgroundColor: selected ? p.tintSoft : p.card,
                    borderColor: selected ? p.tint : p.border,
                  },
                ]}
              >
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'storefront-outline'}
                  size={22}
                  color={selected ? p.tint : p.textMuted}
                />
                <Text style={[styles.retailerName, { color: selected ? p.tint : p.text }]}>
                  {retailer.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          title={selectedKey ? 'Save and continue' : 'Continue'}
          onPress={() => finish(selectedKey)}
          loading={finishing}
        />
        <Button
          title="Skip for now"
          onPress={() => finish(null)}
          variant="ghost"
          disabled={finishing}
          style={styles.signOut}
        />
      </ScrollView>
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
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  signOut: {
    marginTop: 12,
  },
  retailerList: {
    gap: 10,
    marginBottom: 24,
  },
  retailerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  retailerName: {
    fontSize: 16,
    fontWeight: '600',
  },
});
