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
          // Log in dev, plus any real errors regardless of env.
          enabled: (op) =>
            (typeof __DEV__ !== 'undefined' && __DEV__) ||
            (op.direction === 'down' && op.result instanceof Error),
          // Drop the browser-only `%c` CSS that RN's console can't render
          // (the "background-color: #3fb0d8..." noise).
          colorMode: 'none',
          // Custom logger: route routine request/response logs through
          // console.log so React Native's LogBox doesn't promote them to a
          // red "Console Error" overlay. Only genuine errors use console.error.
          logger: (opts) => {
            const isError = opts.direction === 'down' && opts.result instanceof Error;
            const tag = opts.direction === 'up' ? '→ trpc' : '← trpc';
            const line = `${tag} ${opts.type} ${opts.path}`;
            if (isError) {
              console.error(line, opts.result);
            } else {
              console.log(line);
            }
          },
        }),
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          async headers() {
            // Don't let a slow/hanging Clerk token fetch block the request
            // forever — public queries (deals, categories) must still load. If
            // the token isn't ready within 4s, send the request unauthenticated
            // rather than spinning indefinitely.
            const token = await withTimeout(getToken(), 4000);
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

/** Resolve `promise`, or `null` if it doesn't settle within `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// React Native global flag — declared here so the package doesn't need RN as a dep
declare const __DEV__: boolean | undefined;
