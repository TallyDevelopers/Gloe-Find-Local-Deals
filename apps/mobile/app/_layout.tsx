import { Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { GloeProviders } from '../features/providers/GloeProviders';
import { SplashShimmer } from '../features/splash/SplashShimmer';
import { ThemedStatusBar } from '../features/theme/ThemedStatusBar';

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
  // Prefer the EXPLICIT .env value — it's what we deliberately set per target
  // (localhost for sim, LAN IP for device). Deriving from hostUri is unreliable
  // (it can resolve to localhost even on a physical device, which the phone
  // can't reach). Only fall back to hostUri-derived if .env is unset.
  if (envUrl) return envUrl;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:4000`;
  }
  throw new Error('Missing EXPO_PUBLIC_API_URL. Set it in apps/mobile/.env');
}

export default function RootLayout() {
  // Poppins (display — headlines, card titles/prices; matches the web's
  // consumer marketplace per the approved June 2026 Discover comp) + General
  // Sans (body). The base family names (Poppins / GeneralSans) are what
  // tokens.fontFamily references; the weighted variants are registered too for
  // any explicit per-weight use. Outfit stays for the wordmark logo (locked).
  const [fontsLoaded, fontError] = useFonts({
    Poppins: Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-Semibold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    GeneralSans: require('../assets/fonts/GeneralSans-Regular.otf'),
    'GeneralSans-Medium': require('../assets/fonts/GeneralSans-Medium.otf'),
    'GeneralSans-Semibold': require('../assets/fonts/GeneralSans-Semibold.otf'),
    'GeneralSans-Bold': require('../assets/fonts/GeneralSans-Bold.otf'),
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
      <ThemedStatusBar />
      <Slot />
      {showSplash ? <SplashShimmer onDone={() => setShowSplash(false)} /> : null}
    </GloeProviders>
  );
}
