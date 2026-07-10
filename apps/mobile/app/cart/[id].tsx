import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BananaRain } from '@/components/BananaRain';
import {
  Button,
  Card,
  ErrorBanner,
  FilterTag,
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
        <View style={styles.container}>
          <ErrorBanner message={error ?? 'Cart not found.'} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={[styles.screen, { backgroundColor: p.background }]}
        contentContainerStyle={styles.container}
      >
        <ErrorBanner message={error} />

      <View style={styles.header}>
        <Text style={[styles.title, { color: p.onBg }]}>{cart.title}</Text>
        <StatusChip status={cart.status} />
      </View>
      <Text style={[styles.meta, { color: p.onBgMuted }]}>
        {[cart.retailerLabel, formatDate(cart.createdAt)].filter(Boolean).join(' · ')}
      </Text>
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

      {cart.notes.length > 0 ? (
        <Card style={styles.section}>
          <SectionTitle>What MC Peels applied</SectionTitle>
          {cart.notes.map((note, index) => (
            <View key={index} style={styles.noteRow}>
              <Ionicons name="sparkles-outline" size={15} color={p.tint} style={styles.noteIcon} />
              <Text style={[styles.noteText, { color: p.text }]}>{note}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {cart.lineItems.length > 0 ? (
        <Card style={styles.section}>
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
        </Card>
      ) : null}
      </ScrollView>
      <BananaRain burstKey={bananaBurst} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
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
  meta: {
    fontSize: 14,
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
