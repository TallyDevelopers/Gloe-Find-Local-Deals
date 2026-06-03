'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLocation } from '../../lib/location';
import { SearchOverlay } from './SearchOverlay';
import { MapPin, Search } from './icons';

/**
 * Mobile-only sticky search bar. Hidden until you scroll past the hero, then it
 * slides in under the header so search + location stay one thumb-tap away the
 * whole way down the feed (DoorDash/Airbnb pattern). Tapping routes to /search,
 * which owns the actual query input. Desktop never renders it (CSS `display`).
 */
export function StickySearch() {
  const { location } = useLocation();
  const isHome = usePathname() === '/';
  const [shown, setShown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    // On home, reveal only once the hero (with its own search) has scrolled
    // away — no double search bar over the hero. Off home there's no hero, so
    // reveal as soon as the page header search would be useful.
    const threshold = isHome ? 360 : 60;
    const onScroll = () => setShown(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  return (
    <>
      <div className={`sticky-search${shown ? ' is-shown' : ''}`} aria-hidden={!shown}>
        <button
          type="button"
          className="sticky-search-inner"
          onClick={() => setSearchOpen(true)}
          tabIndex={shown ? 0 : -1}
        >
          <Search size={18} color="var(--text-tertiary)" />
          <span>Search botox, facials, laser…</span>
          {location?.label ? (
            <span className="sticky-search-loc">
              <MapPin size={13} color="var(--brand-600)" />
              {location.label}
            </span>
          ) : null}
        </button>
      </div>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
