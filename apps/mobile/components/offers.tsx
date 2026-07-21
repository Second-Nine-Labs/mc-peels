/**
 * "Where to shop" — the price-comparison and multi-service handoff section on
 * the cart screen (parallel-rails plan).
 *
 * Honesty rules, enforced visually:
 *  - Only real quotes show a number ("items subtotal · shelf prices at {store}").
 *    Services without a price API say "Prices at checkout" — never an estimate.
 *  - Partial matches are labeled ("9 of 11 items priced") and every match is
 *    inspectable, with confidence tags and size warnings.
 *  - Every handoff ends on the service's own site: the human reviews and pays
 *    there. MC Peels never handles payment.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { ApiError, api, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatTimeOfDay, formatUnitPrice } from '@/lib/format';
import { startKrogerConnect } from '@/lib/kroger-connect';
import { usePalette } from '@/lib/theme';
import type { Offer, OfferItemMatch } from '@/lib/types';

/** Recognizable service tints for the letter badges (no trademark art). */
const BRAND_COLORS: Record<string, string> = {
  instacart: '#43B02A',
  kroger: '#0B57A4',
  doordash: '#FF3008',
  ubereats: '#06C167',
};

interface OffersSectionProps {
  cartId: string;
  initialOffers: Offer[];
  /** The existing Instacart open path (banana rain + markCartOpened). */
  onInstacartOpen: () => void;
  instacartOpening: boolean;
}

interface PushResult {
  url: string;
  notes: string[];
}

function offerNeedsRefresh(offer: Offer): boolean {
  if (offer.status === 'pending') return true;
  if (!offer.capabilities.quote) return false;
  if (offer.status === 'quoted' && offer.expires_at) {
    return new Date(offer.expires_at).getTime() < Date.now();
  }
  return offer.status === 'failed';
}

export function OffersSection({
  cartId,
  initialOffers,
  onInstacartOpen,
  instacartOpening,
}: OffersSectionProps) {
  const p = usePalette();
  const params = useLocalSearchParams<{ kroger?: string; reason?: string }>();

  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [connectBusy, setConnectBusy] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const refresh = useCallback(
    async (force: boolean) => {
      setRefreshing(true);
      setError(null);
      try {
        const result = await api.refreshOffers(cartId, force ? { force: true } : {});
        setOffers(result.offers);
        setConnections(result.connections);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setRefreshing(false);
      }
    },
    [cartId],
  );

  // Adopt fresher initial offers when the cart detail loads after mount.
  useEffect(() => {
    setOffers((prev) => (prev.length === 0 ? initialOffers : prev));
  }, [initialOffers]);

  // Bootstrap: pull real quotes when anything is pending/stale, otherwise
  // just learn which accounts are linked.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const needsQuotes = initialOffers.length === 0 || initialOffers.some(offerNeedsRefresh);
    if (needsQuotes) {
      void refresh(false);
    } else {
      api
        .getConnections()
        .then((res) =>
          setConnections(Object.fromEntries(res.connections.map((c) => [c.provider, true]))),
        )
        .catch(() => {});
    }
  }, [initialOffers, refresh]);

  // Handle the OAuth return leg (web: /cart/<id>?kroger=connected).
  useEffect(() => {
    if (!params.kroger) return;
    if (params.kroger === 'connected') {
      setConnections((prev) => ({ ...prev, kroger: true }));
    } else if (params.kroger === 'error') {
      setError(`Kroger connect failed (${params.reason ?? 'unknown'}). Try again.`);
    }
    router.setParams({ kroger: undefined, reason: undefined });
  }, [params.kroger, params.reason]);

  const connectKroger = useCallback(async () => {
    setConnectBusy(true);
    setError(null);
    try {
      const outcome = await startKrogerConnect(cartId);
      if (outcome.type === 'connected') {
        setConnections((prev) => ({ ...prev, kroger: true }));
      } else if (outcome.type === 'error') {
        setError(`Kroger connect failed (${outcome.reason}). Try again.`);
      }
      // 'redirecting': the page is navigating away — leave the spinner on.
      if (outcome.type !== 'redirecting') setConnectBusy(false);
    } catch (err) {
      setError(getErrorMessage(err));
      setConnectBusy(false);
    }
  }, [cartId]);

  const pushToKroger = useCallback(async () => {
    setPushing(true);
    setError(null);
    try {
      const result = await api.krogerHandoff(cartId);
      setPushResult({ url: result.handoff_url, notes: result.notes });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'not_connected') {
        setConnections((prev) => ({ ...prev, kroger: false }));
      }
      setError(getErrorMessage(err));
    } finally {
      setPushing(false);
    }
  }, [cartId]);

  const openLink = useCallback((url: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => setError('Could not open the link on this device.'));
  }, []);

  if (offers.length === 0) {
    // Pre-rails server or quotes still seeding: keep the classic handoff alive.
    return (
      <View style={styles.section}>
        {refreshing ? (
          <View style={styles.pendingRow}>
            <ActivityIndicator color={p.tint} />
            <Text style={[styles.pendingText, { color: p.textMuted }]}>Checking services…</Text>
          </View>
        ) : (
          <View style={styles.fallback}>
            <Button
              title="Open in Instacart"
              icon="cart-outline"
              variant="accent"
              onPress={onInstacartOpen}
              loading={instacartOpening}
            />
            <Text style={[styles.footer, { color: p.textMuted }]}>
              You’ll review and pay on Instacart — MC Peels never handles payment.
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: p.text }]}>Where to shop</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => refresh(true)}
          disabled={refreshing}
          style={styles.refreshButton}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={p.tint} />
          ) : (
            <Ionicons name="refresh-outline" size={16} color={p.tint} />
          )}
          <Text style={[styles.refreshText, { color: p.tint }]}>
            {refreshing ? 'Updating…' : 'Refresh prices'}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: p.danger }]}>{error}</Text> : null}

      {offers.map((offer, offerIndex) => {
        // Review §3a: the preferred retailer gets the accent fill; every
        // alternate is outlined. Two equal-weight fills mean neither is the
        // default. Offers arrive in the household's configured display order,
        // so the first IS the preferred one.
        const preferred = offerIndex === 0;
        const handoff: 'accent' | 'outline' = preferred ? 'accent' : 'outline';
        return (
        <OfferCard
          key={offer.provider}
          offer={offer}
          expanded={expanded === offer.provider}
          onToggleExpand={() =>
            setExpanded((prev) => (prev === offer.provider ? null : offer.provider))
          }
          refreshing={refreshing && (offer.status === 'pending' || offer.capabilities.quote)}
          cta={
            offer.provider === 'instacart' ? (
              <Button
                title="Open in Instacart"
                icon="cart-outline"
                variant={handoff}
                onPress={onInstacartOpen}
                loading={instacartOpening}
              />
            ) : offer.provider === 'kroger' ? (
              pushResult ? (
                <Button
                  title="Open Kroger cart"
                  icon="open-outline"
                  variant={handoff}
                  onPress={() => openLink(pushResult.url)}
                />
              ) : connections.kroger ? (
                <Button
                  title="Send to Kroger cart"
                  icon="cart-outline"
                  variant={handoff}
                  onPress={pushToKroger}
                  loading={pushing}
                  disabled={offer.status !== 'quoted'}
                />
              ) : offer.status === 'failed' && !offer.store ? (
                // No store near the postal code, so there is nothing to connect
                // an account TO. Offering "Connect Kroger" beside "No quote"
                // read as a contradiction (review §5 #11). The offer's own notes
                // already explain why it came back empty.
                null
              ) : (
                <Button
                  title="Connect Kroger"
                  icon="link-outline"
                  variant="primary"
                  onPress={connectKroger}
                  loading={connectBusy}
                />
              )
            ) : (
              <Button
                title={`Shop on ${offer.display_name}`}
                icon="open-outline"
                variant={handoff}
                onPress={() => openLink(offer.handoff_url)}
              />
            )
          }
          extraNotes={offer.provider === 'kroger' && pushResult ? pushResult.notes : []}
        />
        );
      })}

      <Text style={[styles.footer, { color: p.textMuted }]}>
        You always review and pay on the store’s site — MC Peels never handles payment.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

interface OfferCardProps {
  offer: Offer;
  expanded: boolean;
  onToggleExpand: () => void;
  refreshing: boolean;
  cta: React.ReactNode;
  extraNotes: string[];
}

function OfferCard({ offer, expanded, onToggleExpand, refreshing, cta, extraNotes }: OfferCardProps) {
  const p = usePalette();
  const brand = BRAND_COLORS[offer.provider] ?? p.primary;
  const partial = offer.status === 'quoted' && offer.matched_count < offer.total_count;

  return (
    <View style={[styles.card, { borderColor: p.border, backgroundColor: p.card }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: brand }]}>
          <Text style={styles.badgeText}>{offer.display_name.charAt(0)}</Text>
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardTitle, { color: p.text }]}>{offer.display_name}</Text>
          {offer.store?.name ? (
            <Text style={[styles.cardSubtitle, { color: p.textMuted }]} numberOfLines={1}>
              {offer.store.name}
            </Text>
          ) : null}
        </View>
        {offer.status === 'quoted' ? (
          <View style={styles.priceWrap}>
            <Text style={[styles.price, { color: p.text }]}>
              {formatCurrency(offer.subtotal_cents, offer.currency)}
            </Text>
            <Text style={[styles.priceCaption, { color: p.textMuted }]}>items subtotal</Text>
          </View>
        ) : offer.status === 'pending' || refreshing ? (
          <ActivityIndicator color={p.tint} />
        ) : (
          <Text style={[styles.priceCaption, { color: p.textMuted }]}>
            {offer.status === 'failed' ? 'No quote' : 'Prices at checkout'}
          </Text>
        )}
      </View>

      {offer.status === 'quoted' ? (
        <View style={styles.metaRow}>
          {offer.promo_savings_cents > 0 ? (
            <View style={[styles.chip, { backgroundColor: p.successSoft }]}>
              <Text style={[styles.chipText, { color: p.success }]}>
                Save {formatCurrency(offer.promo_savings_cents, offer.currency)} in promos
              </Text>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onToggleExpand} style={styles.matchToggle}>
            <Text style={[styles.matchText, { color: partial ? p.warning : p.textMuted }]}>
              {offer.matched_count} of {offer.total_count} items priced
            </Text>
            {offer.quoted_at ? (
              <Text style={[styles.matchText, { color: p.textMuted }]}>
                {' '}· as of {formatTimeOfDay(offer.quoted_at)}
              </Text>
            ) : null}
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={p.textMuted}
            />
          </Pressable>
        </View>
      ) : null}

      {expanded && offer.status === 'quoted' ? <MatchList matches={offer.item_matches} /> : null}

      {[...offer.notes, ...extraNotes].map((note, i) => (
        <Text key={i} style={[styles.note, { color: p.textMuted }]}>
          {note}
        </Text>
      ))}

      <View style={styles.ctaWrap}>{cta}</View>
    </View>
  );
}

function MatchList({ matches }: { matches: OfferItemMatch[] }) {
  const p = usePalette();
  return (
    <View style={[styles.matchList, { borderTopColor: p.border }]}>
      {matches.map((m, index) => {
        // On promo when the effective (shown) price undercuts the regular price.
        const onPromo =
          m.status === 'matched' &&
          m.promo_price_cents !== null &&
          m.regular_price_cents !== null &&
          m.promo_price_cents < m.regular_price_cents;
        return (
        <View key={`${m.requested_name}-${index}`} style={styles.matchRow}>
          <View style={styles.matchRowHeader}>
            <Text style={[styles.matchName, { color: p.text }]} numberOfLines={1}>
              {m.requested_name}
            </Text>
            {m.status === 'matched' && m.line_total_cents !== null ? (
              <View style={styles.priceCell}>
                <Text style={styles.matchPrice}>
                  {m.quantity > 1 ? `${m.quantity} × ` : ''}
                  {onPromo ? (
                    <Text style={[styles.strikePrice, { color: p.textMuted }]}>
                      {formatCurrency(m.regular_price_cents)}{' '}
                    </Text>
                  ) : null}
                  <Text style={{ color: onPromo ? p.success : p.text }}>
                    {formatCurrency(m.unit_price_cents)}
                  </Text>
                </Text>
                {formatUnitPrice(m.unit_price_cents, m.measure_quantity, m.measure_unit) ? (
                  <Text style={[styles.unitPrice, { color: onPromo ? p.success : p.textMuted }]}>
                    {formatUnitPrice(m.unit_price_cents, m.measure_quantity, m.measure_unit)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={[styles.chip, { backgroundColor: p.chip }]}>
                <Text style={[styles.chipText, { color: p.textMuted }]}>not priced</Text>
              </View>
            )}
          </View>
          {m.status === 'matched' && m.product ? (
            <View style={styles.matchRowHeader}>
              <Text style={[styles.matchProduct, { color: p.textMuted }]} numberOfLines={1}>
                {m.product.description}
                {m.product.size ? ` · ${m.product.size}` : ''}
              </Text>
              {m.confidence === 'medium' ? (
                <View style={[styles.chip, { backgroundColor: p.warningSoft }]}>
                  <Text style={[styles.chipText, { color: p.warning }]}>close match</Text>
                </View>
              ) : m.confidence === 'low' ? (
                <View style={[styles.chip, { backgroundColor: p.dangerSoft }]}>
                  <Text style={[styles.chipText, { color: p.danger }]}>best guess</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {m.warnings.map((warning, wIndex) => (
            <Text key={wIndex} style={[styles.matchWarning, { color: p.warning }]}>
              {warning}
            </Text>
          ))}
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  pendingText: {
    fontSize: 14,
  },
  fallback: {
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12.5,
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: 1,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
  },
  priceCaption: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  matchText: {
    fontSize: 12.5,
  },
  matchList: {
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 10,
  },
  matchRow: {
    gap: 3,
  },
  matchRowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  matchName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  priceCell: {
    alignItems: 'flex-end',
  },
  matchPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  strikePrice: {
    fontSize: 12.5,
    fontWeight: '400',
    textDecorationLine: 'line-through',
  },
  unitPrice: {
    fontSize: 11.5,
    marginTop: 1,
  },
  matchProduct: {
    flex: 1,
    fontSize: 12.5,
  },
  matchWarning: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  ctaWrap: {
    marginTop: 2,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
