'use client';

import { useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, type ReactNode } from 'react';

import { trpc } from './trpc';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Pending invite code, set as a cookie by /r/[code] (GLO-24 referrals). Rides
 * on every request; the API only reads it at JIT user creation — the one
 * moment a signup is provably new — so attribution survives the Clerk
 * sign-up round trip without any client-side state handoff.
 */
function pendingReferralCode(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)gloe_ref=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Wires React Query + tRPC for the web app, attaching the Clerk session token
 * to every request so the API can identify the vendor/admin user.
 */
export function TrpcProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${API_URL}/trpc`,
          async headers() {
            const token = await getToken();
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
            const referralCode = pendingReferralCode();
            if (referralCode) headers['x-gloe-referral-code'] = referralCode;
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
