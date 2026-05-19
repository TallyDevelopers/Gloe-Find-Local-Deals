/**
 * Gloe Design Tokens — v0
 *
 * Brand direction: Warm metallics (rose gold / champagne) + warm ivory surfaces
 * + dusty pastels. Premium consumer aesthetic — closer to Glossier / Aesop /
 * Tata Harper than Groupon.
 *
 * Rules:
 * - All visual values in the app reference these tokens. Never hardcode hex
 *   codes or pixel values in components.
 * - Tokens are immutable from feature code. Refresh = change values here.
 * - Light mode only for v0. Dark mode tokens to be added later.
 */

export const color = {
  // Surfaces — warm ivory dominates
  surface: {
    primary: '#FBF8F3',
    secondary: '#F5F0E8',
    elevated: '#FFFFFF',
    overlay: 'rgba(43, 32, 25, 0.4)',
  },

  // Brand — champagne / warm metallic
  brand: {
    50: '#FBF3EC',
    100: '#F4E3D2',
    200: '#E9C8AC',
    300: '#DDA982',
    400: '#C68B5F',
    500: '#A87044',
    600: '#8B5A36',
    700: '#6E4628',
    800: '#52351E',
    900: '#382415',
  },

  // Accent — dusty rose
  accent: {
    50: '#FBF1EE',
    100: '#F5DDD5',
    200: '#EBBAA9',
    300: '#DC967D',
    400: '#C97658',
    500: '#B25D40',
    600: '#8F4830',
    700: '#6B3624',
  },

  // Lavender gray — sophistication accent
  lavender: {
    50: '#F5F2F5',
    100: '#E8E1E8',
    200: '#D0C4D2',
    300: '#B0A0B5',
    400: '#8C7B92',
    500: '#6E5E76',
  },

  // Text — warm neutrals, never pure black
  text: {
    primary: '#2B2019',
    secondary: '#5E5147',
    tertiary: '#8C7F73',
    inverse: '#FBF8F3',
    link: '#A87044',
    disabled: '#C4B8AC',
  },

  // Semantic — tuned warm
  semantic: {
    success: '#7A8B5C',
    error: '#B24545',
    warning: '#C68B5F',
    info: '#6E5E76',
  },

  // Neutrals — warm gray scale
  neutral: {
    0: '#FFFFFF',
    50: '#FBF8F3',
    100: '#F5F0E8',
    200: '#E8DFD2',
    300: '#D4C7B5',
    400: '#B0A292',
    500: '#8C7F73',
    600: '#6B5F55',
    700: '#4A413A',
    800: '#2B2019',
    900: '#1A130F',
    950: '#0D0907',
  },

  // Borders
  border: {
    subtle: '#E8DFD2',
    default: '#D4C7B5',
    strong: '#8C7F73',
  },
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 999,
} as const;

export const fontFamily = {
  display: 'Fraunces',
  body: 'Inter',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.15,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#2B2019',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#2B2019',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#2B2019',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  xl: {
    shadowColor: '#2B2019',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 48,
    elevation: 12,
  },
} as const;

export const motion = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  spring: {
    gentle: { damping: 30, stiffness: 200 },
    snappy: { damping: 22, stiffness: 320 },
    bouncy: { damping: 14, stiffness: 220 },
  },
} as const;

export const tokens = {
  color,
  space,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  shadow,
  motion,
} as const;

export type Tokens = typeof tokens;
