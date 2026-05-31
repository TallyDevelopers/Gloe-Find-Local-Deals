import { trpc } from '@gloe/api-client';
import { useCallback, useMemo } from 'react';

import { prefetchImages } from '../image/CachedImage';

/**
 * Prefetch helpers — warm a screen's data BEFORE the user arrives so it paints
 * from cache with no spinner. The trick: call these on `onPressIn` (fires
 * ~80–150ms before navigation commits), which lands inside the warm-query
 * window. Combined with the global 30s staleTime, a press-in + tap is a
 * guaranteed cache hit.
 *
 * All fire-and-forget — never awaited in the UI, never block a tap.
 */
export function usePrefetch() {
  const utils = trpc.useUtils();

  const deal = useCallback(
    (id: string) => {
      utils.deals.byId.prefetch({ id });
    },
    [utils],
  );

  const vendor = useCallback(
    (id: string) => {
      utils.vendors.storefront.prefetch({ id });
    },
    [utils],
  );

  const supportCase = useCallback(
    (id: string) => {
      utils.support.getCase.prefetch({ id });
    },
    [utils],
  );

  // Warm a batch of deal photos into the image cache (e.g. the cards just
  // loaded into the feed) so they're already decoded when scrolled into view —
  // no more "pictures load one by one."
  const images = useCallback((uris: (string | null | undefined)[]) => {
    prefetchImages(uris);
  }, []);

  // Memoize the wrapper so consumers can safely put `prefetch` in effect deps
  // without the effect re-firing on every render (the inner callbacks are
  // already stable; only the object identity needed pinning).
  return useMemo(() => ({ deal, vendor, supportCase, images }), [deal, vendor, supportCase, images]);
}
