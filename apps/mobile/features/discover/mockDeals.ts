/**
 * Temporary seed data so the Discover feed has something to render before we
 * wire up the real API + database. Delete this once the real backend exists.
 *
 * Images are from Unsplash and used royalty-free for placeholder/demo purposes.
 */

export interface MockReview {
  id: string;
  authorFirstName: string;
  rating: number;
  body: string;
  createdAt: string; // human-readable for demo
}

export interface MockProvider {
  name: string;
  title: 'MD' | 'NP' | 'RN' | 'PA';
  bio: string;
  photoUrl?: string;
}

export interface MockCustomerVideo {
  id: string;
  thumbnailUrl: string;
  /** Vendor-supplied caption. */
  caption?: string;
  /** Optional human-readable duration like "0:42". */
  duration?: string;
}

export interface MockDealVariant {
  id: string;
  label: string;            // e.g., "20 units", "40 units", "1 syringe"
  unitCount?: number;
  unitLabel?: string;
  originalPriceCents: number;
  dealPriceCents: number;
  spotsTotal?: number;
  spotsClaimed?: number;
}

export interface MockDeal {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorReviewCount: number;
  vendorAddress: string;
  vendorDistance: string;
  vendorHours: string;
  category: string;
  subtype: string;
  title: string;
  description: string;
  whatsIncluded: string[];
  expiresIn: string;
  restrictions: string[];
  galleryImages: string[];    // all carousel images
  provider: MockProvider;
  topReviews: MockReview[];
  variants: MockDealVariant[];  // at least one; user picks
  customerVideos?: MockCustomerVideo[];   // optional; vendor-uploaded
}

/** Convenience: the "feed" view uses the first variant for display. */
export function getDisplayVariant(deal: MockDeal): MockDealVariant {
  // Non-empty by construction (validated below). We assert because TS doesn't
  // know variants is guaranteed to have at least 1.
  const first = deal.variants[0];
  if (!first) throw new Error(`Deal ${deal.id} has no variants`);
  return first;
}

const u = (id: string, w = 1200, h = 900) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;

export const mockDeals: MockDeal[] = [
  {
    id: '1',
    vendorId: 'v-glow-la-jolla',
    vendorName: 'Glow Aesthetics La Jolla',
    vendorRating: 4.9,
    vendorReviewCount: 312,
    vendorAddress: '7777 Girard Ave, La Jolla, CA',
    vendorDistance: '1.2 mi',
    vendorHours: 'Mon–Sat · 9am–7pm',
    category: 'Botox',
    subtype: 'Botox',
    title: 'Botox — first-timer special',
    description:
      'Soften forehead lines, glabella, and crow’s feet with precise Botox injections from a licensed nurse practitioner. New clients only.',
    whatsIncluded: [
      'Botox injections',
      'Complimentary 15-min consultation',
      'Personalized treatment plan',
      '2-week follow-up',
    ],
    expiresIn: '3 days',
    restrictions: [
      'New clients only',
      'Cannot combine with other offers',
      'Consultation required before treatment',
    ],
    galleryImages: [
      u('1570172619644-dfd03ed5d881'),
      u('1556228720-195a672e8a03'),
      u('1612349317150-e413f6a5b16d'),
      u('1522337360788-8b13dee7a37e'),
    ],
    provider: {
      name: 'Madison Reyes',
      title: 'NP',
      bio: 'Board-certified nurse practitioner with 8+ years in aesthetic injectables.',
      photoUrl: u('1494790108377-be9c29b29330', 400, 400),
    },
    topReviews: [
      {
        id: 'r1',
        authorFirstName: 'Sarah',
        rating: 5,
        body: 'Madison is the best. Natural results, no bruising, beautiful office.',
        createdAt: '2 weeks ago',
      },
      {
        id: 'r2',
        authorFirstName: 'Jessica',
        rating: 5,
        body: 'Honest pricing and zero pressure. Will be back for filler.',
        createdAt: '1 month ago',
      },
    ],
    variants: [
      {
        id: '1-20',
        label: '20 units',
        unitCount: 20,
        unitLabel: 'units',
        originalPriceCents: 28000,
        dealPriceCents: 20000,
        spotsTotal: 20,
        spotsClaimed: 6,
      },
      {
        id: '1-40',
        label: '40 units',
        unitCount: 40,
        unitLabel: 'units',
        originalPriceCents: 52000,
        dealPriceCents: 38000,
        spotsTotal: 15,
        spotsClaimed: 4,
      },
      {
        id: '1-60',
        label: '60 units',
        unitCount: 60,
        unitLabel: 'units',
        originalPriceCents: 76000,
        dealPriceCents: 54000,
        spotsTotal: 10,
        spotsClaimed: 2,
      },
    ],
    customerVideos: [
      {
        id: 'cv1',
        thumbnailUrl: u('1612349317150-e413f6a5b16d'),
        caption: 'Madison talks through what to expect for first-timers.',
        duration: '0:48',
      },
      {
        id: 'cv2',
        thumbnailUrl: u('1556228720-195a672e8a03'),
        caption: 'Behind the scenes — our injection technique.',
        duration: '1:12',
      },
    ],
  },
  {
    id: '2',
    vendorId: 'v-badia',
    vendorName: 'Badia Wellness',
    vendorRating: 4.9,
    vendorReviewCount: 188,
    vendorAddress: '4242 Camino Del Rio N, San Diego, CA',
    vendorDistance: '2.4 mi',
    vendorHours: 'Tue–Sat · 10am–6pm',
    category: 'Filler',
    subtype: 'Juvederm Volbella',
    title: 'Lip filler — Juvederm Volbella',
    description:
      'Subtle, natural-looking lip enhancement with Juvederm Volbella. Ideal for definition and gentle volume. Results last 12+ months.',
    whatsIncluded: [
      'Juvederm Volbella filler',
      'Pre-treatment numbing',
      'Aftercare kit',
      '2-week touch-up if needed',
    ],
    expiresIn: '6 days',
    restrictions: [
      'Cannot combine with other offers',
      'Must redeem within 30 days of booking',
    ],
    galleryImages: [
      u('1614859275019-1e9b8e5e3e8c'),
      u('1522337360788-8b13dee7a37e'),
      u('1556228720-195a672e8a03'),
    ],
    provider: {
      name: 'Dr. Lila Badia',
      title: 'MD',
      bio: 'Aesthetics physician with a longevity-focused practice. Decorated ICU nurse alumna.',
      photoUrl: u('1573496359142-b8d87734a5a2', 400, 400),
    },
    topReviews: [
      {
        id: 'r3',
        authorFirstName: 'Amy',
        rating: 5,
        body: 'My lips look like mine but better. Dr. Badia is meticulous.',
        createdAt: '1 week ago',
      },
    ],
    variants: [
      {
        id: '2-1',
        label: '1 syringe',
        unitCount: 1,
        unitLabel: 'syringe',
        originalPriceCents: 75000,
        dealPriceCents: 59000,
        spotsTotal: 10,
        spotsClaimed: 3,
      },
      {
        id: '2-2',
        label: '2 syringes',
        unitCount: 2,
        unitLabel: 'syringes',
        originalPriceCents: 140000,
        dealPriceCents: 109000,
        spotsTotal: 6,
        spotsClaimed: 2,
      },
    ],
  },
  {
    id: '3',
    vendorId: 'v-skin-studio',
    vendorName: 'Skin Studio Hillcrest',
    vendorRating: 4.8,
    vendorReviewCount: 96,
    vendorAddress: '3845 Fourth Ave, San Diego, CA',
    vendorDistance: '3.1 mi',
    vendorHours: 'Wed–Sun · 11am–7pm',
    category: 'Skin',
    subtype: 'Microneedling + PRP',
    title: 'Microneedling + PRP',
    description:
      '60-minute treatment combining microneedling with platelet-rich plasma to stimulate collagen and brighten skin. Series of 3 recommended.',
    whatsIncluded: [
      '60-min microneedling',
      'PRP draw and application',
      'LED light therapy finisher',
      'Take-home recovery serum',
    ],
    expiresIn: '11 days',
    restrictions: ['Not for active acne or pregnancy'],
    galleryImages: [
      u('1570554886111-e80fcca6a029'),
      u('1596178060671-7a80dc8059ea'),
      u('1570172619644-dfd03ed5d881'),
    ],
    provider: {
      name: 'Erin Park',
      title: 'RN',
      bio: 'Aesthetic RN specializing in skin rejuvenation and collagen induction.',
      photoUrl: u('1580489944761-15a19d654956', 400, 400),
    },
    topReviews: [
      {
        id: 'r4',
        authorFirstName: 'Maya',
        rating: 5,
        body: 'Glow for days afterward. Erin made the whole thing comfortable.',
        createdAt: '3 weeks ago',
      },
    ],
    variants: [
      {
        id: '3-single',
        label: 'Single session',
        originalPriceCents: 65000,
        dealPriceCents: 45000,
      },
      {
        id: '3-three-pack',
        label: '3-session series',
        originalPriceCents: 195000,
        dealPriceCents: 120000,
        spotsTotal: 8,
        spotsClaimed: 3,
      },
    ],
  },
  {
    id: '4',
    vendorId: 'v-nad-lounge',
    vendorName: 'NAD Lounge SD',
    vendorRating: 4.7,
    vendorReviewCount: 54,
    vendorAddress: '1234 India St, San Diego, CA',
    vendorDistance: '4.7 mi',
    vendorHours: 'Daily · 9am–8pm',
    category: 'Wellness',
    subtype: 'NAD+ IV',
    title: 'NAD+ longevity drip',
    description:
      'Recharge your cellular energy with a NAD+ infusion. Promotes mental clarity, mitochondrial repair, and recovery.',
    whatsIncluded: [
      'NAD+ IV infusion (~90 min)',
      'Hydration co-drip',
      'Quiet recovery suite',
      'Post-drip electrolytes',
    ],
    expiresIn: '2 days',
    restrictions: ['Medical screening required', '21+ only'],
    galleryImages: [
      u('1582719508461-905c673771fd'),
      u('1576091160550-2173dba999ef'),
      u('1612349317150-e413f6a5b16d'),
    ],
    provider: {
      name: 'Jordan Kim',
      title: 'NP',
      bio: 'IV therapy and longevity-medicine NP. Trained at UCSD Health.',
      photoUrl: u('1568602471122-7832951cc4c5', 400, 400),
    },
    topReviews: [
      {
        id: 'r5',
        authorFirstName: 'Tara',
        rating: 5,
        body: 'I had so much energy for days after. Already booked my next one.',
        createdAt: '5 days ago',
      },
    ],
    variants: [
      {
        id: '4-250',
        label: '250mg',
        originalPriceCents: 32000,
        dealPriceCents: 24900,
      },
      {
        id: '4-500',
        label: '500mg',
        originalPriceCents: 55000,
        dealPriceCents: 39900,
        spotsTotal: 8,
        spotsClaimed: 4,
      },
      {
        id: '4-1000',
        label: '1000mg',
        originalPriceCents: 99000,
        dealPriceCents: 74900,
        spotsTotal: 4,
        spotsClaimed: 1,
      },
    ],
  },
];

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function getDealById(id: string): MockDeal | undefined {
  return mockDeals.find((d) => d.id === id);
}
