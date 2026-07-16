/**
 * Generated art for the static trio (Столовая / greenhouse / La Milpa).
 *
 * On focus: fetch the kitchen's cached tiles, register them, and kick
 * generation for any dish still missing one — the same generate-and-cache
 * loop the Shelf uses, just keyed by (kitchenId, dishId). Tiles light up as
 * each dish's art lands. Shelf-minted kitchens (`shelf-…`) are skipped: their
 * art rides on the recipe row (Dish.artUrl), not the kitchen bucket.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';

import { registerKitchenArt } from './art';
import type { Dish } from './types';

/** Session-once dedup so revisits don't re-POST a dish already in flight. */
const kicked = new Set<string>();

export function useKitchenArt(kitchenId: string, dishes: Dish[], enabled: boolean): void {
  // Version bump re-renders KitchenScreen so tiles pick up the module map.
  const [, bump] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || kitchenId.startsWith('shelf-')) return;
      let cancelled = false;

      api
        .kitchenArt(kitchenId)
        .then((data) => {
          if (cancelled) return;
          registerKitchenArt(kitchenId, data.art);
          if (Object.keys(data.art).length > 0) bump((v) => v + 1);

          for (const dish of dishes) {
            if (data.art[dish.id]) continue;
            const key = `${kitchenId}/${dish.id}`;
            if (kicked.has(key)) continue;
            kicked.add(key);
            api
              .ensureKitchenDishArt(kitchenId, dish.id, {
                title: dish.name,
                sub: dish.sub ?? undefined,
                description: dish.description ?? undefined,
              })
              .then((result) => {
                if (cancelled || result.status !== 'ok' || !result.art_url) return;
                registerKitchenArt(kitchenId, { [dish.id]: result.art_url });
                bump((v) => v + 1);
              })
              .catch(() => {
                // A missed tile just stays the designed fallback; retry next session.
                kicked.delete(key);
              });
          }
        })
        .catch(() => {
          // Kitchen art unreachable never breaks the menu.
        });

      return () => {
        cancelled = true;
      };
    }, [kitchenId, dishes, enabled]),
  );
}
