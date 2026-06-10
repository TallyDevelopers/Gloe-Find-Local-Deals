/**
 * Gloe Design Tokens
 *
 * Brand direction: Warm metallics (rose gold / champagne) + blush pearl surfaces
 * + dusty pastels. Premium consumer aesthetic — closer to Glossier / Aesop /
 * Tata Harper than Groupon.
 *
 * Rules:
 * - All visual values in the app reference these tokens. Never hardcode hex
 *   codes or pixel values in components.
 * - Tokens are immutable from feature code. Refresh = change values here.
 *
 * `color` is the light theme and stays the default export for legacy code.
 * `colorDark` mirrors its shape. New code should read from `useTheme()` so
 * the active theme is picked automatically.
 */

export const color = {
  // Surfaces — blush pearl. Pink-undertone neutral, skincare-counter feel.
  surface: {
    primary: '#FAF5F2',
    secondary: '#F3EBE6',
    elevated: '#FFFFFF',
    overlay: 'rgba(43, 32, 25, 0.4)',
  },

  // Brand — rose gold / champagne. The wordmark color is now the brand color.
  brand: {
    50: '#FBF4F1',
    100: '#F6E4DE',
    200: '#EDCABF',
    300: '#DDAB9C',
    400: '#D0A294',
    500: '#C89A8C',
    600: '#B8806F',
    700: '#9A6757',
    800: '#704A3F',
    900: '#4A3028',
  },

  // Rose gold alias — preserved for components that reference `color.gold`.
  // Points at the brand ramp now that rose gold IS the brand.
  gold: {
    DEFAULT: '#C89A8C',
    deep: '#B8806F',
  },

  // Accent — true blush (pink-leaning, not peach). Used for badges, highlights,
  // hover wash. Pulled toward pink so it doesn't read as a peachy second brand.
  accent: {
    50: '#FCF2F1',
    100: '#F9E0DE',
    200: '#F2C1BE',
    300: '#ECB1AD',
    400: '#EBB7B0',
    500: '#E8B4AB',
    600: '#CE918A',
    700: '#A86E69',
  },

  // Clay — old earthy brown ramp. Deprecated; kept temporarily so any
  // unmigrated references don't break. Prefer `brand` for new code.
  clay: {
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
    inverse: '#FAF5F2',
    link: '#C89A8C',
    disabled: '#C4B8AC',
  },

  // Semantic — tuned warm
  semantic: {
    success: '#7A8B5C',
    error: '#B24545',
    warning: '#D89A6E',
    info: '#6E5E76',
  },

  // Neutrals — blush-undertone warm gray scale
  neutral: {
    0: '#FFFFFF',
    50: '#FAF5F2',
    100: '#F3EBE6',
    200: '#E8DAD2',
    300: '#D4C0B5',
    400: '#B0998F',
    500: '#8C7770',
    600: '#6B5853',
    700: '#4A3D38',
    800: '#2B2019',
    900: '#1A130F',
    950: '#0D0907',
  },

  // Borders
  border: {
    subtle: '#E8DAD2',
    default: '#D4C0B5',
    strong: '#8C7770',
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
  // Poppins matches the web consumer marketplace (approved Discover comp,
  // June 2026). The wordmark stays Outfit — that's locked, see Wordmark.tsx.
  display: 'Poppins',
  body: 'GeneralSans',
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

/**
 * Structural shape both themes satisfy. We derive it from `color` then map
 * every leaf to plain `string`, so dark hexes aren't rejected for failing to
 * match the light theme's literal types.
 */
export type ColorPalette = {
  readonly [G in keyof typeof color]: {
    readonly [K in keyof (typeof color)[G]]: string;
  };
};

/**
 * Dark theme. Brand/accent/lavender/clay ramps are intentionally shared with
 * the light theme — they're brand identity, not chrome. Only surfaces, text,
 * borders, neutrals, and semantic tones flip.
 *
 * Dark surface direction: cool ink-mauve — a feminine night mode for late,
 * in-bed phone use, where the warm rose-gold brand glows against a cool bed
 * instead of muddying into a brown one. No pure #000 for surfaces, no warm/
 * brown undertone anywhere. Rose gold needs to stay legible — we lift the
 * brand text/link to brand[300] on dark so contrast clears WCAG AA.
 */
export const colorDark: ColorPalette = {
  surface: {
    primary: '#131217',
    secondary: '#1C1A22',
    elevated: '#26232E',
    overlay: 'rgba(0, 0, 0, 0.55)',
  },

  // Brand ramps stay identical — same hex values in both themes.
  brand: color.brand,
  gold: color.gold,
  accent: color.accent,
  clay: color.clay,
  lavender: color.lavender,

  text: {
    primary: '#F0EDF1',
    secondary: '#C2BCC4',
    tertiary: '#857F89',
    inverse: '#2B2019',
    // Lift link to brand[300] so rose gold reads cleanly on dark surfaces
    link: '#DDAB9C',
    disabled: '#4A4651',
  },

  semantic: {
    // Lift success/error/warning/info one notch for dark-bg legibility
    success: '#9DAE7A',
    error: '#D67070',
    warning: '#E5B58A',
    info: '#9888A0',
  },

  neutral: {
    0: '#000000',
    50: '#131217',
    100: '#1C1A22',
    200: '#26232E',
    300: '#34313F',
    400: '#4E4A58',
    500: '#837D8A',
    600: '#A8A2AE',
    700: '#C2BCC4',
    800: '#E2DCE4',
    900: '#F0EAF1',
    950: '#FFFFFF',
  },

  border: {
    subtle: '#211F28',
    default: '#34313F',
    strong: '#4E4A58',
  },
};

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
