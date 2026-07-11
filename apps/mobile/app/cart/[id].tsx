import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BananaRain } from '@/components/BananaRain';
import { MascotMark } from '@/components/MascotMark';
import {
  Button,
  ErrorBanner,
  FilterTag,
  HeroStat,
  LoadingView,
  SectionTitle,
  StatusChip,
} from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { getRememberedCart } from '@/lib/cart-cache';
import { formatDate, prettifyFilterValue, prettifyRetailerKey } from '@/lib/format';
import { usePalette } from '@/lib/theme';
import type { CartDetailResponse, CartStatus, ResolvedLineItem } from '@/lib/types';

interface CartView {
  id: string;
  title: string;
  instacartUrl: string | null;
  retailerLabel: string | null;
  status: CartStatus | undefined;
  requestText: string | null;
  createdAt: string | undefined;
  lineItems: ResolvedLineItem[];
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
    title: flat.title?.trim() || flat.request_text?.trim() || 'Grocery cart',
    instacartUrl: flat.instacart_url ?? remembered?.instacart_url ?? null,
    retailerLabel: retailerName,
    status: flat.status,
    requestText: flat.request_text ?? null,
    createdAt: flat.created_at,
    lineItems,
    notes: detail?.notes ?? remembered?.notes ?? [],
  };
}

export default function CartDetailScreen() {
  const p = usePalette();
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
          <ErrorBanner message={error ?? 'Cart not found.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {/* Hero — lives on the blue canvas, recipe-app style. */}
        <View style={styles.hero}>
          <ErrorBanner message={error} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: p.onBg }]}>{cart.title}</Text>
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

          {cart.requestText && cart.requestText !== cart.title ? (
            <Text style={[styles.requestText, { color: p.onBgMuted }]}>“{cart.requestText}”</Text>
          ) : null}

          {cart.instacartUrl ? (
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
          <View style={[styles.handle, { backgroundColor: p.border }]} />
          <View style={styles.sheetMascot}>
            <MascotMark size={64} />
          </View>

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
                  index > 0 ? { borderTopWidth: 1, borderTopColor: p.border } : null,
                ]}
              >
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemName, { color: p.text }]}>{item.display_text}</Text>
                  {quantityLabel ? (
                    <Text style={[styles.itemQuantity, { color: p.textMuted }]}>{quantityLabel}</Text>
                  ) : null}
                </View>
                {item.applied_filters.health_filters.length > 0 ||
                item.applied_filters.brand_filters.length > 0 ? (
                  <View style={styles.tagRow}>
                    {item.applied_filters.health_filters.map((filter) => (
                      <FilterTag key={filter} label={prettifyFilterValue(filter)} />
                    ))}
                    {item.applied_filters.brand_filters.map((brand) => (
                      <FilterTag key={brand} label={brand} tone="neutral" />
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
    flexGrow: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 48,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetMascot: {
    position: 'absolute',
    top: -36,
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
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  requestText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
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
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemName: {
    flex: 1,
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
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
