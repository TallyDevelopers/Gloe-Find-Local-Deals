/** Canonical amenity list shown to vendors + consumers. Slug -> label + icon. */
export const AMENITIES = [
  { slug: 'free_parking', label: 'Free parking', icon: '🅿️' },
  { slug: 'street_parking', label: 'Street parking', icon: '🚗' },
  { slug: 'wifi', label: 'Free Wi-Fi', icon: '📶' },
  { slug: 'wheelchair_accessible', label: 'Wheelchair accessible', icon: '♿' },
  { slug: 'free_consultation', label: 'Free consultation', icon: '💬' },
  { slug: 'numbing_included', label: 'Complimentary numbing', icon: '🧊' },
  { slug: 'financing', label: 'Financing available', icon: '💳' },
  { slug: 'private_rooms', label: 'Private treatment rooms', icon: '🚪' },
  { slug: 'evening_hours', label: 'Evening hours', icon: '🌙' },
  { slug: 'weekend_hours', label: 'Weekend hours', icon: '📅' },
] as const;

export type AmenitySlug = (typeof AMENITIES)[number]['slug'];

const VALID = new Set(AMENITIES.map((a) => a.slug));

export function sanitizeAmenities(input: string[]): string[] {
  return input.filter((s) => VALID.has(s as AmenitySlug));
}
