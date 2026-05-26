import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, Outfit } from 'next/font/google';
import type { ReactNode } from 'react';

import { TrpcProvider } from '../lib/TrpcProvider';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Outfit — modern geometric sans for the Gloē wordmark. latin-ext includes ē.
const outfit = Outfit({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-outfit',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gloe.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Gloē — Beauty + wellness, beautifully booked.', template: '%s · Gloē' },
  description:
    'Discover same-day beauty and wellness deals near you. Book botox, facials, hair, brows, and more — at premium spas, instantly.',
  applicationName: 'Gloē',
  keywords: [
    'beauty deals',
    'wellness deals',
    'last-minute spa booking',
    'botox near me',
    'medspa deals',
    'beauty booking app',
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
      'Same-day beauty and wellness deals near you. Book botox, facials, hair, brows, and more at premium spas.',
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gloē — Beauty + wellness, beautifully booked.',
    description: 'Same-day beauty and wellness deals near you.',
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
      <html lang="en" className={`${fraunces.variable} ${inter.variable} ${outfit.variable}`}>
        <body>
          <TrpcProvider>{children}</TrpcProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
