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
import { color } from '@gloe/ui';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { GloeProviders } from '../features/providers/GloeProviders';

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

  if (!fontsLoaded && !fontError) return null;

  return (
    <GloeProviders
      clerkPublishableKey={requireEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')}
      apiUrl={requireEnv('EXPO_PUBLIC_API_URL')}
    >
      <StatusBar style="dark" backgroundColor={color.surface.primary} />
      <Slot />
    </GloeProviders>
  );
}
