import { AuthProvider } from '@gloe/auth';
import { color } from '@gloe/ui';
import { ApiBridge } from '../features/api/ApiBridge';
import { AuthGateProvider } from '../features/auth-gate/AuthGateProvider';
import { ClaimedDealsProvider } from '../features/claimed/ClaimedDealsProvider';
import { SavedDealsProvider } from '../features/saved/SavedDealsProvider';
import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Set it in apps/mobile/.env`);
  return value;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces: Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter: Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider publishableKey={requireEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')}>
        <ApiBridge apiUrl={requireEnv('EXPO_PUBLIC_API_URL')}>
          <AuthGateProvider>
            <SavedDealsProvider>
              <ClaimedDealsProvider>
                <StatusBar style="dark" backgroundColor={color.surface.primary} />
                <Slot />
              </ClaimedDealsProvider>
            </SavedDealsProvider>
          </AuthGateProvider>
        </ApiBridge>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
