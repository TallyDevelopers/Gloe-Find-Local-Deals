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

export const metadata: Metadata = {
  title: 'Gloē for Business',
  description: 'Post deals, manage redemptions, and get paid — for med spas and aesthetic providers.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
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
