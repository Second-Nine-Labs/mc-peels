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
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  chip: string;
}

export const lightPalette: Palette = {
  background: '#FAF8F5',
  card: '#FFFFFF',
  text: '#1C1917',
  textMuted: '#78716C',
  border: '#E7E5E4',
  tint: '#EA580C',
  tintSoft: '#FFF0E5',
  onTint: '#FFFFFF',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  success: '#15803D',
  successSoft: '#F0FDF4',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  chip: '#F1EFEC',
};

export const darkPalette: Palette = {
  background: '#141210',
  card: '#1F1C19',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
  border: '#33302C',
  tint: '#FB923C',
  tintSoft: '#3A2413',
  onTint: '#1C1006',
  danger: '#F87171',
  dangerSoft: '#3A1717',
  success: '#4ADE80',
  successSoft: '#132A1B',
  warning: '#FBBF24',
  warningSoft: '#332708',
  chip: '#2B2723',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? darkPalette : lightPalette;
}
