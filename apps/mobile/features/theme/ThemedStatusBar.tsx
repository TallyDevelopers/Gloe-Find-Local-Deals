import { useTheme } from '@gloe/ui';
import { StatusBar } from 'expo-status-bar';

/**
 * StatusBar that follows the active app theme. Must live inside ThemeProvider.
 */
export function ThemedStatusBar() {
  const { name, color: palette } = useTheme();
  return <StatusBar style={name === 'dark' ? 'light' : 'dark'} backgroundColor={palette.surface.primary} />;
}
