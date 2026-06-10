import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk, Inter, Outfit, Poppins } from 'next/font/google';
import type { ReactNode } from 'react';

import { JsonLd, organizationLd, websiteLd } from '../lib/jsonLd';
import { TrpcProvider } from '../lib/TrpcProvider';
import './globals.css';

// Fraunces — high-end serif used LIGHT (weight 300) for hero/headlines, the
// ResortPass "Moulin" look. Hanken Grotesk — clean grotesque for body/UI, the
// "Basetica" look. Inter stays for surfaces that reference it directly (gift).
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const hanken = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken', display: 'swap' });
// Outfit — modern geometric sans for the Gloē wordmark AND the consumer
// marketplace headlines (--font-display). latin-ext includes ē. 700 gives the
// big hero/section headlines real weight.
const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-outfit',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
// Poppins — the consumer marketplace display face (approved June 2026 Discover
// comp): hero headline, section heads, card titles/prices. The wordmark stays
// Outfit — that decision is locked; this is everything-but-the-wordmark.
const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-poppins',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gloe.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Gloē — Beauty + wellness, beautifully booked.', template: '%s · Gloē' },
  description:
    'Book vetted beauty & wellness near you — botox, fillers, facials, laser and more at top-rated medspas. Save up to 60%, voucher delivered instantly.',
  applicationName: 'Gloē',
  keywords: [
    'medspa deals',
    'botox near me',
    'lip filler near me',
    'hydrafacial near me',
    'laser hair removal deals',
    'beauty deals near me',
    'wellness deals',
    'med spa near me',
    'Gloē',
  ],
  authors: [{ name: 'Gloē' }],
  creator: 'Gloē',
  publisher: 'Gloē',
  formatDetection: { email: false, telephone: false, address: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Gloē',
    title: 'Gloē — Beauty + wellness, beautifully booked.',
    description:
      'Book vetted beauty & wellness deals near you — botox, fillers, facials, laser and more at top-rated medspas. Save up to 60%.',
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gloē — Beauty + wellness, beautifully booked.',
    description: 'Vetted beauty & wellness deals near you — top-rated medspas, up to 60% off.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF5F2' },
    { media: '(prefers-color-scheme: dark)', color: '#15110F' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${fraunces.variable} ${inter.variable} ${hanken.variable} ${outfit.variable} ${poppins.variable}`}>
        <body>
          <JsonLd data={[organizationLd(), websiteLd()]} />
          <TrpcProvider>{children}</TrpcProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
