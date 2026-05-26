import { ThemeProvider, type ThemeName, type ThemePreference } from '@gloe/ui';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

const STORAGE_KEY = 'gloe.themePreference';

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  resolved: ThemeName;
  setPreference: (next: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function isValidPreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function resolve(preference: ThemePreference, systemScheme: ColorSchemeName): ThemeName {
  if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return preference;
}

/**
 * Owns the user's appearance preference and the resolved active theme. On mount
 * it reads the stored choice (defaults to 'system') and subscribes to OS
 * Appearance changes so 'system' flips live when iOS goes dark.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme());

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isValidPreference(stored)) {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // First-launch read failure is non-fatal; default 'system' stays.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // Persist failure is non-fatal; the in-memory choice still applies.
    });
  }, []);

  const resolved = resolve(preference, systemScheme);

  return (
    <ThemePreferenceContext.Provider value={{ preference, resolved, setPreference }}>
      <ThemeProvider name={resolved}>{children}</ThemeProvider>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used inside ThemePreferenceProvider');
  return ctx;
}
