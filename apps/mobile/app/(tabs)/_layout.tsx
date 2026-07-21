import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { AppNav, NAV_BREAKPOINT } from '@/components/AppNav';
import { usePalette } from '@/lib/theme';

export default function TabsLayout() {
  const p = usePalette();
  // useWindowDimensions re-renders on resize; Dimensions.get() reads once and
  // would strand a desktop header on a window that has since narrowed.
  const { width } = useWindowDimensions();
  const isDesktop = width >= NAV_BREAKPOINT;

  return (
    <Tabs
      screenOptions={{
        // Tab roots never show a stack header — each owns its in-page header.
        // Household used to be the exception, carrying a redundant "Household"
        // bar above a page that already says "Set your kitchen's rules".
        headerShown: false,
        // BottomTabView places the bar before or after the screens based on
        // this, so one AppNav element lands at the top on desktop and the
        // bottom on mobile. It also drives the height context screens read for
        // their bottom inset — published as 0 when the bar is on top, which is
        // correct: nothing sits at the bottom to clear.
        tabBarPosition: isDesktop ? 'top' : 'bottom',
        sceneStyle: { backgroundColor: p.background },
      }}
      tabBar={(props) => <AppNav {...props} variant={isDesktop ? 'header' : 'bottom'} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          // Your personalized feed of restaurant kitchens, grown from the shelf.
          title: 'Kitchens',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          // The cart flow: build a new cart AND browse the household's cart
          // history (the old standalone Carts tab folded in here).
          title: 'New cart',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basket-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Cart detail lives inside the group so the nav stays visible — you never
          lose your place mid-cart. `(tabs)` contributes no URL segment, so the
          route is still /cart/<id>; every existing link and the Kroger OAuth
          return leg keep working. href: null keeps it out of the bar itself. */}
      <Tabs.Screen name="cart/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          // Settings sit on the neutral canvas, not the bold blue (review §6).
          // The scene style has to move with the screen or an overscroll bounce
          // reveals the blue the screen has just stepped off.
          sceneStyle: { backgroundColor: p.canvas },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
