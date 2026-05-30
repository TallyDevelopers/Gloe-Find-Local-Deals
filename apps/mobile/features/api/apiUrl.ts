import Constants from 'expo-constants';

/**
 * Resolve the API base URL the same way the root layout does, so any screen
 * that needs to construct a raw HTTP URL (e.g. Apple Wallet pass download)
 * doesn't have to thread it down through props.
 */
export function getApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:4000`;
  }
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl) throw new Error('Missing EXPO_PUBLIC_API_URL');
  return envUrl;
}
