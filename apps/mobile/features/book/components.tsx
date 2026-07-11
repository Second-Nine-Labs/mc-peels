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
// Poster backdrop — the reference poster's background, redrawn: red masses
// and the sickle-arc claim the top, powder-periwinkle industrial silhouettes
// (crane, sputnik star, domed hall, factory, truss) stand on the ochre field,
// densest at the bottom. Solid flat shapes like the print; content scrolls
// over it. Deterministic placement — a composition, not confetti.

function Tri({ size, color, rotate = 0 }: { size: number; color: string; rotate?: number }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: size / 2,
        borderRightWidth: size / 2,
        borderBottomWidth: size,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        transform: [{ rotate: `${rotate}deg` }],
      }}
    />
  );
}

export function PosterBackdrop() {
  const p = useSovietPalette();
  const blue = p.display;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden' }]}>
      {/* --- top: red masses + sickle arc --- */}
      <View
        style={{
          position: 'absolute',
          top: -70,
          left: -60,
          width: '85%',
          height: 250,
          backgroundColor: p.red,
          transform: [{ rotate: '-9deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: -170,
          right: -140,
          width: 380,
          height: 380,
          borderRadius: 190,
          borderWidth: 64,
          borderColor: p.red,
        }}
      />
      {/* wheat sheaves inside the red zone */}
      <View style={{ position: 'absolute', top: 6, right: 24, flexDirection: 'row', gap: 12 }}>
        {[0, 1].map((col) => (
          <View key={col} style={{ gap: 5, marginTop: col * 16 }}>
            {[0, 1, 2, 3].map((row) => (
              <View
                key={row}
                style={{
                  width: 16,
                  height: 24,
                  borderTopLeftRadius: 9,
                  borderTopRightRadius: 9,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 12,
                  backgroundColor: blue,
                  transform: [{ rotate: col === 0 ? '-14deg' : '10deg' }],
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {/* --- mid-left: construction crane --- */}
      <View style={{ position: 'absolute', top: 250, left: 10 }}>
        <View style={{ width: 9, height: 130, backgroundColor: blue }} />
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: -6,
            width: 110,
            height: 8,
            backgroundColor: blue,
            transform: [{ rotate: '-7deg' }],
          }}
        />
        <View style={{ position: 'absolute', top: 20, left: 12, flexDirection: 'row', gap: 5 }}>
          {[14, 11, 9].map((size, i) => (
            <Tri key={i} size={size} color={blue} rotate={180} />
          ))}
        </View>
        <View style={{ position: 'absolute', top: 4, left: 96, width: 2.5, height: 34, backgroundColor: blue }} />
        <View style={{ position: 'absolute', top: 36, left: 92, width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: blue }} />
      </View>

      {/* --- mid-right: sputnik star --- */}
      <View style={{ position: 'absolute', top: 420, right: 18, width: 84, height: 84 }}>
        {[0, 45, 90, 135].map((deg) => (
          <View
            key={deg}
            style={{
              position: 'absolute',
              top: 38,
              left: 2,
              width: 80,
              height: 7,
              backgroundColor: blue,
              transform: [{ rotate: `${deg}deg` }],
            }}
          />
        ))}
        <View
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: blue,
          }}
        />
        <View style={{ position: 'absolute', top: -4, left: 6 }}>
          <Tri size={13} color={blue} rotate={32} />
        </View>
        <View style={{ position: 'absolute', bottom: -2, right: 4 }}>
          <Tri size={11} color={blue} rotate={-140} />
        </View>
      </View>

      {/* --- lower-left: domed hall + sphere --- */}
      <View style={{ position: 'absolute', bottom: 150, left: 6 }}>
        <View
          style={{
            width: 46,
            height: 44,
            borderTopLeftRadius: 23,
            borderTopRightRadius: 23,
            backgroundColor: blue,
            marginLeft: 14,
          }}
        />
        <View style={{ width: 74, height: 40, backgroundColor: blue, marginTop: 4 }} />
        <View
          style={{
            position: 'absolute',
            bottom: -14,
            left: 64,
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 7,
            borderColor: blue,
          }}
        />
      </View>

      {/* --- lower-right: factory with arched windows --- */}
      <View style={{ position: 'absolute', bottom: 130, right: 8 }}>
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4, marginLeft: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: 7, height: 34 - i * 5, backgroundColor: blue, alignSelf: 'flex-end' }} />
          ))}
        </View>
        <View style={{ width: 118, height: 74, backgroundColor: blue, justifyContent: 'flex-end' }}>
          <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 10, paddingBottom: 10 }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: 20,
                  height: 30,
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  backgroundColor: p.canvas,
                }}
              />
            ))}
          </View>
        </View>
      </View>

      {/* --- bottom: truss lattice strip --- */}
      <View style={{ position: 'absolute', bottom: 84, left: -10, right: -10 }}>
        <View style={{ height: 6, backgroundColor: blue }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: 54, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 60, height: 6, backgroundColor: blue, transform: [{ rotate: '33deg' }] }} />
              <View style={{ position: 'absolute', width: 60, height: 6, backgroundColor: blue, transform: [{ rotate: '-33deg' }] }} />
            </View>
          ))}
        </View>
        <View style={{ height: 6, backgroundColor: blue }} />
      </View>
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
