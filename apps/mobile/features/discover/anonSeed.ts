import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

/**
 * A stable, anonymous per-install identifier used to seed deal ranking jitter.
 *
 * Why: the backend's `deals.list` blends a tiny per-viewer-per-day jitter into
 * the ranking so reloads feel fresh without being chaotic. We need the seed to
 * be the same across reloads on this device (otherwise the Discover feed would
 * shuffle on every poke), but different from another device (otherwise everyone
 * sees the same order). UUID stored in SecureStore satisfies both.
 *
 * Signed-in users have their real user id used instead (server prefers it),
 * so this only matters for anonymous browsing.
 */

const KEY = 'gloe.anonSeed.v1';
let cached: string | null = null;

async function getOrCreate(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    // SecureStore can fail on simulators without keychain — fall through to
    // create a fresh value. It just won't persist across app reinstall.
  }
  const fresh = Crypto.randomUUID();
  cached = fresh;
  try {
    await SecureStore.setItemAsync(KEY, fresh);
  } catch {
    // Same fallback as above — non-fatal.
  }
  return fresh;
}

/**
 * React hook for the seed. Returns null until SecureStore resolves on first
 * mount, then the stable UUID. Callers should treat null as "skip the seed
 * arg this render" — the backend's ranking gracefully falls back to no jitter.
 */
export function useAnonSeed(): string | null {
  const [seed, setSeed] = useState<string | null>(cached);
  useEffect(() => {
    if (seed) return;
    void getOrCreate().then(setSeed);
  }, [seed]);
  return seed;
}
