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
import { Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { color } from '@gloe/ui';
import Constants from 'expo-constants';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { GloeProviders } from '../features/providers/GloeProviders';
import { SplashShimmer } from '../features/splash/SplashShimmer';

SplashScreen.preventAutoHideAsync();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Set it in apps/mobile/.env`);
  return value;
}

/**
 * In dev, derive the API URL from Expo's hostUri so the same build works on
 * both the iOS simulator (where it resolves to localhost) and a physical
 * device on the same Wi-Fi (where Expo reports the Mac's LAN IP). This avoids
 * hardcoding a LAN IP that goes stale every DHCP renewal. In production
 * builds (`hostUri` is undefined), fall back to the env value.
 */
function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:4000`;
  }
  if (!envUrl) throw new Error('Missing EXPO_PUBLIC_API_URL. Set it in apps/mobile/.env');
  return envUrl;
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
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const [showSplash, setShowSplash] = useState(true);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GloeProviders
      clerkPublishableKey={requireEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY')}
      stripePublishableKey={requireEnv('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY')}
      apiUrl={resolveApiUrl()}
    >
      <StatusBar style="dark" backgroundColor={color.surface.primary} />
      <Slot />
      {showSplash ? <SplashShimmer onDone={() => setShowSplash(false)} /> : null}
    </GloeProviders>
  );
}
