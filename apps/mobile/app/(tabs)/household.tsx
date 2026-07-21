import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  DisplayTitle,
  ErrorBanner,
  EyebrowChip,
  Field,
  LoadingView,
  SuccessBanner,
  TagInput,
  Toggle,
} from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, prettifyFilterValue, prettifyRetailerKey } from '@/lib/format';
import { useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';
import { useScrollBottomInset } from '@/lib/use-scroll-bottom-inset';
import {
  EMPTY_DIETARY_PROFILE,
  HEALTH_FILTERS,
  type DietaryProfile,
  type HealthFilter,
  type HouseholdMember,
  type Retailer,
  type TokenSummary,
} from '@/lib/types';

/** First entry per retailer_key wins; order is preserved. */
function dedupeByRetailerKey(list: Retailer[]): Retailer[] {
  const seen = new Set<string>();
  return list.filter((r) => !seen.has(r.retailer_key) && seen.add(r.retailer_key));
}

const ALLERGEN_HONESTY_COPY =
  'Filters help select better matches but do not guarantee any product is allergen-free. ' +
  'Always check labels — checkout review on Instacart is the final safety gate.';

export default function HouseholdScreen() {
  const p = usePalette();
  const bottomInset = useScrollBottomInset();
  const { me, membership, refreshMe, signOut } = useSession();
  const householdId = membership?.household_id;
  const myUserId = me?.user.id;

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Household settings
  const [name, setName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState<'US' | 'CA'>('US');
  const [preferredRetailerKey, setPreferredRetailerKey] = useState<string | null>(null);
  const [savingHousehold, setSavingHousehold] = useState(false);

  // Retailers, members, profile, invite, tokens
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [profile, setProfile] = useState<DietaryProfile>(EMPTY_DIETARY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<'valid' | 'invalid' | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [connections, setConnections] = useState<Array<{ provider: string; connected_at: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  const flash = (setter: (v: string | null) => void, message: string) => {
    setter(message);
    setTimeout(() => setter(null), 4000);
  };

  const load = useCallback(async () => {
    if (!householdId) return;
    try {
      const [detail, tokenList, connectionList] = await Promise.all([
        api.getHousehold(householdId),
        api.listTokens().catch(() => ({ tokens: [] as TokenSummary[] })),
        // Absent on pre-rails servers; the card just shows the empty state.
        api.getConnections().catch(() => ({ connections: [] })),
      ]);
      setName(detail.household.name);
      setPostalCode(detail.household.postal_code);
      setCountryCode(detail.household.country_code);
      setPreferredRetailerKey(detail.household.preferred_retailer_key);
      setMembers(detail.members);
      setProfile({
        ...detail.dietary_profile,
        notes: detail.dietary_profile.notes ?? '',
      });
      setTokens(tokenList.tokens);
      setConnections(connectionList.connections);
      setError(null);
      // Retailer list is best-effort; the picker just shows keys if it fails.
      api
        .getRetailers({ household_id: householdId })
        // The upstream list can repeat a storefront (two "Save A Lot" entries
        // shipped this way). retailer_key is the identity, so collapse on it.
        .then((data) => setRetailers(dedupeByRetailerKey(data.retailers)))
        .catch(() => {});
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoaded(true);
    }
  }, [householdId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveHousehold = async () => {
    if (!householdId) return;
    setSavingHousehold(true);
    try {
      await api.updateHousehold(householdId, {
        name: name.trim(),
        postal_code: postalCode.trim(),
        country_code: countryCode,
      });
      await refreshMe();
      flash(setSuccess, 'Household saved.');
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingHousehold(false);
    }
  };

  const chooseRetailer = async (key: string | null) => {
    if (!householdId) return;
    const previous = preferredRetailerKey;
    setPreferredRetailerKey(key);
    try {
      await api.updateHousehold(householdId, { preferred_retailer_key: key });
      await refreshMe();
      setError(null);
    } catch (err) {
      setPreferredRetailerKey(previous);
      setError(getErrorMessage(err));
    }
  };

  const saveProfile = async () => {
    if (!householdId) return;
    setSavingProfile(true);
    try {
      const saved = await api.updateDietaryProfile(householdId, profile);
      setProfile({ ...saved, notes: saved.notes ?? '' });
      flash(setSuccess, 'Dietary profile saved. It now applies to every request.');
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleHealthFilter = (filter: HealthFilter) => {
    setProfile((prev) => ({
      ...prev,
      health_filters: prev.health_filters.includes(filter)
        ? prev.health_filters.filter((f) => f !== filter)
        : [...prev.health_filters, filter],
    }));
  };

  const generateInvite = async () => {
    if (!householdId) return;
    setCreatingInvite(true);
    try {
      setInvite(await api.createInvite(householdId));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyToken = async () => {
    if (!newToken) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(newToken);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 2500);
      }
    } catch {
      // Selection fallback is always available — the token text stays selectable.
    }
  };

  const checkPastedToken = async () => {
    const candidate = verifyInput.trim();
    if (!candidate || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { valid } = await api.verifyToken(candidate);
      setVerifyResult(valid ? 'valid' : 'invalid');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const createToken = async () => {
    const trimmed = tokenName.trim();
    if (!trimmed) return;
    setCreatingToken(true);
    try {
      const created = await api.createToken(trimmed);
      setNewToken(created.token);
      setTokenCopied(false);
      setTokenName('');
      setTokens(await api.listTokens().then((r) => r.tokens));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCreatingToken(false);
    }
  };

  const removeToken = async (id: string) => {
    try {
      await api.deleteToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const removeConnection = async (provider: string) => {
    try {
      await api.disconnectProvider(provider);
      setConnections((prev) => prev.filter((c) => c.provider !== provider));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (!loaded) {
    return <LoadingView message="Loading household…" />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: p.background }]}
      contentContainerStyle={[styles.container, { paddingBottom: bottomInset }]}
    >
      <View style={styles.header}>
        <EyebrowChip label="Your household" onCanvas />
        <DisplayTitle
          text="Set your kitchen’s rules."
          emphasis="rules"
          size={34}
          style={styles.headerTitle}
        />
      </View>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <Card elevated style={styles.section}>
        <DisplayTitle text="Household" size={20} color={p.text} style={styles.cardTitle} />
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="Postal code"
          value={postalCode}
          onChangeText={setPostalCode}
          autoCapitalize="characters"
          helperText="Used to find Instacart retailers near you."
        />
        <Text style={[styles.fieldLabel, { color: p.textMuted }]}>COUNTRY</Text>
        <View style={styles.chipRow}>
          {(['US', 'CA'] as const).map((code) => (
            <Chip
              key={code}
              label={code}
              selected={countryCode === code}
              onPress={() => setCountryCode(code)}
            />
          ))}
        </View>
        <Button title="Save household" onPress={saveHousehold} loading={savingHousehold} />
      </Card>

      <Card elevated style={styles.section}>
        <DisplayTitle text="Preferred retailer" size={20} color={p.text} style={styles.cardTitle} />
        <Text style={[styles.helperText, { color: p.textMuted }]}>
          Carts are built for this store. You can still change stores on Instacart at checkout.
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="No preference"
            selected={preferredRetailerKey === null}
            onPress={() => chooseRetailer(null)}
          />
          {retailers.map((retailer) => (
            <Chip
              key={retailer.retailer_key}
              label={retailer.name}
              selected={preferredRetailerKey === retailer.retailer_key}
              onPress={() => chooseRetailer(retailer.retailer_key)}
            />
          ))}
          {retailers.length === 0 && preferredRetailerKey ? (
            <Chip label={prettifyRetailerKey(preferredRetailerKey)} selected onPress={() => {}} />
          ) : null}
        </View>
      </Card>

      <Card elevated style={styles.section}>
        <DisplayTitle text="Dietary profile" size={20} color={p.text} style={styles.cardTitle} />
        <Text style={[styles.helperText, { color: p.textMuted }]}>
          Applied automatically to every request from anyone in the household.
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabelWrap}>
            <Text style={[styles.switchLabel, { color: p.text }]}>Prefer organic</Text>
            <Text style={[styles.helperText, { color: p.textMuted }]}>
              Adds the organic filter to produce, meat, dairy, and eggs — even when you don’t say
              “organic.”
            </Text>
          </View>
          <Toggle
            value={profile.prefer_organic}
            onValueChange={(value) => setProfile((prev) => ({ ...prev, prefer_organic: value }))}
            accessibilityLabel="Prefer organic"
          />
        </View>

        <TagInput
          label="Preferred brands"
          values={profile.preferred_brands}
          onChange={(preferred_brands) => setProfile((prev) => ({ ...prev, preferred_brands }))}
          placeholder="e.g. Stonyfield"
          helperText="Attached to matching items when relevant."
        />
        <TagInput
          label="Excluded ingredients"
          values={profile.excluded_ingredients}
          onChange={(excluded_ingredients) =>
            setProfile((prev) => ({ ...prev, excluded_ingredients }))
          }
          placeholder="e.g. seed oils"
        />
        <TagInput
          label="Allergens"
          values={profile.allergens}
          onChange={(allergens) => setProfile((prev) => ({ ...prev, allergens }))}
          placeholder="e.g. peanuts"
          helperText={ALLERGEN_HONESTY_COPY}
        />

        <Text style={[styles.fieldLabel, { color: p.textMuted }]}>ALWAYS-ON FILTERS</Text>
        <View style={styles.chipRow}>
          {HEALTH_FILTERS.map((filter) => (
            <Chip
              key={filter}
              label={prettifyFilterValue(filter)}
              selected={profile.health_filters.includes(filter)}
              onPress={() => toggleHealthFilter(filter)}
            />
          ))}
        </View>

        <Field
          label="Notes"
          value={profile.notes}
          onChangeText={(notes) => setProfile((prev) => ({ ...prev, notes }))}
          placeholder="Anything else MC Peels should know when picking items"
          multiline
          numberOfLines={3}
          style={styles.notesInput}
        />
        <Button title="Save dietary profile" onPress={saveProfile} loading={savingProfile} />
      </Card>

      <Card elevated style={styles.section}>
        <DisplayTitle text="Members" size={20} color={p.text} style={styles.cardTitle} />
        {members.map((member) => (
          <View key={member.user_id} style={styles.memberRow}>
            <Text style={[styles.memberName, { color: p.text }]}>
              {member.user_id === myUserId ? 'You' : `Member ${member.user_id.slice(0, 8)}`}
            </Text>
            <Text style={[styles.memberMeta, { color: p.textMuted }]}>
              {member.role} · joined {formatDate(member.joined_at)}
            </Text>
          </View>
        ))}
        {invite ? (
          <View style={[styles.inviteBox, { backgroundColor: p.tintSoft }]}>
            <Text style={[styles.inviteCode, { color: p.tint }]}>{invite.code}</Text>
            <Text style={[styles.helperText, { color: p.textMuted }]}>
              Share this code — it lets someone join the household until{' '}
              {formatDate(invite.expires_at)}.
            </Text>
          </View>
        ) : null}
        <Button
          title="Generate invite code"
          variant="secondary"
          onPress={generateInvite}
          loading={creatingInvite}
        />
      </Card>

      <Card elevated style={styles.section}>
        <DisplayTitle text="Connected services" size={20} color={p.text} style={styles.cardTitle} />
        <Text style={[styles.helperText, { color: p.textMuted }]}>
          Linked store accounts let MC Peels fill a cart for you there — you still review and pay
          on the store’s own site.
        </Text>
        {connections.length === 0 ? (
          <Text style={[styles.helperText, { color: p.textMuted }]}>
            Nothing linked yet. Open any cart and tap “Connect Kroger” in the price comparison.
          </Text>
        ) : (
          connections.map((conn) => (
            <View key={conn.provider} style={styles.memberRow}>
              <View style={styles.tokenInfo}>
                <Text style={[styles.memberName, { color: p.text }]}>
                  {prettifyRetailerKey(conn.provider)}
                </Text>
                <Text style={[styles.memberMeta, { color: p.textMuted }]}>
                  connected {formatDate(conn.connected_at)}
                </Text>
              </View>
              <Button
                title="Disconnect"
                variant="danger"
                onPress={() => removeConnection(conn.provider)}
                style={styles.revokeButton}
              />
            </View>
          ))
        )}
      </Card>

      <Card elevated style={styles.section}>
        <DisplayTitle text="Agent access (MCP)" size={20} color={p.text} style={styles.cardTitle} />
        <Text style={[styles.helperText, { color: p.textMuted }]}>
          Personal access tokens let an AI assistant (like Chief of Staff) build carts as you.
          Agents only ever get checkout links — a human always completes the purchase.
        </Text>
        {newToken ? (
          <View style={[styles.inviteBox, { backgroundColor: p.tintSoft }]}>
            <Text style={[styles.tokenValue, { color: p.tint }]} selectable>
              {newToken}
            </Text>
            {Platform.OS === 'web' ? (
              <Button
                title={tokenCopied ? 'Copied!' : 'Copy token'}
                onPress={copyToken}
                icon="copy-outline"
              />
            ) : null}
            <Text style={[styles.helperText, { color: p.textMuted }]}>
              Use the button — a hand-selected copy can silently miss characters, and the token
              won’t be shown again.
            </Text>
          </View>
        ) : null}
        {tokens.map((token) => (
          <View key={token.id} style={styles.memberRow}>
            <View style={styles.tokenInfo}>
              <Text style={[styles.memberName, { color: p.text }]}>{token.name}</Text>
              <Text style={[styles.memberMeta, { color: p.textMuted }]}>
                {token.last_used_at
                  ? `last used ${formatDate(token.last_used_at)}`
                  : 'never used'}
              </Text>
            </View>
            <Button
              title="Revoke"
              variant="danger"
              onPress={() => removeToken(token.id)}
              style={styles.revokeButton}
            />
          </View>
        ))}
        <Field
          label="New token name"
          value={tokenName}
          onChangeText={setTokenName}
          placeholder="e.g. Chief of Staff"
        />
        <Button
          title="Create token"
          variant="secondary"
          onPress={createToken}
          loading={creatingToken}
          disabled={tokenName.trim().length === 0}
        />

        <Text style={[styles.helperText, styles.verifyIntro, { color: p.textMuted }]}>
          Not sure a copy took? Paste it here to check it against MC Peels before giving it to
          your agent.
        </Text>
        <Field
          label="Paste-check a token"
          value={verifyInput}
          onChangeText={(v: string) => {
            setVerifyInput(v);
            setVerifyResult(null);
          }}
          placeholder="mcp_…"
          autoCapitalize="none"
        />
        <Button
          title="Check token"
          variant="secondary"
          onPress={checkPastedToken}
          loading={verifying}
          disabled={verifyInput.trim().length === 0}
        />
        {verifyResult === 'valid' ? (
          <SuccessBanner message="Token checks out — safe to paste into your agent." />
        ) : null}
        {verifyResult === 'invalid' ? (
          <ErrorBanner message="No match. That string is not a working token — re-copy it with the Copy button and check again." />
        ) : null}
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} style={styles.signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    padding: 16,
    paddingBottom: 48,
    gap: 14,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: 12,
    marginBottom: 2,
  },
  headerTitle: {
    marginTop: 2,
  },
  section: {
    gap: 4,
  },
  cardTitle: {
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  switchLabelWrap: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberMeta: {
    fontSize: 13,
  },
  tokenInfo: {
    flex: 1,
  },
  revokeButton: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  inviteBox: {
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    gap: 4,
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
  },
  tokenValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    // One click grabs the whole token on web — partial hand-selections of
    // this string are how "the token never worked" happened.
    userSelect: 'all',
    marginBottom: 10,
  },
  verifyIntro: {
    marginTop: 16,
  },
  signOut: {
    marginTop: 4,
  },
});
