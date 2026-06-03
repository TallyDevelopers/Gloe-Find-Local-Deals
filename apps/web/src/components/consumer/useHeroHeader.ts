'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Drives the "transparent over the hero, solid after you scroll" header.
 *
 * Returns true only on a page that HAS a hero (currently just home, `/`) while
 * the page is scrolled up near the top. Once you scroll past the threshold — or
 * on any page without a hero — it returns false and the header renders solid.
 *
 * Both TopNav and MobileHeader read this and add `.over-hero` to themselves.
 */
export function useHeroHeader(): boolean {
  const pathname = usePathname();
  const hasHero = pathname === '/';
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    if (!hasHero) {
      setAtTop(false);
      return;
    }
    // Flip to solid a bit before the hero fully scrolls away, so the swap
    // happens while the header is still over image, not over content.
    const onScroll = () => setAtTop(window.scrollY < 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasHero]);

  return hasHero && atTop;
}
