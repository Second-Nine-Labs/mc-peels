import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorBanner, LoadingView, StatusChip } from '@/components/ui';
import { api, getErrorMessage } from '@/lib/api';
import { formatDate, prettifyRetailerKey } from '@/lib/format';
import { useSession } from '@/lib/session';
import { usePalette } from '@/lib/theme';
import type { CartSummary } from '@/lib/types';

export default function CartsScreen() {
  const p = usePalette();
  const router = useRouter();
  const { membership, me } = useSession();
  const householdId = membership?.household_id;
  const myUserId = me?.user.id;

  const [carts, setCarts] = useState<CartSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retailerNames, setRetailerNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!householdId) return;
    try {
      const data = await api.listCarts({ household_id: householdId, limit: 50 });
      setCarts(data.carts);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setCarts((previous) => previous ?? []);
    }
  }, [householdId]);

  // Refresh whenever the tab regains focus (e.g. right after building a cart).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Best-effort map of retailer_key -> display name for the feed rows.
  useFocusEffect(
    useCallback(() => {
      if (!householdId) return;
      let cancelled = false;
      api
        .getRetailers({ household_id: householdId })
        .then((data) => {
          if (cancelled) return;
          const names: Record<string, string> = {};
          for (const retailer of data.retailers) {
            names[retailer.retailer_key] = retailer.name;
          }
          setRetailerNames(names);
        })
        .catch(() => {
          // Fall back to prettified retailer keys.
        });
      return () => {
        cancelled = true;
      };
    }, [householdId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (carts === null) {
    return <LoadingView message="Loading your carts…" />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <FlatList
        data={carts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // retailer_key is null for carts built via the partial-success path
          // (no preferred retailer + retailer lookup failed/empty).
          const retailerName = item.retailer_key
            ? (retailerNames[item.retailer_key] ?? prettifyRetailerKey(item.retailer_key))
            : null;
          const createdBy = item.created_by_user_id === myUserId ? 'you' : 'a household member';
          const title = item.title?.trim() || item.request_text?.trim() || 'Grocery cart';
          const meta = [retailerName, formatDate(item.created_at), `by ${createdBy}`]
            .filter(Boolean)
            .join(' · ');

          return (
            <Pressable
              onPress={() => router.push({ pathname: '/cart/[id]', params: { id: item.id } })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={2}>
                  {title}
                </Text>
                <StatusChip status={item.status} />
              </View>
              <Text style={[styles.rowMeta, { color: p.textMuted }]} numberOfLines={1}>
                {meta}
              </Text>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.onBg} />
        }
        ListHeaderComponent={<ErrorBanner message={error} />}
        ListEmptyComponent={
          !error ? (
            <EmptyState
              image={require('../../assets/brand/banana.png')}
              icon="cart-outline"
              title="No carts yet"
              message="Head to the Ask tab and tell MC Peels what you need — your carts and order history will show up here."
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: {
    padding: 16,
    gap: 10,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
  },
  rowMeta: {
    fontSize: 13,
  },
});
