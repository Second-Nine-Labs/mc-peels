/**
 * The banana mascot as an interactive mark. Tapping it plays a springy pop +
 * happy wiggle — a small easter egg that invites people to poke it. Used on the
 * hero moments (Ask + auth screens) in place of a plain logo image.
 *
 * The whole animation is driven from a single 0→1 Animated.Value via
 * interpolation (the pattern that animates reliably on react-native-web).
 */
import { useRef } from 'react';
import { Animated, Easing, Image, Pressable } from 'react-native';

const BANANA = require('../assets/brand/banana.png');
const ASPECT = 613 / 720; // width / height of banana.png

export function MascotMark({ size = 64 }: { size?: number }) {
  const t = useRef(new Animated.Value(0)).current;

  const play = () => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const scale = t.interpolate({ inputRange: [0, 0.22, 1], outputRange: [1, 1.18, 1] });
  const rotate = t.interpolate({
    inputRange: [0, 0.2, 0.45, 0.7, 1],
    outputRange: ['0deg', '-16deg', '11deg', '-5deg', '0deg'],
  });

  return (
    <Pressable
      onPress={play}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="MC Peels banana mascot — tap me"
    >
      <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
        <Image source={BANANA} style={{ width: size, height: size / ASPECT }} resizeMode="contain" />
      </Animated.View>
    </Pressable>
  );
}
