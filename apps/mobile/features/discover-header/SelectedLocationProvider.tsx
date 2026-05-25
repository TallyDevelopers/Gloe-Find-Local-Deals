import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface SelectedLocation {
  label: string;       // human display, e.g. "San Diego, CA"
  latitude: number;
  longitude: number;
  /** True if this came from the device GPS. False if user picked a city. */
  fromGPS?: boolean;
}

interface SelectedLocationContextValue {
  location: SelectedLocation;
  setLocation: (loc: SelectedLocation) => void;
  /** True once we've attempted to read GPS (succeeded or denied). */
  gpsResolved: boolean;
  /** True if the user denied location permission. UI can suggest enabling it. */
  gpsDenied: boolean;
}

/** Fallback used until GPS resolves or the user picks a city. Downtown San Diego. */
const FALLBACK_LOCATION: SelectedLocation = {
  label: 'San Diego, CA',
  latitude: 32.7157,
  longitude: -117.1611,
};

const SelectedLocationContext = createContext<SelectedLocationContextValue | null>(null);

/**
 * Holds the user's currently selected browse location.
 *
 * On mount, asks the device for GPS once. If granted + we get coords, the
 * location is updated to "Near you" with the live lat/lng. If denied, we
 * stay on the fallback (San Diego) and surface `gpsDenied=true` so UI can
 * nudge the user toward Settings.
 *
 * `setLocation` is still the entry point for the city picker — picking a
 * city overrides GPS and stays sticky until they GPS again or pick another.
 */
export function SelectedLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<SelectedLocation>(FALLBACK_LOCATION);
  const [gpsResolved, setGpsResolved] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);

  // Read GPS once on mount. Don't block render — if it takes a moment, the user
  // sees deals around the fallback while we resolve.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setGpsDenied(true);
            setGpsResolved(true);
          }
          return;
        }
        // Balanced accuracy is plenty for "deals near you" — high accuracy uses
        // more battery and adds latency for no real benefit at city scale.
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setLocationState({
          label: 'Near you',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          fromGPS: true,
        });
        setGpsResolved(true);
      } catch {
        if (!cancelled) {
          // Location services off, airplane mode, etc. Keep fallback silently.
          setGpsResolved(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setLocation = useCallback((loc: SelectedLocation) => {
    // Manually-picked locations override GPS; mark not-from-GPS so the pill
    // displays the city label instead of "Near you."
    setLocationState({ ...loc, fromGPS: false });
  }, []);

  const value = useMemo(
    () => ({ location, setLocation, gpsResolved, gpsDenied }),
    [location, setLocation, gpsResolved, gpsDenied],
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
