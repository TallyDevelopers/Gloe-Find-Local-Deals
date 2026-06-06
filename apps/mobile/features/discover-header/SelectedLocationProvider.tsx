import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SelectedLocation {
  label: string;       // human display, e.g. "San Diego, CA"
  latitude: number;
  longitude: number;
  /** True if this came from the device GPS. False if user picked a city. */
  fromGPS?: boolean;
}

/** How the current location was established. 'unset' = the user hasn't shared
 *  or picked one yet, so the home feed shouldn't pretend to know where they are. */
type LocationMode = 'unset' | 'gps' | 'picked';

interface SelectedLocationContextValue {
  location: SelectedLocation;
  setLocation: (loc: SelectedLocation) => void;
  /** True once we've attempted to read GPS (succeeded or denied). */
  gpsResolved: boolean;
  /** True if the user denied location permission. UI can suggest enabling it. */
  gpsDenied: boolean;
  /**
   * Whether we have a REAL location to show local results for — i.e. GPS was
   * granted or the user picked a city. When false, `location` holds only a
   * neutral map-camera default (not a place we should claim is "yours"), and
   * the home feed shows the share-location takeover instead of faking results.
   */
  hasLocation: boolean;
  /**
   * Ask the OS for location now (the "Use my location" button). Resolves to
   * true if we got a fix. If permission is blocked, returns false so the caller
   * can fall back to the manual city picker.
   */
  requestLocation: () => Promise<boolean>;
}

/**
 * Neutral default coordinates — downtown San Diego. Used ONLY as the map's
 * initial camera before a real location exists, so the map isn't a blank ocean.
 * It is NOT surfaced as "your location": `hasLocation` stays false until GPS or
 * a manual pick, and the home feed gates on that.
 */
const DEFAULT_CAMERA: SelectedLocation = {
  label: 'San Diego, CA',
  latitude: 32.7157,
  longitude: -117.1611,
};

const SelectedLocationContext = createContext<SelectedLocationContextValue | null>(null);

/**
 * Holds the user's currently selected browse location.
 *
 * On mount we attempt GPS once. Granted → `hasLocation` flips true with the live
 * fix ("Near you"). Denied/unresolved → we stay `unset` (home shows the
 * share-location takeover; the map still opens on the neutral camera). The user
 * can later grant via `requestLocation()` or pick a city via `setLocation` —
 * either one flips `hasLocation` true and the home feed comes alive.
 */
export function SelectedLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<SelectedLocation>(DEFAULT_CAMERA);
  const [mode, setMode] = useState<LocationMode>('unset');
  const [gpsResolved, setGpsResolved] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);

  // Read the LAST KNOWN fix on mount without prompting — if the user already
  // granted location to the app on a prior run, light up immediately. We do NOT
  // fire a permission prompt on cold start; that's reserved for an explicit
  // "Use my location" tap so the OS dialog has clear user intent behind it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setGpsDenied(status === 'denied');
            setGpsResolved(true); // resolved = "we checked"; mode stays 'unset'
          }
          return;
        }
        const cached = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
        const pos = cached ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (cancelled) return;
        setLocationState({
          label: 'Near you',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          fromGPS: true,
        });
        setMode('gps');
        setGpsResolved(true);
      } catch {
        if (!cancelled) setGpsResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsDenied(true);
        setGpsResolved(true);
        return false;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationState({
        label: 'Near you',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        fromGPS: true,
      });
      setMode('gps');
      setGpsDenied(false);
      setGpsResolved(true);
      return true;
    } catch {
      setGpsResolved(true);
      return false;
    }
  }, []);

  const setLocation = useCallback((loc: SelectedLocation) => {
    // Manually-picked locations override GPS; mark not-from-GPS so the label
    // shows the city instead of "Near you", and flip to a real location.
    setLocationState({ ...loc, fromGPS: false });
    setMode('picked');
  }, []);

  const value = useMemo(
    () => ({
      location,
      setLocation,
      gpsResolved,
      gpsDenied,
      hasLocation: mode !== 'unset',
      requestLocation,
    }),
    [location, setLocation, gpsResolved, gpsDenied, mode, requestLocation],
  );

  return (
    <SelectedLocationContext.Provider value={value}>{children}</SelectedLocationContext.Provider>
  );
}

export function useSelectedLocation() {
  const ctx = useContext(SelectedLocationContext);
  if (!ctx) throw new Error('useSelectedLocation must be used inside <SelectedLocationProvider>');
  return ctx;
}

/** Curated v0 city list. Real GPS + geocoding comes in a follow-up patch. */
export const POPULAR_CITIES: SelectedLocation[] = [
  { label: 'San Diego, CA', latitude: 32.7157, longitude: -117.1611 },
  { label: 'Los Angeles, CA', latitude: 34.0522, longitude: -118.2437 },
  { label: 'Las Vegas, NV', latitude: 36.1699, longitude: -115.1398 },
  { label: 'Miami, FL', latitude: 25.7617, longitude: -80.1918 },
  { label: 'New York, NY', latitude: 40.7128, longitude: -74.006 },
];
