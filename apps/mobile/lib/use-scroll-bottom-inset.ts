/**
 * The one place that knows how much room the bottom chrome needs.
 *
 * Every scroll container in the app was clipping its last rows under the tab
 * bar. Rather than have every screen remember the arithmetic, they ask for a
 * number.
 *
 * Two things worth knowing, both verified against expo-router's vendored
 * bottom-tabs source rather than assumed:
 *
 * 1. `getTabBarHeight()` returns `TABBAR_HEIGHT_UIKIT + insets.bottom` — the
 *    safe-area inset is ALREADY in it. Adding `insets.bottom` on top (as is
 *    the obvious guess) double-counts the home indicator, ~34px of dead space
 *    on a modern iPhone. So inside the tabs we use the height alone.
 * 2. `useBottomTabBarHeight()` THROWS outside a bottom-tab navigator, which is
 *    where detail routes (`cart/[id]`, `restaurant/[id]`) live. We read the
 *    context directly and fall back, so this hook is safe to call anywhere.
 *
 * Note: expo-router v57 vendors React Navigation — `@react-navigation/bottom-tabs`
 * is NOT resolvable in this project. `expo-router/tabs` is the import path.
 */

import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Breathing room below the last row so content never ends flush against chrome. */
const GUTTER = 24;

/**
 * Bottom padding for a scroll container's `contentContainerStyle`.
 *
 * @param extra additional space beyond the standard gutter — for screens with a
 *   pinned footer action (the kitchen order bar, the cart's checkout bar).
 */
export function useScrollBottomInset(extra = 0): number {
  // useContext rather than useBottomTabBarHeight() so detail routes outside the
  // tab navigator get a fallback instead of a thrown error.
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();

  // Inside tabs the bar's height already covers the safe area. Outside it,
  // the inset is the only thing between content and the home indicator.
  const chrome = tabBarHeight ?? insets.bottom;

  return chrome + GUTTER + extra;
}
