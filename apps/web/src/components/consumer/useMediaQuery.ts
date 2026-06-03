'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe media-query hook. Starts `false` (so server render + desktop match
 * the default) and updates to the real value after mount. Used to branch
 * mobile-only behavior — e.g. opening a slide-up checkout sheet on phones while
 * desktop keeps its direct action.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
