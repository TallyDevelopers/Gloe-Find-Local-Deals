'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Consumer location. The mobile app uses expo-location; on the web we use the
 * browser Geolocation API with a manual city fallback (geocode.* tRPC procedures
 * power the city search in <LocationPill/>). The chosen location persists to
 * localStorage so every deal query can pass userLat/userLng for distance + ETA.
 */

export interface GloeLocation {
  lat: number;
  lng: number;
  label: string;
}

type Status = 'idle' | 'locating' | 'ready' | 'denied';

interface LocationContextValue {
  location: GloeLocation | null;
  status: Status;
  /** Ask the browser for GPS and store the result. */
  useMyLocation: () => void;
  /** Set a manually-picked location (e.g. from a city search). */
  setLocation: (loc: GloeLocation) => void;
  clear: () => void;
}

const STORAGE_KEY = 'gloe.location.v1';
const LocationContext = createContext<LocationContextValue | null>(null);

function read(): GloeLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GloeLocation;
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<GloeLocation | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = read();
    if (stored) {
      setLocationState(stored);
      setStatus('ready');
    }
  }, []);

  const persist = useCallback((loc: GloeLocation | null) => {
    if (typeof window === 'undefined') return;
    if (loc) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setLocation = useCallback(
    (loc: GloeLocation) => {
      setLocationState(loc);
      setStatus('ready');
      persist(loc);
    },
    [persist],
  );

  const clear = useCallback(() => {
    setLocationState(null);
    setStatus('idle');
    persist(null);
  }, [persist]);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('denied');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Near you' });
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [setLocation]);

  const value = useMemo<LocationContextValue>(
    () => ({ location, status, useMyLocation, setLocation, clear }),
    [location, status, useMyLocation, setLocation, clear],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within <LocationProvider>');
  return ctx;
}

/**
 * Shared args for deals.list / deals.search / deals.trending. When no location
 * is set we omit coords entirely — the API still returns deals (just without
 * distance ranking), so the feed is never empty for a first-time visitor.
 */
export function useDealLocationArgs(maxDistanceMiles = 50) {
  const { location } = useLocation();
  return useMemo(
    () =>
      location
        ? { userLat: location.lat, userLng: location.lng, maxDistanceMiles }
        : ({} as { userLat?: number; userLng?: number; maxDistanceMiles?: number }),
    [location, maxDistanceMiles],
  );
}
