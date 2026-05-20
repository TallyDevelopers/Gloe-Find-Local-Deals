'use client';

import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@gloe/api-client';

/**
 * Web tRPC client. Same AppRouter type as the mobile app — full end-to-end
 * type safety against the one API server.
 */
export const trpc = createTRPCReact<AppRouter>();
