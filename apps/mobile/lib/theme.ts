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

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? darkPalette : lightPalette;
}
