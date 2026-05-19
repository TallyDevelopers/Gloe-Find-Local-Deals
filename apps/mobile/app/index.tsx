import { useAuth } from '@gloe/auth';
import { color } from '@gloe/ui';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Entry point. We always send users to Discover — auth is never required to
 * browse. The (app) group decides per-screen whether an action requires sign-in.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.surface.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={color.brand[500]} />
      </View>
    );
  }

  return <Redirect href="/(app)/discover" />;
}
