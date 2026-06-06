/** Mirrors the API's VIBES list (apps/api/src/domain/vibes.ts). Slug -> label + icon + blurb. */
export const VIBE_LIST = [
  { slug: 'clinical', label: 'Clinical & medical', icon: '🩺', blurb: 'Doctor-led, results-first' },
  { slug: 'luxe', label: 'Luxe & pampering', icon: '🥂', blurb: 'Spa-day indulgence' },
  { slug: 'trendy', label: 'Trendy & social', icon: '✨', blurb: 'Of-the-moment, photogenic' },
  { slug: 'cozy', label: 'Cozy & boutique', icon: '🕯️', blurb: 'Small, personal, warm' },
  { slug: 'discreet', label: 'Discreet & private', icon: '🤫', blurb: 'Low-key, by appointment' },
  { slug: 'wellness', label: 'Holistic wellness', icon: '🌿', blurb: 'Natural, restorative' },
  { slug: 'fast', label: 'Quick & convenient', icon: '⚡', blurb: 'In-and-out, lunch-break friendly' },
  { slug: 'high_end', label: 'High-end & exclusive', icon: '💎', blurb: 'Premium, celebrity-grade' },
] as const;

export const VIBE_META: Record<string, { label: string; icon: string }> = Object.fromEntries(
  VIBE_LIST.map((v) => [v.slug, { label: v.label, icon: v.icon }]),
);

/** Vibes are a 1–3 selection — keep the spa's "feel" focused, not a checklist. */
export const MAX_VIBES = 3;
