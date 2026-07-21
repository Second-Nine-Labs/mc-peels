import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BananaRain } from '@/components/BananaRain';
import { MascotMark } from '@/components/MascotMark';
import { OffersSection } from '@/components/offers';
import {
  Button,
  DisplayTitle,
  ErrorBanner,
  HeroStat,
  LoadingView,
  SectionTitle,
  StatusChip,
} from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { getRememberedCart } from '@/lib/cart-cache';
import { formatDate, prettifyFilterValue, prettifyRetailerKey } from '@/lib/format';
import { usePalette } from '@/lib/theme';
import { useScrollBottomInset } from '@/lib/use-scroll-bottom-inset';
import type { CartDetailResponse, CartStatus, Offer, ResolvedLineItem } from '@/lib/types';

// Price comparison is live by default; EXPO_PUBLIC_PRICE_COMPARE=0 is the
// kill switch back to the single Instacart button (SOVIET_BOOK pattern).
const PRICE_COMPARE_OFF = process.env.EXPO_PUBLIC_PRICE_COMPARE === '0';

interface CartView {
  id: string;
  title: string;
  instacartUrl: string | null;
  retailerLabel: string | null;
  status: CartStatus | undefined;
  createdAt: string | undefined;
  lineItems: ResolvedLineItem[];
  offers: Offer[];
  notes: string[];
}

/**
 * Normalize the GET /carts/:id envelope (flat or { cart } wrapper, line_items
 * or resolved_line_items) and merge in the remembered POST /carts result so
 * the "what MC Peels applied" notes always show right after building a cart.
 */
function toView(id: string, detail: CartDetailResponse | null): CartView | null {
  const remembered = getRememberedCart(id);
  if (!detail && !remembered) return null;

  const flat = detail?.cart ?? detail ?? {};
  const lineItems =
    detail?.line_items ??
    detail?.resolved_line_items ??
    remembered?.resolved_line_items ??
    [];
  const retailerName =
    detail?.retailer?.name ??
    remembered?.retailer?.name ??
    (flat.retailer_key ? prettifyRetailerKey(flat.retailer_key) : null);

  return {
    id,
    // The request line is the only text that says what this cart IS. The stored
    // `title` is "MC Peels · <date>" — branding for the Instacart page, useless
    // as our H1, and identical across every cart. Prefer the request; fall back
    // to the stored title only for carts that somehow have no request text.
    title: flat.request_text?.trim() || flat.title?.trim() || 'Grocery cart',
    instacartUrl: flat.instacart_url ?? remembered?.instacart_url ?? null,
    retailerLabel: retailerName,
    status: flat.status,
    createdAt: flat.created_at,
    lineItems,
    offers: detail?.offers ?? remembered?.offers ?? [],
    notes: detail?.notes ?? remembered?.notes ?? [],
  };
}

export default function CartDetailScreen() {
  const p = usePalette();
  const bottomInset = useScrollBottomInset();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [cart, setCart] = useState<CartView | null>(() => toView(id, null));
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [opening, setOpening] = useState(false);
  const [bananaBurst, setBananaBurst] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getCart(id)
      .then((detail) => {
        if (!cancelled) {
          setCart(toView(id, detail));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const openInInstacart = useCallback(async () => {
    if (!cart?.instacartUrl) return;
    setOpening(true);
    // Celebrate the hand-off — a little rain of bananas.
    setBananaBurst((n) => n + 1);
    try {
      await Linking.openURL(cart.instacartUrl);
      // Best-effort local status only — Instacart reports no order state back.
      api
        .markCartOpened(cart.id)
        .then(() => setCart((prev) => (prev ? { ...prev, status: 'opened' } : prev)))
        .catch(() => {});
    } catch {
      setError('Could not open the Instacart link on this device.');
    } finally {
      setOpening(false);
    }
  }, [cart]);

  if (!cart && !loaded) {
    return <LoadingView message="Loading cart…" />;
  }

  if (!cart) {
    return (
      <View style={[styles.screen, { backgroundColor: p.background }]}>
        <View style={[styles.container, styles.hero]}>
          {/* Same back control, same place — a cart that failed to load is
              exactly when you most need the way out to be where you expect. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to carts"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/ask'))}
            hitSlop={8}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={20} color={p.onBg} />
            <Text style={[styles.backText, { color: p.onBg }]}>Carts</Text>
          </Pressable>
          <ErrorBanner message={error ?? 'Cart not found.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.container, { paddingBottom: bottomInset }]}
      >
        {/* Hero — lives on the blue canvas, recipe-app style. */}
        <View style={styles.hero}>
          {/* Detail screens sit inside the tab group now, so the nav stays put
              while you're in a cart. A Tabs navigator has no back button of its
              own, so the screen owns one — which also puts the affordance in the
              same place at the same size on every detail screen (review §2). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to carts"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/ask'))}
            hitSlop={8}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={20} color={p.onBg} />
            <Text style={[styles.backText, { color: p.onBg }]}>Carts</Text>
          </Pressable>
          <ErrorBanner message={error} />
          {/* The eyebrow used to read "Ready to check out" unconditionally —
              redundant beside StatusChip, and a lie for any cart that isn't
              ready. StatusChip is the one that actually tracks status. */}
          <View style={styles.header}>
            <DisplayTitle
              text={cart.title}
              // Request text has no length ceiling; step down and clamp so a
              // long grocery list stays a headline instead of a wall.
              size={cart.title.length > 64 ? 22 : cart.title.length > 34 ? 26 : 30}
              numberOfLines={3}
              style={styles.title}
            />
            <StatusChip status={cart.status} />
          </View>

          <View style={styles.stats}>
            {cart.createdAt ? (
              <HeroStat icon="time-outline" label={`Built ${formatDate(cart.createdAt)}`} />
            ) : null}
            {cart.retailerLabel ? (
              <HeroStat icon="storefront-outline" label={cart.retailerLabel} />
            ) : null}
            {cart.lineItems.length > 0 ? (
              <HeroStat
                icon="basket-outline"
                label={`${cart.lineItems.length} item${cart.lineItems.length === 1 ? '' : 's'}`}
              />
            ) : null}
          </View>

          {PRICE_COMPARE_OFF && cart.instacartUrl ? (
            <View style={styles.checkout}>
              <Button
                title="Open in Instacart"
                icon="cart-outline"
                variant="accent"
                onPress={openInInstacart}
                loading={opening}
              />
              <Text style={[styles.checkoutNote, { color: p.onBgMuted }]}>
                You’ll review and pay on Instacart — MC Peels never handles payment.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Content sheet — white panel sliding over the canvas. */}
        <View style={[styles.sheet, { backgroundColor: p.card }]}>
          <View style={styles.sheetMascot}>
            <MascotMark size={64} />
          </View>

          {!PRICE_COMPARE_OFF ? (
            <View style={styles.section}>
              <OffersSection
                cartId={cart.id}
                initialOffers={cart.offers}
                onInstacartOpen={openInInstacart}
                instacartOpening={opening}
              />
            </View>
          ) : null}

          {!PRICE_COMPARE_OFF && cart.notes.length > 0 ? (
            <View style={[styles.divider, { backgroundColor: p.border }]} />
          ) : null}

          {cart.notes.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle>What MC Peels applied</SectionTitle>
              {cart.notes.map((note, index) => (
                <View key={index} style={styles.noteRow}>
                  <Ionicons
                    name="sparkles-outline"
                    size={15}
                    color={p.tint}
                    style={styles.noteIcon}
                  />
                  <Text style={[styles.noteText, { color: p.text }]}>{note}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {cart.notes.length > 0 && cart.lineItems.length > 0 ? (
            <View style={[styles.divider, { backgroundColor: p.border }]} />
          ) : null}

          {cart.lineItems.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle>Items</SectionTitle>
              {cart.lineItems.map((item, index) => {
                const quantityLabel = item.quantity !== null
                  ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
                  : null;
                return (
                  <View
                    key={`${item.name}-${index}`}
                    style={[
                      styles.itemRow,
                      { borderBottomColor: p.border },
                      index === 0 ? { borderTopWidth: 1, borderTopColor: p.border } : null,
                    ]}
                  >
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderLeft}>
                        <View style={[styles.check, { backgroundColor: p.success }]}>
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        </View>
                        <Text style={[styles.itemName, { color: p.text }]}>{item.display_text}</Text>
                      </View>
                      {quantityLabel ? (
                        <Text style={[styles.itemQuantity, { color: p.textMuted }]}>{quantityLabel}</Text>
                      ) : null}
                    </View>
                    {item.applied_filters.health_filters.length > 0 ||
                    item.applied_filters.brand_filters.length > 0 ? (
                      <View style={styles.tagRow}>
                        {item.applied_filters.health_filters.map((filter) => {
                          const organic = filter.toLowerCase().includes('organic');
                          return (
                            <View
                              key={filter}
                              style={[
                                styles.tag,
                                { backgroundColor: organic ? p.successSoft : p.accentSoft },
                              ]}
                            >
                              <Text
                                style={[styles.tagText, { color: organic ? p.success : '#9A6B00' }]}
                              >
                                {prettifyFilterValue(filter)}
                              </Text>
                            </View>
                          );
                        })}
                        {item.applied_filters.brand_filters.map((brand) => (
                          <View key={brand} style={[styles.tag, { backgroundColor: p.accentSoft }]}>
                            <Text style={[styles.tagText, { color: '#9A6B00' }]}>{brand}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {item.warnings.map((warning, warningIndex) => (
                      <View key={warningIndex} style={styles.warningRow}>
                        <Ionicons name="warning-outline" size={14} color={p.danger} />
                        <Text style={[styles.warningText, { color: p.danger }]}>{warning}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : null}

          {cart.notes.length === 0 && cart.lineItems.length === 0 ? (
            <Text style={[styles.sheetEmpty, { color: p.textMuted }]}>
              Cart details will appear here.
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <BananaRain burstKey={bananaBurst} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flexGrow: 1,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: -6,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 15, fontWeight: '700' },
  hero: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 30,
    gap: 14,
  },
  stats: {
    gap: 10,
    marginTop: 2,
  },
  sheet: {
    borderRadius: 24,
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
    boxShadow: '0px 12px 26px rgba(21, 34, 56, 0.10)',
  },
  sheetMascot: {
    position: 'absolute',
    // MascotMark's `size` is its WIDTH; height is size / (613/720), so a size-64
    // mark is ~75pt tall. At the old top:-36 it reached y=+39, well past the
    // sheet's paddingTop of 22 — landing on OffersSection's right-aligned
    // "Refresh prices". -60 puts its base at ~15, clearing the content start.
    top: -60,
    right: 20,
  },
  divider: {
    height: 1,
    marginVertical: 18,
  },
  sheetEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
  },
  checkout: {
    gap: 8,
    marginVertical: 4,
  },
  checkoutNote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  section: {
    marginTop: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  noteIcon: {
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  itemRow: {
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  itemQuantity: {
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 34,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingLeft: 34,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
