'use client';

import { useState } from 'react';

import { useLocation } from '../../lib/location';
import { LocationSheet } from './LocationSheet';
import { MapPin } from './icons';

/**
 * The location control in the top nav. The pill shows the current location
 * label; tapping it opens the shared LocationSheet (GLO-7 desktop parity) —
 * the same share-location prompt / popular cities / address lookup experience
 * the mobile sticky search uses, centered as a modal on desktop. Distance +
 * drive-time ranking on the feed depends on the chosen location.
 */
export function LocationPill() {
  const { location } = useLocation();
  const [open, setOpen] = useState(false);

  const label = location?.label ?? 'Set location';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 'var(--radius-pill)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-elevated)',
          color: location ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: 14,
          fontWeight: 600,
          maxWidth: 200,
        }}
      >
        <MapPin size={15} color="var(--brand-600)" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </button>

      <LocationSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
