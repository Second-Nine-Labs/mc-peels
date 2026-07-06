/**
 * A burst of tumbling bananas — the little celebration when a cart is handed
 * off to Instacart. Purely decorative and non-interactive; it overlays the
 * whole screen and clears itself when the animation finishes.
 *
 * Pass an ever-incrementing `burstKey` (e.g. a counter bumped on checkout) to
 * fire a new burst. `burstKey === 0` renders nothing, so a fresh screen is calm.
 */
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

const BANANA = require('../assets/brand/banana.png');
const PIECE_COUNT = 18;

interface Piece {
  key: string;
  leftPct: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  anim: Animated.Value;
}

function buildPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    key: `${burstStamp}-${i}`,
    leftPct: Math.random() * 100,
    size: 24 + Math.random() * 32,
    delay: Math.random() * 280,
    duration: 1500 + Math.random() * 1100,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 260),
    anim: new Animated.Value(0),
  }));
}

// Unique-enough suffix so React keys never collide across rapid bursts.
let burstStamp = 0;

export function BananaRain({ burstKey }: { burstKey: number }) {
  const { height } = useWindowDimensions();
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!burstKey) return;
    burstStamp += 1;
    const next = buildPieces();
    setPieces(next);

    const animations = next.map((piece) =>
      Animated.timing(piece.anim, {
        toValue: 1,
        duration: piece.duration,
        delay: piece.delay,
        easing: Easing.in(Easing.quad),
        // JS-driven: react-native-web has no native animation module, and the
        // native driver can't animate layout percentages anyway.
        useNativeDriver: false,
      }),
    );
    const group = Animated.parallel(animations);
    group.start(({ finished }) => {
      if (finished) setPieces([]);
    });

    return () => group.stop();
  }, [burstKey]);

  if (pieces.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece) => {
        const translateY = piece.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-piece.size - 20, height + piece.size],
        });
        const translateX = piece.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        });
        const rotate = piece.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${piece.spin}deg`],
        });
        const opacity = piece.anim.interpolate({
          inputRange: [0, 0.85, 1],
          outputRange: [1, 1, 0],
        });
        return (
          <Animated.View
            key={piece.key}
            style={[
              styles.piece,
              {
                left: `${piece.leftPct}%`,
                width: piece.size,
                height: piece.size,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          >
            <Image source={BANANA} style={styles.img} resizeMode="contain" />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
  img: { width: '100%', height: '100%' },
});
