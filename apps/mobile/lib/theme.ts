import { useColorScheme } from 'react-native';

export interface Palette {
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  tint: string;
  tintSoft: string;
  onTint: string;
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

// Bright, clean, fun. Primary blue is the same #208AEF as the app icon +
// splash; the navy text and banana-yellow accent are pulled straight from the
// mascot so the whole UI agrees with the logo.
export const lightPalette: Palette = {
  background: '#F3F8FF',
  card: '#FFFFFF',
  text: '#152238',
  textMuted: '#5C6B85',
  border: '#E2EAF6',
  tint: '#208AEF',
  tintSoft: '#E6F1FE',
  onTint: '#FFFFFF',
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

export const darkPalette: Palette = {
  background: '#0B1626',
  card: '#13233A',
  text: '#EAF2FE',
  textMuted: '#97A6C2',
  border: '#243953',
  tint: '#4FA4F2',
  tintSoft: '#132E52',
  onTint: '#06192E',
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
