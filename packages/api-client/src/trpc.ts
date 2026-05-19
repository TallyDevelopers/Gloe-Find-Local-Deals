import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@gloe/api/src/router';

/**
 * Typed React tRPC client. Screens import the hooks via `trpc.deals.list.useQuery(...)`
 * and get full IntelliSense + return type inference from the API server.
 */
export const trpc = createTRPCReact<AppRouter>();

export type { AppRouter };
