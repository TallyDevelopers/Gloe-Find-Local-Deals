/** Mirrors the API's amenity list. Slug -> label + icon. */
export const AMENITY_LIST = [
  { slug: 'free_parking', label: 'Free parking', icon: '🅿️' },
  { slug: 'street_parking', label: 'Street parking', icon: '🚗' },
  { slug: 'wifi', label: 'Free Wi-Fi', icon: '📶' },
  { slug: 'wheelchair_accessible', label: 'Wheelchair accessible', icon: '♿' },
  { slug: 'free_consultation', label: 'Free consultation', icon: '💬' },
  { slug: 'numbing_included', label: 'Complimentary numbing', icon: '🧊' },
  { slug: 'financing', label: 'Financing available', icon: '💳' },
  { slug: 'private_rooms', label: 'Private rooms', icon: '🚪' },
  { slug: 'evening_hours', label: 'Evening hours', icon: '🌙' },
  { slug: 'weekend_hours', label: 'Weekend hours', icon: '📅' },
] as const;

export const AMENITY_META: Record<string, { label: string; icon: string }> = Object.fromEntries(
  AMENITY_LIST.map((a) => [a.slug, { label: a.label, icon: a.icon }]),
);
