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
  background: string;
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
  /** Primary action button — navy so it pops on the blue canvas. */
  primary: string;
  onPrimary: string;
  /** Playful banana-yellow accent — reserved for the big "go" moments. */
  accent: string;
  accentSoft: string;
  onAccent: string;
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
  card: '#FFFFFF',
  text: '#152238',
  textMuted: '#5C6B85',
  onBg: '#FFFFFF',
  onBgMuted: '#D5EAFF',
  border: '#E2EAF6',
  tint: '#208AEF',
  tintSoft: '#E6F1FE',
  onTint: '#FFFFFF',
  primary: '#152238',
  onPrimary: '#FFFFFF',
  accent: '#FFC531',
  accentSoft: '#FFF3D0',
  onAccent: '#152238',
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
export const darkPalette: Palette = {
  background: '#0B1626',
  card: '#13233A',
  text: '#EAF2FE',
  textMuted: '#97A6C2',
  onBg: '#EAF2FE',
  onBgMuted: '#97A6C2',
  border: '#243953',
  tint: '#4FA4F2',
  tintSoft: '#132E52',
  onTint: '#06192E',
  primary: '#4FA4F2',
  onPrimary: '#06192E',
  accent: '#FFC531',
  accentSoft: '#3A2D08',
  onAccent: '#20180A',
  danger: '#F98A82',
  dangerSoft: '#3A1B19',
  success: '#4ADE80',
  successSoft: '#0F2A1B',
  warning: '#FBBF24',
  warningSoft: '#33270A',
  chip: '#1C2E48',
};

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
