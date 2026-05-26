import { useAuth } from '@gloe/auth';
import { useTheme } from '@gloe/ui';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Entry point. We always send users to Discover — auth is never required to
 * browse. The (app) group decides per-screen whether an action requires sign-in.
 */
export default function Index() {
  const { status } = useAuth();
  const { color: palette } = useTheme();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={palette.brand[500]} />
      </View>
    );
  }

  return <Redirect href="/(app)/(tabs)/discover" />;
}
