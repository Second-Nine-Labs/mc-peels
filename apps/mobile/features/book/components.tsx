/**
 * Soviet-mode primitives: stamps, the quota meter, the blueprint grid, and a
 * View-drawn crest. No react-native-svg in this app — everything here is
 * borders, transforms, and stubbornness, which is thematically appropriate.
 */

import { useState, type ReactNode } from 'react';
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
// Blueprint grid — the faint cream drafting grid the whole tab sits on.
// Rendered as positioned hairline Views inside a fixed, non-interactive layer.

export function BlueprintGrid({ spacing = 28 }: { spacing?: number }) {
  const p = useSovietPalette();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const columns = size.width > 0 ? Math.floor(size.width / spacing) : 0;
  const rows = size.height > 0 ? Math.floor(size.height / spacing) : 0;

  return (
    <View
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
    >
      {Array.from({ length: columns }, (_, i) => (
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            left: (i + 1) * spacing,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: p.canvasLine,
          }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            top: (i + 1) * spacing,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: p.canvasLine,
          }}
        />
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
