/**
 * The palette, and the preference that selects it.
 *
 * `usePalette()` keeps its original zero-argument signature deliberately — 19
 * files call it, and making the theme state-driven should not cost 19 diffs.
 *
 * Reading the preference through React state rather than `useColorScheme()`
 * also addresses a class of bug seen on web, where a mounted tab kept the light
 * canvas while the tab bar went dark: `useColorScheme()` subscribes to
 * `matchMedia`, and with `experiments.reactCompiler` on, a memoized subtree can
 * miss that change. Context propagates through the normal render path, so every
 * consumer re-renders together.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

export interface Palette {
  /** The bold brand blue. A *band*, not an infinite canvas (review §6). */
  background: string;
  /**
   * The neutral page surface for lists and settings. In light mode this is the
   * quiet counterpart to the brand blue; in dark mode there is no such split —
   * the bold-blue treatment is a light-mode statement — so it resolves to the
   * same ground as `background`.
   */
  canvas: string;
  card: string;
  text: string;
  textMuted: string;
  /** Text sitting directly on the (bold) background, not on a card. */
  onBg: string;
  onBgMuted: string;
  border: string;
  tint: string;
  tintSoft: string;
  onTint: string;
  /** Tint darkened until it clears AA as *text* on `tintSoft`. */
  tintInk: string;
  /** Primary action button — navy so it pops on the blue canvas. */
  primary: string;
  onPrimary: string;
  /** Playful banana-yellow accent — reserved for the big "go" moments. */
  accent: string;
  accentSoft: string;
  onAccent: string;
  /**
   * The accent's legible-on-light counterpart. `accent` is a fill colour; as
   * *text* on a light surface it measures 1.42:1 and disappears. Same trade the
   * review already made for dark-mode fills, applied to light-mode ink.
   */
  accentInk: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  chip: string;
}

// Bold, bright, fun. The canvas IS the brand blue (#208AEF — same as the app
// icon + splash), white cards float on it, hero text goes white, and the
// primary button is the mascot's deep navy so it never melts into the canvas.
export const lightPalette: Palette = {
  background: '#208AEF',
  canvas: '#EEF3FA',
  card: '#FFFFFF',
  text: '#152238',
  textMuted: '#5C6B85',
  onBg: '#FFFFFF',
  onBgMuted: '#D5EAFF',
  border: '#E2EAF6',
  tint: '#208AEF',
  tintSoft: '#E6F1FE',
  onTint: '#FFFFFF',
  tintInk: '#1668C4',
  primary: '#152238',
  onPrimary: '#FFFFFF',
  accent: '#FFC531',
  accentSoft: '#FFF3D0',
  onAccent: '#152238',
  accentInk: '#96590A',
  danger: '#E24B4A',
  dangerSoft: '#FDECEB',
  success: '#17A34A',
  successSoft: '#E6F7EE',
  warning: '#E38A00',
  warningSoft: '#FEF1DC',
  chip: '#EAF1FB',
};

// Dark mode keeps its calm navy canvas — the bold-blue treatment is a
// light-mode statement; at night the same tokens resolve to on-dark values.
//
// Three deliberate departures from the old values (design review §6):
// - `primary` is no longer the same hex as `tint`. When both were #4FA4F2 the
//   system literally could not distinguish "the action" from "an accent". The
//   action is now a solid committed blue; the tint stays airy for links, icons,
//   and selected states.
// - `accent` has a dark value. #FFC531 hit ~11.6:1 against the canvas as a
//   full-width fill — the glare on the cart screen. #E0A020 lands near 8:1:
//   still emphatic, ~30% less luminous.
// - The elevation ramp is wider. Canvas, card, and nested rows sat within a
//   narrow band, so structure read as vague. Dark UIs need wider steps than
//   light ones, not narrower.
export const darkPalette: Palette = {
  background: '#0A1120',
  // No band/canvas split at night: there is no bold blue to step down from.
  canvas: '#0A1120',
  card: '#152743',
  text: '#EAF2FE',
  textMuted: '#97A6C2',
  onBg: '#EAF2FE',
  onBgMuted: '#97A6C2',
  border: '#2B4467',
  tint: '#4FA4F2',
  tintSoft: '#132E52',
  onTint: '#06192E',
  // Already clears AA on the dark tintSoft (5.14:1), so it needs no darkening.
  tintInk: '#4FA4F2',
  primary: '#1D6FD1',
  onPrimary: '#FFFFFF',
  accent: '#E0A020',
  accentSoft: '#3A2D08',
  onAccent: '#20180A',
  // The dark accent is already ink-legible on the dark ground (8.28:1).
  accentInk: '#E0A020',
  danger: '#F98A82',
  dangerSoft: '#3A1B19',
  success: '#4ADE80',
  successSoft: '#0F2A1B',
  warning: '#FBBF24',
  warningSoft: '#33270A',
  chip: '#1F3554',
};

// ---------------------------------------------------------------------------
// Surfaces

/**
 * Which surface a piece of content is sitting on.
 *
 * `brand` is the bold blue band; `canvas` is the neutral page; `card` is a
 * raised sheet on either of them.
 */
export type Surface = 'brand' | 'canvas' | 'card';

/**
 * The text triple that belongs to a surface — body, muted, and the emphasis
 * colour a display title tints one word with.
 *
 * Pairing these deliberately, rather than letting call sites pick a background
 * and a colour independently, is the whole point. Review §5 #1 (cream text on a
 * cream card) was not a wrong colour: it was a surface and its text drifting
 * apart, because the two were chosen in different places. Anything that changes
 * its surface should change its text in the same expression.
 */
export function onSurface(p: Palette, surface: Surface) {
  return surface === 'brand'
    ? { text: p.onBg, muted: p.onBgMuted, emphasis: p.accent }
    : { text: p.text, muted: p.textMuted, emphasis: p.accentInk };
}

// ---------------------------------------------------------------------------
// Theme preference

/** What the user chose. 'system' follows the OS and is the default. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** What that choice resolves to right now. */
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'mcpeels.theme-mode';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  scheme: ResolvedScheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Holds the theme preference and persists it.
 *
 * Children are withheld until the stored preference has been read, so a user
 * who chose Light never sees a dark frame first. The gap is one AsyncStorage
 * read; `fallback` covers it if a caller wants a splash rather than nothing.
 */
export function ThemeProvider({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => {
        // A failed read just means the default: follow the system.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    // Update state first so the UI turns immediately; the write is incidental.
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Preference is lost on restart, but the session still honours it.
    });
  }, []);

  const scheme: ResolvedScheme =
    mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo(() => ({ mode, setMode, scheme }), [mode, setMode, scheme]);

  if (!hydrated) return <>{fallback}</>;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The preference and its setter — for the Household control and anything that
 * needs to drive chrome (status bar, root background) from the same value.
 */
export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used inside <ThemeProvider>');
  }
  return ctx;
}

/**
 * The active palette. Signature unchanged from the OS-bound version.
 *
 * Falls back to the system scheme when rendered outside the provider, so
 * previews and tests that mount a screen in isolation still get real colors
 * instead of throwing.
 */
export function usePalette(): Palette {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  const scheme = ctx?.scheme ?? (system === 'dark' ? 'dark' : 'light');
  return scheme === 'dark' ? darkPalette : lightPalette;
}
