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
          title: 'Ask',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: 'The Book',
          headerShown: false,
          // Playground is live for the household; EXPO_PUBLIC_SOVIET_BOOK=0
          // is the kill switch that hides it from the tab bar again.
          href: process.env.EXPO_PUBLIC_SOVIET_BOOK === '0' ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
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
