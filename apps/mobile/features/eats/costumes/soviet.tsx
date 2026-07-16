/**
 * Soviet skin parts — the stamp primitive and the poster art the Столовая
 * look wears. Relocated out of the retired Book; self-contained so it carries
 * its own colors (no shared palette hook).
 */

import type { ImageSourcePropType } from 'react-native';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const STAMP_COLORS = { red: '#C8332B', cream: '#F2E8D5', ink: '#211C17' } as const;

interface StampProps {
  label: string;
  sub?: string;
  tone?: keyof typeof STAMP_COLORS;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

/** The Bureau's status vocabulary (ОДОБРЕНО / УТВЕРЖДЕНО …), stamped askew. */
export function Stamp({ label, sub, tone = 'red', rotate = -3, style }: StampProps) {
  const color = STAMP_COLORS[tone];
  return (
    <View
      style={[styles.stamp, { borderColor: color, transform: [{ rotate: `${rotate}deg` }] }, style]}
    >
      <Text style={[styles.stampLabel, { color }]}>{label}</Text>
      {sub ? <Text style={[styles.stampSub, { color }]}>{sub}</Text> : null}
    </View>
  );
}

/** Poster art for the Soviet skin. Slots the look references; null degrades. */
export interface SovietPosters {
  crest: ImageSourcePropType | null;
  fist: ImageSourcePropType | null;
  cutoutWorker: ImageSourcePropType | null;
  worker: ImageSourcePropType | null;
}

export const POSTERS: SovietPosters = {
  crest: require('../../../assets/soviet/crest-bureau.jpg'),
  fist: require('../../../assets/soviet/cta-fist.jpg'),
  cutoutWorker: require('../../../assets/soviet/cutout-worker.png'),
  worker: require('../../../assets/soviet/poster-worker.jpg'),
};

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  stampLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  stampSub: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 1,
  },
});
