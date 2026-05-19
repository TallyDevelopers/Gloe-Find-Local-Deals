import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { useState, type ReactNode } from 'react';

import { trpc } from './trpc';

interface TrpcProviderProps {
  apiUrl: string;
  /** Async function the client calls when it needs a fresh Clerk session token. */
  getToken: () => Promise<string | null>;
  children: ReactNode;
}

/**
 * Wires up React Query + tRPC for the mobile app. Authorization header is
 * attached per request by calling `getToken()` (passed in by the host app
 * so we don't bake Clerk into this package).
 */
export function TrpcProvider({ apiUrl, getToken, children }: TrpcProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            (typeof __DEV__ !== 'undefined' && __DEV__) ||
            (op.direction === 'down' && op.result instanceof Error),
        }),
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          async headers() {
            const token = await getToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
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

// React Native global flag — declared here so the package doesn't need RN as a dep
declare const __DEV__: boolean | undefined;
