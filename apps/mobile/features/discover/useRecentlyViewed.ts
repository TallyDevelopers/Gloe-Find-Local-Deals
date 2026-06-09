import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

/**
 * "Recently viewed" deal ids — stored locally on the device (no backend, works
 * logged-out, private, instant). Mirrors the recent-searches pattern in
 * search.tsx: a versioned SecureStore key holding a capped, newest-first,
 * de-duplicated list of deal ids.
 *
 * Two entry points:
 *   - useRecordRecentlyViewed() → a `record(id)` callback the deal screen calls
 *     when a deal is opened.
 *   - useRecentlyViewed() → the reactive id list the Discover rail reads.
 *
 * A tiny in-module subscriber set keeps any mounted reader in sync the moment a
 * view is recorded on another screen (record → persist → notify → readers
 * re-read), without a context provider.
 */

const RECENT_VIEWED_KEY = 'gloe.recentlyViewed.v1';
const MAX_RECENT_VIEWED = 8;

const subscribers = new Set<(ids: string[]) => void>();

async function load(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(RECENT_VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function persist(list: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(RECENT_VIEWED_KEY, JSON.stringify(list.slice(0, MAX_RECENT_VIEWED)));
  } catch {
    // SecureStore can fail on simulators without a keychain — non-fatal.
  }
}

/** Move `id` to the front, dedup, cap, persist, and notify any mounted readers. */
async function recordView(id: string): Promise<void> {
  if (!id) return;
  const current = await load();
  const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENT_VIEWED);
  await persist(next);
  subscribers.forEach((fn) => fn(next));
}

/** The callback the deal-detail screen calls when a deal is opened. Stable. */
export function useRecordRecentlyViewed(): (id: string) => void {
  return useCallback((id: string) => {
    void recordView(id);
  }, []);
}

/** The reactive list of recently-viewed deal ids (newest first) for the rail. */
export function useRecentlyViewed(): string[] {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    // Initial read on mount.
    load().then((list) => {
      if (active) setIds(list);
    });
    // Stay in sync when a view is recorded elsewhere while we're mounted.
    const sub = (next: string[]) => setIds(next);
    subscribers.add(sub);
    return () => {
      active = false;
      subscribers.delete(sub);
    };
  }, []);

  return ids;
}
