import { uploadBytes } from '../db/storage';
import { staticMapUrl } from './googleMaps';

const MAP_BUCKET = 'deal-maps';

/**
 * Fetches the static map PNG from Google once and caches it in our storage,
 * returning the public URL. Called when a deal's redemption location is set so
 * customers load our cached image instead of hitting Google per view. Returns
 * null on any failure — the deal still saves; the map just won't show.
 */
export async function cacheStaticMap(dealId: string, lat: number, lng: number): Promise<string | null> {
  const googleUrl = staticMapUrl({ lat, lng });
  if (!googleUrl) return null;
  try {
    const res = await fetch(googleUrl);
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    return await uploadBytes(MAP_BUCKET, `${dealId}.png`, bytes, 'image/png');
  } catch {
    return null;
  }
}
