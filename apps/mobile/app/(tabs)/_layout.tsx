import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { usePalette } from '@/lib/theme';

export default function TabsLayout() {
  const p = usePalette();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: p.card },
        headerShadowVisible: false,
        headerTitleStyle: { color: p.text },
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border },
        tabBarActiveTintColor: p.tint,
        tabBarInactiveTintColor: p.textMuted,
        sceneStyle: { backgroundColor: p.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          // Your personalized feed of restaurant kitchens, grown from the shelf.
          title: 'Kitchens',
          headerShown: false,
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
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
