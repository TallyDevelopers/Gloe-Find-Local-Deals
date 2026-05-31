import { trpc } from '@gloe/api-client';
import { useEffect } from 'react';

/**
 * Warms cheap, always-needed data at app launch so the first screen paints from
 * cache instead of a cold spinner. Most lists (claims, saved, support) are
 * already fetched by their own providers at boot — the gap is the static
 * category taxonomy, which otherwise loads lazily only when Discover's filter
 * pills first render. Warming it here removes that pop-in.
 *
 * Renders nothing; mounted once inside the provider tree.
 */
export function BootWarmup() {
  const utils = trpc.useUtils();

  useEffect(() => {
    // Static reference data, no auth required, hit on the very first tab.
    utils.categories.list.prefetch(undefined);
  }, [utils]);

  return null;
}
