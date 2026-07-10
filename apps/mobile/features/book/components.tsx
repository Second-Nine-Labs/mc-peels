/**
 * Soviet-mode primitives: stamps, the quota meter, the blueprint grid, and a
 * View-drawn crest. No react-native-svg in this app — everything here is
 * borders, transforms, and stubbornness, which is thematically appropriate.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSovietPalette } from './palette';

// ---------------------------------------------------------------------------
// Stamp — the Bureau's status vocabulary (ОДОБРЕНО / В ПЛАН / ДЕФИЦИТ …)

interface StampProps {
  label: string;
  sub?: string;
  tone?: 'red' | 'cream' | 'ink';
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

export function Stamp({ label, sub, tone = 'red', rotate = -3, style }: StampProps) {
  const p = useSovietPalette();
  const color = tone === 'red' ? p.red : tone === 'cream' ? p.cream : p.ink;
  return (
    <View
      style={[
        styles.stamp,
        { borderColor: color, transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      <Text style={[styles.stampLabel, { color }]}>{label}</Text>
      {sub ? <Text style={[styles.stampSub, { color }]}>{sub}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Quota meter — the thrift gauge. Gold fill on a canvas track, red norm tick.

export function QuotaMeter({ shared, count }: { shared: number; count: number }) {
  const p = useSovietPalette();
  const ratio = count > 0 ? shared / count : 0;
  const overfulfilled = ratio >= 0.5 && shared > 0;
  return (
    <View>
      <View style={styles.quotaHeader}>
        <Text style={[styles.quotaLabel, { color: p.cream }]}>Shared-ingredient quota</Text>
        <Text style={[styles.quotaValue, { color: p.gold }]}>
          {shared} of {count} work double shifts
          {overfulfilled ? ' · norm overfulfilled' : ''}
        </Text>
      </View>
      <View style={[styles.quotaTrack, { borderColor: p.cream, backgroundColor: p.track }]}>
        <View
          style={[styles.quotaFill, { backgroundColor: p.gold, width: `${Math.round(ratio * 100)}%` }]}
        />
        <View style={[styles.quotaTick, { backgroundColor: p.red }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Constructivist backdrop — tone-on-tone geometric motifs lifted from the
// poster's background language (diagonal bars, sputnik rings, triangle
// stacks), display cobalt on the deep canvas. Fixed layer; content scrolls
// over it. Deterministic placement — no randomness, like a printed repeat.

const MOTIFS: Array<{ kind: 'bars' | 'sputnik' | 'triangles'; x: number; y: number; flip?: boolean }> = [
  { kind: 'bars', x: 0.62, y: 30 },
  { kind: 'sputnik', x: 0.06, y: 150 },
  { kind: 'triangles', x: 0.74, y: 290, flip: true },
  { kind: 'bars', x: 0.04, y: 430, flip: true },
  { kind: 'sputnik', x: 0.68, y: 560 },
  { kind: 'triangles', x: 0.08, y: 690 },
  { kind: 'bars', x: 0.6, y: 810 },
];

export function ConstructivistBackdrop() {
  const p = useSovietPalette();
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden', opacity: 0.55 }]}>
      {MOTIFS.map((motif, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: `${motif.x * 100}%`,
            top: motif.y,
            transform: [{ rotate: motif.flip ? '8deg' : '-8deg' }],
          }}
        >
          {motif.kind === 'bars' ? (
            <View style={{ gap: 7 }}>
              {[86, 62, 40].map((width) => (
                <View
                  key={width}
                  style={{
                    width,
                    height: 7,
                    backgroundColor: p.display,
                    transform: [{ rotate: '-32deg' }],
                  }}
                />
              ))}
            </View>
          ) : motif.kind === 'sputnik' ? (
            <View style={{ width: 64, height: 64 }}>
              <View
                style={{
                  position: 'absolute',
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  borderWidth: 6,
                  borderColor: p.display,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: p.display,
                }}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[22, 30, 18].map((size, i) => (
                <View
                  key={i}
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: size / 2,
                    borderRightWidth: size / 2,
                    borderBottomWidth: size,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: p.display,
                  }}
                />
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Crest — crossed ladle and whisk in a stamped ring, drawn with Views.
// Charmingly crude on purpose; replaced by real art when assets land.

export function CrestMark({ size = 64 }: { size?: number }) {
  const p = useSovietPalette();
  const bar = { width: size * 0.62, height: Math.max(3, size * 0.055) };
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: p.cream, borderWidth: 2.5, borderColor: p.ink },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.09,
          top: size * 0.09,
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: size * 0.41,
          borderWidth: 1.5,
          borderColor: p.red,
          borderStyle: 'dashed',
        }}
      />
      {/* Ladle: handle + bowl */}
      <View
        style={{
          position: 'absolute',
          left: (size - bar.width) / 2,
          top: (size - bar.height) / 2,
          ...bar,
          borderRadius: bar.height,
          backgroundColor: p.red,
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.16,
          top: size * 0.62,
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: size * 0.1,
          backgroundColor: p.red,
        }}
      />
      {/* Whisk: handle + loops */}
      <View
        style={{
          position: 'absolute',
          left: (size - bar.width) / 2,
          top: (size - bar.height) / 2,
          ...bar,
          borderRadius: bar.height,
          backgroundColor: p.red,
          transform: [{ rotate: '45deg' }],
        }}
      />
      {[-24, 0, 24].map((deg) => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            left: size * 0.6,
            top: size * 0.56,
            width: size * 0.14,
            height: size * 0.3,
            borderRadius: size * 0.09,
            borderWidth: 1.5,
            borderColor: p.red,
            transform: [{ rotate: `${45 + deg}deg` }],
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small labeled tag (ГОСТ numbers, categories) — ink-keylined, letterspaced.

export function SpecTag({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  const p = useSovietPalette();
  const tint = color ?? p.ink;
  return (
    <View style={[styles.specTag, { borderColor: tint }, style]}>
      <Text style={[styles.specTagText, { color: tint }]}>{children}</Text>
    </View>
  );
}

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
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  quotaLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quotaValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  quotaTrack: {
    height: 14,
    borderWidth: 1.5,
    overflow: 'visible',
  },
  quotaFill: {
    height: '100%',
  },
  quotaTick: {
    position: 'absolute',
    left: '50%',
    top: -4,
    width: 2.5,
    height: 19,
  },
  specTag: {
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  specTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
