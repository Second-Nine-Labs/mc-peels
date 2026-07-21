/**
 * The one navigation surface. Bottom tab bar on phones, top header on desktop.
 *
 * The review's rule: the nav is the single thing that never changes between the
 * blue app and the Eats/Book worlds. Constant chrome is what makes the content
 * shift read as intentional rather than accidental. So there is one component
 * here, not two, and both variants render the same destinations in the same
 * order from the same navigation state.
 *
 * Why a custom `tabBar` rather than `tabBarPosition: 'top'` alone: the desktop
 * header carries a wordmark and an account affordance, which a tab bar has no
 * slot for. Position still comes from `tabBarPosition` — expo-router's
 * BottomTabView places the bar before or after the screens based on it, so the
 * same element lands at the top on desktop and the bottom on mobile.
 *
 * Height reporting matters: BottomTabView seeds its height context from the
 * STANDARD bar formula, which a custom bar won't match. Reporting the measured
 * height through BottomTabBarHeightCallbackContext keeps useScrollBottomInset
 * honest. (On desktop the navigator publishes 0 for the height, which is
 * correct — nothing sits at the bottom to clear.)
 */

import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/tabs';
import { useContext } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { MascotMark } from '@/components/MascotMark';
import { usePalette } from '@/lib/theme';

/** Desktop starts here. Below it, thumbs; above it, a pointer and a wide window. */
export const NAV_BREAKPOINT = 768;

export type AppNavVariant = 'bottom' | 'header';

interface AppNavProps extends BottomTabBarProps {
  variant: AppNavVariant;
  /** Account affordance for the desktop header; omitted on mobile. */
  onAccountPress?: () => void;
}

export function AppNav({ state, descriptors, navigation, insets, variant }: AppNavProps) {
  const p = usePalette();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const isHeader = variant === 'header';

  const destinations = state.routes.flatMap((route, index) => {
    const { options } = descriptors[route.key];

    // Screens that live in the group but aren't destinations — cart detail, for
    // one — are declared with `href: null`. Expo Router encodes that as
    // `tabBarItemStyle: { display: 'none' }` (TabsClient), which the default bar
    // applies as a style. A custom bar has to read it, or the route shows up as
    // a tab named after its file.
    if (StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none') return [];

    const focused = state.index === index;
    const label =
      typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : (options.title ?? route.name);

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return [{ route, options, focused, label, onPress }];
  });

  const tint = p.tint;
  const idle = p.textMuted;

  return (
    <View
      onLayout={(e) => reportHeight?.(e.nativeEvent.layout.height)}
      style={[
        isHeader ? styles.header : styles.bar,
        {
          backgroundColor: p.card,
          // The bar hugs whichever edge it sits on, and only that edge's inset.
          ...(isHeader
            ? { borderBottomColor: p.border, paddingTop: insets.top }
            : { borderTopColor: p.border, paddingBottom: insets.bottom }),
        },
      ]}
    >
      <View style={[styles.inner, isHeader && styles.headerInner]}>
        {isHeader ? (
          <View style={styles.brand}>
            <MascotMark size={26} />
            <Text style={[styles.wordmark, { color: p.text }]}>MC PEELS</Text>
          </View>
        ) : null}

        <View style={[styles.destinations, isHeader && styles.headerDestinations]}>
          {destinations.map(({ route, options, focused, label, onPress }) => (
            <Pressable
              key={route.key}
              accessibilityRole={Platform.OS === 'web' ? 'link' : 'button'}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              style={[styles.item, isHeader ? styles.headerItem : styles.barItem]}
            >
              {options.tabBarIcon?.({
                focused,
                color: focused ? tint : idle,
                size: isHeader ? 18 : 24,
              })}
              <Text
                numberOfLines={1}
                style={[
                  isHeader ? styles.headerLabel : styles.barLabel,
                  { color: focused ? tint : idle },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {isHeader ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account"
            onPress={() => {
              const household = state.routes.find((r) => r.name === 'household');
              if (household) navigation.navigate(household.name);
            }}
            style={styles.account}
          >
            <Ionicons name="person-circle-outline" size={26} color={p.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },

  inner: { flexDirection: 'row', alignItems: 'center' },
  headerInner: {
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    height: 64,
    gap: 28,
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontSize: 15, fontWeight: '900', letterSpacing: 1.4 },

  destinations: { flexDirection: 'row', flex: 1 },
  headerDestinations: { flex: 1, gap: 6 },

  item: { alignItems: 'center', justifyContent: 'center' },
  // 44pt minimum, plus room for the label under the icon.
  barItem: { flex: 1, minHeight: 52, paddingTop: 8, paddingBottom: 6, gap: 3 },
  headerItem: {
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  barLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  headerLabel: { fontSize: 14, fontWeight: '700' },

  account: { minHeight: 40, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
});
