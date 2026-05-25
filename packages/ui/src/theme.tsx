import { createContext, useContext, type ReactNode } from 'react';

import { color, colorDark, type ColorPalette } from './tokens';

export type ThemeName = 'light' | 'dark';

/**
 * User preference for theme. 'system' follows OS Appearance and resolves to
 * either 'light' or 'dark' at render time.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  name: ThemeName;
  color: ColorPalette;
}

const lightContextValue: ThemeContextValue = { name: 'light', color };
const darkContextValue: ThemeContextValue = { name: 'dark', color: colorDark };

const ThemeContext = createContext<ThemeContextValue>(lightContextValue);

export interface ThemeProviderProps {
  name: ThemeName;
  children: ReactNode;
}

/**
 * Wrap the app in this provider with the *resolved* theme name (light/dark).
 * Apps decide how to resolve the user's preference — see useResolvedThemeName.
 */
export function ThemeProvider({ name, children }: ThemeProviderProps) {
  const value = name === 'dark' ? darkContextValue : lightContextValue;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Components call this to read the active palette and theme name. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
