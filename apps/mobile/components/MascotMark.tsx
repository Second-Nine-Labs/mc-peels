/**
 * The banana mascot as an interactive mark. A single tap plays a springy pop +
 * happy wiggle. Poke it 5 times quickly and it goes bananas — a full 360° spin
 * plus an optional `onStreak` payload (the hero screens use it to throw a
 * banana-rain party).
 *
 * Every animation is driven from a single 0→1 Animated.Value via interpolation
 * (the pattern that animates reliably on react-native-web).
 */
import { useRef } from 'react';
import { Animated, Easing, Image, Pressable } from 'react-native';

const BANANA = require('../assets/brand/banana.png');
const ASPECT = 613 / 720; // width / height of banana.png
const STREAK_COUNT = 5;
const STREAK_WINDOW_MS = 1400;

export function MascotMark({ size = 64, onStreak }: { size?: number; onStreak?: () => void }) {
  const wiggle = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const taps = useRef<number[]>([]);

  const play = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((ts) => now - ts < STREAK_WINDOW_MS), now];

    wiggle.setValue(0);
    Animated.timing(wiggle, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (taps.current.length >= STREAK_COUNT) {
      taps.current = [];
      spin.setValue(0);
      Animated.timing(spin, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      onStreak?.();
    }
  };

  const scale = wiggle.interpolate({ inputRange: [0, 0.22, 1], outputRange: [1, 1.18, 1] });
  const wiggleRotate = wiggle.interpolate({
    inputRange: [0, 0.2, 0.45, 0.7, 1],
    outputRange: ['0deg', '-16deg', '11deg', '-5deg', '0deg'],
  });
  const spinRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Pressable
      onPress={play}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="MC Peels banana mascot — tap me"
    >
      <Animated.View
        style={{ transform: [{ scale }, { rotate: wiggleRotate }, { rotate: spinRotate }] }}
      >
        <Image source={BANANA} style={{ width: size, height: size / ASPECT }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}
