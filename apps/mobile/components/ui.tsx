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

import { usePalette } from '@/lib/theme';
import type { CartStatus } from '@/lib/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Button

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
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
    : variant === 'ghost' ? p.onBg
    : p.text;

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

/** Tiny non-interactive chip used for applied filters on line items. */
export function FilterTag({ label, tone = 'tint' }: { label: string; tone?: 'tint' | 'neutral' }) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.filterTag,
        { backgroundColor: tone === 'tint' ? p.tintSoft : p.chip },
      ]}
    >
      <Text style={[styles.filterTagText, { color: tone === 'tint' ? p.tint : p.textMuted }]}>
        {label}
      </Text>
    </View>
  );
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
 * `onCanvas` sits on the blue background; the default sits on a card.
 */
export function EyebrowChip({ label, onCanvas = false }: { label: string; onCanvas?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.eyebrowChip,
        { backgroundColor: onCanvas ? 'rgba(255,255,255,0.16)' : p.tintSoft },
      ]}
    >
      <View style={[styles.eyebrowDot, { backgroundColor: p.accent }]} />
      <Text style={[styles.eyebrowChipText, { color: onCanvas ? '#fff' : p.tint }]}>{label}</Text>
    </View>
  );
}

/**
 * Bold display headline (the landing's "Just **say** what you want."). Pass
 * `emphasis` to tint one word banana-yellow. Defaults to canvas text (onBg).
 */
export function DisplayTitle({
  text,
  emphasis,
  size = 34,
  color,
  style,
}: {
  text: string;
  emphasis?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const c = color ?? p.onBg;
  const body = emphasis
    ? text
        .split(new RegExp(`(${emphasis})`, 'i'))
        .map((part, i) =>
          part.toLowerCase() === emphasis.toLowerCase() ? (
            <Text key={i} style={{ color: p.accent }}>
              {part}
            </Text>
          ) : (
            part
          ),
        )
    : text;
  return (
    <Text
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
 * Editorial two-tone title — a light lead-in and an extrabold payoff
 * ("What do **you need?**"). Defaults to canvas text (onBg).
 */
export function TwoToneTitle({
  light,
  bold,
  size = 32,
  color,
}: {
  light: string;
  bold: string;
  size?: number;
  color?: string;
}) {
  const p = usePalette();
  const c = color ?? p.onBg;
  return (
    <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.18), color: c }}>
      <Text style={{ fontWeight: '300' }}>{light} </Text>
      <Text style={{ fontWeight: '800' }}>{bold}</Text>
    </Text>
  );
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

export function LoadingView({ message }: { message?: string }) {
  const p = usePalette();
  return (
    <View style={[styles.loadingView, { backgroundColor: p.background }]}>
      <ActivityIndicator size="large" color={p.onBg} />
      {message ? <Text style={[styles.loadingText, { color: p.onBgMuted }]}>{message}</Text> : null}
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
  const p = usePalette();
  const tone =
    status === 'opened'
      ? { bg: p.successSoft, fg: p.success, label: 'Opened' }
      : status === 'expired'
        ? { bg: p.chip, fg: p.textMuted, label: 'Expired' }
        : { bg: p.tintSoft, fg: p.tint, label: 'Ready' };
  return (
    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusChipText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
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
    textTransform: 'uppercase',
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
  filterTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  filterTagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    textTransform: 'uppercase',
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
