/**
 * Canonical "vibe" list — the emotional feel of a spa, which in aesthetics is a
 * real purchase driver (clinical-and-medical vs. luxe-and-pampering vs. trendy).
 * Vendors self-select 1–3; consumers filter the map by them. Slug -> label +
 * icon, mirroring the amenities pattern so both render the same way.
 */
export const VIBES = [
  { slug: 'clinical', label: 'Clinical & medical', icon: '🩺', blurb: 'Doctor-led, results-first' },
  { slug: 'luxe', label: 'Luxe & pampering', icon: '🥂', blurb: 'Spa-day indulgence' },
  { slug: 'trendy', label: 'Trendy & social', icon: '✨', blurb: 'Of-the-moment, photogenic' },
  { slug: 'cozy', label: 'Cozy & boutique', icon: '🕯️', blurb: 'Small, personal, warm' },
  { slug: 'discreet', label: 'Discreet & private', icon: '🤫', blurb: 'Low-key, by appointment' },
  { slug: 'wellness', label: 'Holistic wellness', icon: '🌿', blurb: 'Natural, restorative' },
  { slug: 'fast', label: 'Quick & convenient', icon: '⚡', blurb: 'In-and-out, lunch-break friendly' },
  { slug: 'high_end', label: 'High-end & exclusive', icon: '💎', blurb: 'Premium, celebrity-grade' },
] as const;

export type VibeSlug = (typeof VIBES)[number]['slug'];

const VALID = new Set(VIBES.map((v) => v.slug));

/** Keep only known slugs; cap at 3 so the card/pin stays readable. */
export function sanitizeVibes(input: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const s of input) {
    if (VALID.has(s as VibeSlug) && !seen.has(s)) {
      seen.add(s);
      clean.push(s);
      if (clean.length === 3) break;
    }
  }
  return clean;
}

/** Label lookup for display surfaces. */
export function vibeLabel(slug: string): string {
  return VIBES.find((v) => v.slug === slug)?.label ?? slug;
}
