'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Wordmark } from '../Wordmark';
import { SearchPanel } from './SearchPanel';
import { X } from './icons';

/**
 * Full-screen in-place search. Opening the sticky search bar mounts this over
 * the current page (no navigation), so dismissing returns you to your exact
 * scroll position. Locks body scroll while open, closes on Esc, and pushes a
 * history entry so the phone's back gesture closes search instead of leaving
 * the page.
 */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;

    // Lock the page behind the overlay.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Esc closes.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // Back gesture / button closes the overlay rather than navigating away.
    window.history.pushState({ gloeSearch: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      // If we're unmounting while our history entry is still on top (closed via
      // Esc / button, not back), pop it so the stack stays clean.
      if (window.history.state?.gloeSearch) window.history.back();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      {/* Keep the site's spine: the wordmark goes home (and closes search), so
          this reads as a layer over Gloē, not a teleport away from it. */}
      <header className="search-overlay-head">
        <Link href="/" aria-label="Gloē home" className="mh-logo" onClick={onClose}>
          <Wordmark size={22} tone="gold" />
        </Link>
        <button type="button" className="mh-btn" aria-label="Close search" onClick={onClose}>
          <X size={22} color="var(--text-primary)" />
        </button>
      </header>
      <div className="search-overlay-scroll">
        <SearchPanel onClose={onClose} />
      </div>
    </div>
  );
}
