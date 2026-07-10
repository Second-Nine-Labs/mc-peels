/**
 * A cheerful full-screen loading state: a banana that bounces with a little
 * squash-and-stretch while a rotating set of grocery quips cycles below. Used
 * for the cart-building wait, where a plain spinner would waste a fun moment.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/theme';

const BANANA = require('../assets/brand/banana.png');

const DEFAULT_MESSAGES = [
  'Reading your request…',
  'Checking your household’s food rules…',
  'Hunting down the freshest matches…',
  'Sweet-talking the produce aisle…',
  'Bagging it all up…',
];

export function BananaLoader({ messages = DEFAULT_MESSAGES }: { messages?: string[] }) {
  const p = usePalette();
  const bounce = useRef(new Animated.Value(0)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 520,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % messages.length), 1600);
    return () => clearInterval(id);
  }, [messages.length]);

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [4, -30] });
  const scaleX = bounce.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1.08, 1, 0.99] });
  const scaleY = bounce.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.92, 1, 1.03] });
  const shadowScale = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const shadowOpacity = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.06] });

  return (
    <View style={[styles.fill, { backgroundColor: p.background }]}>
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.shadow,
            { backgroundColor: p.text, opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] },
          ]}
        />
        <Animated.View style={{ transform: [{ translateY }, { scaleX }, { scaleY }] }}>
          <Image source={BANANA} style={styles.banana} resizeMode="contain" />
        </Animated.View>
      </View>
      <Text style={[styles.msg, { color: p.onBgMuted }]}>{messages[msgIndex]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  stage: { height: 150, alignItems: 'center', justifyContent: 'flex-end' },
  banana: { width: 88, height: 103 },
  shadow: {
    position: 'absolute',
    bottom: 6,
    width: 76,
    height: 12,
    borderRadius: 6,
  },
  msg: { fontSize: 15, textAlign: 'center', minHeight: 20 },
});
