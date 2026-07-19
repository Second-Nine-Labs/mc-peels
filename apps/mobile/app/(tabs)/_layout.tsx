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
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          // The cart flow, named for what it makes — distinct from the home,
          // which is the block (kitchens + menu builder).
          title: 'New cart',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="carts"
        options={{
          title: 'Carts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
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
