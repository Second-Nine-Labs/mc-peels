/**
 * Small shared UI kit — no external component library, dark-mode aware.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { onSurface, usePalette, type Surface } from '@/lib/theme';
import type { CartStatus } from '@/lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Button

/**
 * Review §3a collapsed five ad-hoc button treatments into a rule:
 *   primary   — the one action fill
 *   accent    — RESERVED for the terminal "go shop" retailer hand-off
 *   outline   — an alternate beside a primary/accent; never a second fill
 *   secondary — setup and connect actions
 *   danger / ghost — unchanged
 * Two full-width fills of equal weight mean neither is the default.
 */
type ButtonVariant = 'primary' | 'accent' | 'outline' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Only `ghost` reads this — it has no fill, so it inherits the surface. */
  surface?: Surface;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  surface = 'brand',
  style,
}: ButtonProps) {
  const p = usePalette();
  const inactive = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, friction: 7, tension: 320, useNativeDriver: false }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: false }).start();

  const background =
    variant === 'primary' ? p.primary
    : variant === 'accent' ? p.accent
    : variant === 'danger' ? p.dangerSoft
    : variant === 'secondary' ? p.chip
    : 'transparent';
  const color =
    variant === 'primary' ? p.onPrimary
    : variant === 'accent' ? p.onAccent
    : variant === 'danger' ? p.danger
    : variant === 'ghost' ? onSurface(p, surface).text
    : variant === 'outline' ? p.text
    : p.text;
  // The outline carries its weight with a border instead of a fill.
  const outlined = variant === 'outline';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={inactive ? undefined : pressIn}
      onPressOut={inactive ? undefined : pressOut}
      disabled={inactive}
      style={[
        styles.button,
        { backgroundColor: background, opacity: inactive ? 0.55 : 1, transform: [{ scale }] },
        outlined && { borderWidth: 1.5, borderColor: p.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
          <Text style={[styles.buttonText, { color }]}>{title}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Text field

interface FieldProps extends TextInputProps {
  label?: string;
  helperText?: string;
  /** Override the label color, e.g. p.onBgMuted when the form sits on the canvas. */
  labelColor?: string;
}

export function Field({ label, helperText, labelColor, style, ...inputProps }: FieldProps) {
  const p = usePalette();
  return (
    <View style={styles.fieldWrap}>
      {label ? (
        <Text style={[styles.fieldLabel, { color: labelColor ?? p.textMuted }]}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={p.textMuted}
        {...inputProps}
        style={[
          styles.input,
          { backgroundColor: p.card, borderColor: p.border, color: p.text },
          style,
        ]}
      />
      {helperText ? (
        <Text style={[styles.helperText, { color: labelColor ?? p.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chips

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}

export function Chip({ label, selected = false, onPress, onRemove }: ChipProps) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? p.tintSoft : p.chip,
          borderColor: selected ? p.tint : p.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? p.tint : p.text }]}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
          <Ionicons name="close" size={14} color={selected ? p.tint : p.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Toggle

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 26;
const THUMB_INSET = (TRACK_H - THUMB) / 2;

/**
 * On/off pill. Replaces React Native's `Switch`, which needs `thumbColor`,
 * `trackColor` for BOTH states, and `ios_backgroundColor` set explicitly or it
 * renders as a bare thumb with no track on web and iOS — which is exactly how
 * "Prefer organic" shipped. Owning the pill means one appearance everywhere and
 * no per-platform prop matrix to get wrong again.
 *
 * The 52x32 track sits inside a 44pt touch target via hitSlop.
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const p = usePalette();
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [value, slide]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: slide.interpolate({
              inputRange: [0, 1],
              outputRange: [p.border, p.primary],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.toggleThumb,
            {
              // Always light, both modes — a dark thumb on the dark card reads
              // as a hole punched in the track rather than a knob.
              backgroundColor: '#FFFFFF',
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [THUMB_INSET, TRACK_W - THUMB - THUMB_INSET],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Segmented control

/**
 * Mutually-exclusive choice across 2–4 options. Used for the theme preference,
 * where a binary switch would be wrong: "System" has to stay reachable, and it
 * is a third state rather than the absence of a choice.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: p.chip, borderColor: p.border }]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              active && { backgroundColor: p.card, borderColor: p.tint },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? p.tint : p.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The `status` chip — review §3b's third and last chip role. Semantic color
 * only, never interactive.
 *
 * There is ONE appearance here. StatusChip and FilterTag are typed entry points
 * over it, not separate looks: they had drifted to different radii (999 vs 6)
 * and different padding, which is two of the eight variants the review counted.
 */
type StatusTone = 'info' | 'success' | 'neutral';

function StatusBase({ label, tone }: { label: string; tone: StatusTone }) {
  const p = usePalette();
  const c =
    tone === 'success' ? { bg: p.successSoft, fg: p.success }
    : tone === 'neutral' ? { bg: p.chip, fg: p.textMuted }
    : { bg: p.tintSoft, fg: p.tint };
  return (
    <View style={[styles.statusChip, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusChipText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** Applied filters on line items. */
export function FilterTag({ label, tone = 'tint' }: { label: string; tone?: 'tint' | 'neutral' }) {
  return <StatusBase label={label} tone={tone === 'tint' ? 'info' : 'neutral'} />;
}

// ---------------------------------------------------------------------------
// Tag input (chips with add/remove) — used by the dietary profile editor

interface TagInputProps {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helperText?: string;
}

export function TagInput({ label, values, onChange, placeholder, helperText }: TagInputProps) {
  const p = usePalette();
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft('');
  };

  const remove = (value: string) => {
    onChange(values.filter((existing) => existing !== value));
  };

  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text>
      {values.length > 0 ? (
        <View style={styles.chipRow}>
          {values.map((value) => (
            <Chip key={value} label={value} onRemove={() => remove(value)} />
          ))}
        </View>
      ) : null}
      <View style={styles.tagInputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={p.textMuted}
          onSubmitEditing={add}
          blurOnSubmit={false}
          returnKeyType="done"
          autoCapitalize="none"
          style={[
            styles.input,
            styles.tagInput,
            { backgroundColor: p.card, borderColor: p.border, color: p.text },
          ]}
        />
        <Pressable
          onPress={add}
          accessibilityLabel={`Add to ${label}`}
          style={[styles.addButton, { backgroundColor: p.chip, borderColor: p.border }]}
        >
          <Ionicons name="add" size={20} color={p.tint} />
        </Pressable>
      </View>
      {helperText ? <Text style={[styles.helperText, { color: p.textMuted }]}>{helperText}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Feedback + layout helpers

export function ErrorBanner({ message }: { message: string | null }) {
  const p = usePalette();
  if (!message) return null;
  return (
    <View style={[styles.banner, { backgroundColor: p.dangerSoft }]}>
      <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
      <Text style={[styles.bannerText, { color: p.danger }]}>{message}</Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  const p = usePalette();
  if (!message) return null;
  return (
    <View style={[styles.banner, { backgroundColor: p.successSoft }]}>
      <Ionicons name="checkmark-circle-outline" size={18} color={p.success} />
      <Text style={[styles.bannerText, { color: p.success }]}>{message}</Text>
    </View>
  );
}

export function Card({
  children,
  style,
  elevated = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Float the card with a soft drop shadow (the landing look) instead of a border. */
  elevated?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.card,
        elevated
          ? { backgroundColor: p.card, ...styles.cardElevated }
          : { backgroundColor: p.card, borderColor: p.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Pill eyebrow label — the landing's "● GROCERIES, IN PLAIN WORDS" chip.
 *
 * `surface="brand"` sits on the bold blue band; the default sits on the neutral
 * canvas or a card. The off-brand label uses `tintInk` rather than `tint`:
 * `tint` on `tintSoft` measures 3.09:1, which is sub-AA for a small uppercase
 * label — a pre-existing defect that only became visible once Household moved
 * off the blue.
 */
export function EyebrowChip({
  label,
  surface = 'card',
}: {
  label: string;
  surface?: Surface;
}) {
  const p = usePalette();
  const onBrand = surface === 'brand';
  return (
    <View
      style={[
        styles.eyebrowChip,
        { backgroundColor: onBrand ? 'rgba(255,255,255,0.16)' : p.tintSoft },
      ]}
    >
      <View style={[styles.eyebrowDot, { backgroundColor: onBrand ? p.accent : p.accentInk }]} />
      <Text style={[styles.eyebrowChipText, { color: onBrand ? p.onBg : p.tintInk }]}>{label}</Text>
    </View>
  );
}

/**
 * Bold display headline (the landing's "Just **say** what you want."). Pass
 * `emphasis` to tint one word banana-yellow.
 *
 * `surface` moves the body colour AND the emphasis colour together, which is
 * the point: banana-yellow is a fill colour, and as text on a light surface it
 * measures 1.42:1. A title that changes surface without changing both would
 * lose its emphasised word entirely.
 */
export function DisplayTitle({
  text,
  emphasis,
  size = 34,
  color,
  surface = 'brand',
  style,
  numberOfLines,
}: {
  text: string;
  emphasis?: string;
  size?: number;
  /** Explicit override; wins over `surface`. */
  color?: string;
  surface?: Surface;
  style?: StyleProp<ViewStyle>;
  /** Clamp for titles built from user text, which has no length ceiling. */
  numberOfLines?: number;
}) {
  const p = usePalette();
  const pair = onSurface(p, surface);
  const c = color ?? pair.text;
  const body = emphasis
    ? text
        .split(new RegExp(`(${emphasis})`, 'i'))
        .map((part, i) =>
          part.toLowerCase() === emphasis.toLowerCase() ? (
            <Text key={i} style={{ color: pair.emphasis }}>
              {part}
            </Text>
          ) : (
            part
          ),
        )
    : text;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontSize: size, fontWeight: '800', letterSpacing: -0.6, lineHeight: Math.round(size * 1.08), color: c },
        style,
      ]}
    >
      {body}
    </Text>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const p = usePalette();
  return <Text style={[styles.sectionTitle, { color: p.text }]}>{children}</Text>;
}

/**
 * Hero stat row — outline icon + spaced uppercase label, recipe-app style.
 * Lives on the canvas (blue), so the icon takes the accent and text is white.
 */
export function HeroStat({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const p = usePalette();
  return (
    <View style={styles.heroStat}>
      <Ionicons name={icon} size={20} color={p.accent} />
      <Text style={[styles.heroStatLabel, { color: p.onBg }]}>{label}</Text>
    </View>
  );
}

/**
 * Full-screen spinner. `surface` must match the screen it stands in for, or the
 * screen flashes the wrong colour before its body renders.
 */
export function LoadingView({ message, surface = 'brand' }: { message?: string; surface?: Surface }) {
  const p = usePalette();
  const pair = onSurface(p, surface);
  return (
    <View
      style={[
        styles.loadingView,
        { backgroundColor: surface === 'brand' ? p.background : p.canvas },
      ]}
    >
      <ActivityIndicator size="large" color={pair.text} />
      {message ? <Text style={[styles.loadingText, { color: pair.muted }]}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  image,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  /** Optional illustration (e.g. the banana mascot) shown instead of the icon. */
  image?: ImageSourcePropType;
}) {
  const p = usePalette();
  return (
    <View style={styles.emptyState}>
      {image ? (
        <Image source={image} style={styles.emptyImage} resizeMode="contain" />
      ) : (
        <View style={[styles.emptyIconCircle, { backgroundColor: p.tintSoft }]}>
          <Ionicons name={icon} size={34} color={p.tint} />
        </View>
      )}
      <Text style={[styles.emptyTitle, { color: p.onBg }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: p.onBgMuted }]}>{message}</Text>
    </View>
  );
}

export function StatusChip({ status }: { status: CartStatus | undefined }) {
  const { label, tone }: { label: string; tone: StatusTone } =
    status === 'opened' ? { label: 'Opened', tone: 'success' }
    : status === 'expired' ? { label: 'Expired', tone: 'neutral' }
    : { label: 'Ready', tone: 'info' };
  return <StatusBase label={label} tone={tone} />;
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleTrack: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    // 44 is the iOS/Android minimum touch target; these were ~33.
    minHeight: 44,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
  },
  addButton: {
    width: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  cardElevated: {
    borderWidth: 0,
    boxShadow: '0px 18px 40px rgba(21, 34, 56, 0.12)',
  },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  eyebrowDot: { width: 7, height: 7, borderRadius: 999 },
  eyebrowChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroStatLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  loadingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyImage: {
    width: 96,
    height: 113,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
