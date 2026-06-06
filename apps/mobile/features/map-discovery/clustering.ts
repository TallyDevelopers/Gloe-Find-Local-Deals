import type { Region } from 'react-native-maps';

import type { SpaPin } from './spaGrouping';

/**
 * A rendered map item: either a single spa pin or a cluster of nearby pins.
 * We cluster client-side with a fixed pixel-ish grid derived from the current
 * region span — no extra dependency, plenty for our spa density. (react-native-maps
 * 1.18 has no built-in clustering; supercluster would be overkill here.)
 */
export type MapItem =
  | { kind: 'pin'; pin: SpaPin; lat: number; lng: number }
  | { kind: 'cluster'; id: string; lat: number; lng: number; count: number; pins: SpaPin[] };

/** Roughly how many grid cells span the visible width — higher = pins merge less. */
const GRID_COLUMNS = 8;

/**
 * Bucket pins into a lat/lng grid sized to the current zoom. Cells with one pin
 * render as a pin; cells with several render as a count bubble. As the user
 * zooms in, the region deltas shrink, cells shrink, and clusters break apart —
 * the standard map-clustering behavior without a library.
 */
export function clusterPins(pins: SpaPin[], region: Region): MapItem[] {
  // Guard against a degenerate/zero span (e.g. before the first layout).
  const cell = Math.max(region.longitudeDelta, region.latitudeDelta, 1e-4) / GRID_COLUMNS;
  const buckets = new Map<string, SpaPin[]>();
  for (const pin of pins) {
    const col = Math.floor(pin.lng / cell);
    const row = Math.floor(pin.lat / cell);
    const key = `${col}:${row}`;
    const list = buckets.get(key);
    if (list) list.push(pin);
    else buckets.set(key, [pin]);
  }

  const items: MapItem[] = [];
  for (const [key, group] of buckets) {
    if (group.length === 1) {
      const pin = group[0]!;
      items.push({ kind: 'pin', pin, lat: pin.lat, lng: pin.lng });
    } else {
      // Cluster marker sits at the group's centroid.
      const lat = group.reduce((s, p) => s + p.lat, 0) / group.length;
      const lng = group.reduce((s, p) => s + p.lng, 0) / group.length;
      items.push({ kind: 'cluster', id: key, lat, lng, count: group.length, pins: group });
    }
  }
  return items;
}

/** A region tightened by one zoom step, centered on a point — for tapping a cluster. */
export function zoomInto(lat: number, lng: number, region: Region): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: Math.max(region.latitudeDelta / 2.5, 0.01),
    longitudeDelta: Math.max(region.longitudeDelta / 2.5, 0.01),
  };
}
