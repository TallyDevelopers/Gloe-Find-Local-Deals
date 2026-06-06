/** Mirrors the API's VIBES list (apps/api/src/domain/vibes.ts) for display on the consumer side. */
export const VIBE_META: Record<string, { label: string; icon: string }> = {
  clinical: { label: 'Clinical & medical', icon: '🩺' },
  luxe: { label: 'Luxe & pampering', icon: '🥂' },
  trendy: { label: 'Trendy & social', icon: '✨' },
  cozy: { label: 'Cozy & boutique', icon: '🕯️' },
  discreet: { label: 'Discreet & private', icon: '🤫' },
  wellness: { label: 'Holistic wellness', icon: '🌿' },
  fast: { label: 'Quick & convenient', icon: '⚡' },
  high_end: { label: 'High-end & exclusive', icon: '💎' },
};
