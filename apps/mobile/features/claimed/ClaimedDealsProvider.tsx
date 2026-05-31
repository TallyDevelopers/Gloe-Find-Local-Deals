import { useAuth } from '@gloe/auth';
import { trpc, type Claim as ApiClaim } from '@gloe/api-client';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { prefetchImages } from '../image/CachedImage';
import type { ClaimedDeal } from './types';

interface CreateClaimInput {
  dealId: string;
  variantId: string;
  // snapshot is now server-built; left here for API compatibility with old callers
  snapshot?: unknown;
}

interface ClaimedDealsContextValue {
  claims: ClaimedDeal[];
  activeClaims: ClaimedDeal[];
  pastClaims: ClaimedDeal[];
  getById: (claimId: string) => ClaimedDeal | undefined;
  hasActiveClaimFor: (dealId: string, variantId: string) => boolean;
  createClaim: (input: CreateClaimInput) => Promise<ClaimedDeal>;
  refetch: () => Promise<unknown>;
}

const ClaimedDealsContext = createContext<ClaimedDealsContextValue | null>(null);

/**
 * API-backed claims provider. Screens consume the same shape they did when
 * this was in-memory — the shape was deliberately written to match the API
 * payload so the swap is free.
 */
export function ClaimedDealsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isSignedIn = status === 'signed-in';
  const utils = trpc.useUtils();

  const listQuery = trpc.claims.list.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const createMutation = trpc.claims.create.useMutation({
    onSuccess: () => utils.claims.list.invalidate(),
  });

  const claims: ClaimedDeal[] = useMemo(
    () => (listQuery.data ?? []).map(apiToClient),
    [listQuery.data],
  );

  const { activeClaims, pastClaims } = useMemo(() => {
    const now = Date.now();
    return claims.reduce<{ activeClaims: ClaimedDeal[]; pastClaims: ClaimedDeal[] }>(
      (acc, claim) => {
        const isPast = claim.status !== 'active' || claim.expiresAt < now;
        if (isPast) acc.pastClaims.push(claim);
        else acc.activeClaims.push(claim);
        return acc;
      },
      { activeClaims: [], pastClaims: [] },
    );
  }, [claims]);

  // Warm the voucher rows up front. The claim snapshot has no photo URL, so each
  // row otherwise fires its own deals.byId just to learn the image URL — that's
  // why "Your Deals" photos used to stream in one by one. Here we prefetch the
  // deal data for active claims AND, as each resolves, warm its photo into the
  // image cache, so the list paints with images instead of a waterfall. Bounded
  // to the first ~8 active claims to avoid over-fetching history.
  useEffect(() => {
    if (!isSignedIn) return;
    for (const claim of activeClaims.slice(0, 8)) {
      utils.deals.byId
        .fetch({ id: claim.dealId })
        .then((deal) => prefetchImages([deal?.photos?.[0]?.url]))
        .catch(() => {});
    }
  }, [isSignedIn, activeClaims, utils]);

  const getById = useCallback(
    (claimId: string) => claims.find((c) => c.id === claimId),
    [claims],
  );

  const hasActiveClaimFor = useCallback(
    (dealId: string, variantId: string) =>
      claims.some(
        (c) => c.dealId === dealId && c.variantId === variantId && c.status === 'active',
      ),
    [claims],
  );

  const createClaim = useCallback(
    async ({ dealId, variantId }: CreateClaimInput): Promise<ClaimedDeal> => {
      const result = await createMutation.mutateAsync({ dealId, variantId });
      return apiToClient(result);
    },
    [createMutation],
  );

  const refetch = useCallback(() => listQuery.refetch(), [listQuery]);

  const value = useMemo<ClaimedDealsContextValue>(
    () => ({
      claims,
      activeClaims,
      pastClaims,
      getById,
      hasActiveClaimFor,
      createClaim,
      refetch,
    }),
    [claims, activeClaims, pastClaims, getById, hasActiveClaimFor, createClaim, refetch],
  );

  return <ClaimedDealsContext.Provider value={value}>{children}</ClaimedDealsContext.Provider>;
}

export function useClaimedDeals() {
  const ctx = useContext(ClaimedDealsContext);
  if (!ctx) throw new Error('useClaimedDeals must be used inside <ClaimedDealsProvider>');
  return ctx;
}

function apiToClient(api: ApiClaim): ClaimedDeal {
  return {
    id: api.id,
    dealId: api.dealId,
    variantId: api.variantId,
    snapshot: {
      dealTitle: api.snapshot.dealTitle,
      vendorName: api.snapshot.vendorName,
      vendorId: api.snapshot.vendorId,
      variantLabel: api.snapshot.variantLabel,
      originalPriceCents: api.snapshot.originalPriceCents,
      dealPriceCents: api.snapshot.dealPriceCents,
    },
    qrPayload: api.qrPayload,
    humanCode: api.humanCode,
    status: api.status === 'cancelled' ? 'expired' : api.status,
    createdAt: new Date(api.createdAt).getTime(),
    expiresAt: new Date(api.expiresAt).getTime(),
    redeemedAt: api.redeemedAt ? new Date(api.redeemedAt).getTime() : null,
  };
}
