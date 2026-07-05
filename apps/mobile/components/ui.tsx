/**
 * Small shared UI kit — no external component library, dark-mode aware.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { usePalette } from '@/lib/theme';
import type { CartStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Button

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

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

  const background =
    variant === 'primary' ? p.tint : variant === 'danger' ? p.dangerSoft : variant === 'secondary' ? p.chip : 'transparent';
  const color =
    variant === 'primary' ? p.onTint : variant === 'danger' ? p.danger : variant === 'ghost' ? p.tint : p.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: inactive ? 0.55 : pressed ? 0.8 : 1 },
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
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Text field

interface FieldProps extends TextInputProps {
  label?: string;
  helperText?: string;
}

export function Field({ label, helperText, style, ...inputProps }: FieldProps) {
  const p = usePalette();
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={[styles.fieldLabel, { color: p.textMuted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={p.textMuted}
        {...inputProps}
        style={[
          styles.input,
          { backgroundColor: p.card, borderColor: p.border, color: p.text },
          style,
        ]}
      />
      {helperText ? <Text style={[styles.helperText, { color: p.textMuted }]}>{helperText}</Text> : null}
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const p = usePalette();
  return <Text style={[styles.sectionTitle, { color: p.text }]}>{children}</Text>;
}

export function LoadingView({ message }: { message?: string }) {
  const p = usePalette();
  return (
    <View style={[styles.loadingView, { backgroundColor: p.background }]}>
      <ActivityIndicator size="large" color={p.tint} />
      {message ? <Text style={[styles.loadingText, { color: p.textMuted }]}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  const p = usePalette();
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={40} color={p.textMuted} />
      <Text style={[styles.emptyTitle, { color: p.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: p.textMuted }]}>{message}</Text>
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
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
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
