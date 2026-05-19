import * as SecureStore from 'expo-secure-store';

/**
 * Token cache for Clerk on Expo. Uses expo-secure-store (Keychain on iOS) to
 * persist the session token across app restarts.
 */
export const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // best-effort; if storage fails, user will need to log in again
    }
  },
};
