import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface SelectedLocation {
  label: string;       // human display, e.g. "San Diego, CA"
  latitude: number;
  longitude: number;
}

interface SelectedLocationContextValue {
  location: SelectedLocation;
  setLocation: (loc: SelectedLocation) => void;
}

/** v0 default until real GPS / city selector is wired. Downtown San Diego. */
const DEFAULT_LOCATION: SelectedLocation = {
  label: 'San Diego, CA',
  latitude: 32.7157,
  longitude: -117.1611,
};

const SelectedLocationContext = createContext<SelectedLocationContextValue | null>(null);

/**
 * Holds the user's currently selected browse location. Used by Discover for
 * the API call (deals near these coords) and by the LocationPill for display.
 *
 * When we wire real GPS + geocoding, the setLocation call here doesn't change
 * — only the picker UI inside LocationPill changes.
 */
export function SelectedLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<SelectedLocation>(DEFAULT_LOCATION);

  const setLocation = useCallback((loc: SelectedLocation) => {
    setLocationState(loc);
  }, []);

  const value = useMemo(() => ({ location, setLocation }), [location, setLocation]);

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
