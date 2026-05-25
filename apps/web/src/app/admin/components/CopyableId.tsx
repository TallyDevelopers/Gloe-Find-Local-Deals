'use client';

import { useState } from 'react';

interface CopyableIdProps {
  id: string;
  label?: string;
}

/**
 * Small monospace ID chip with click-to-copy. Used in admin drawers/pages so
 * support can grab the canonical UUID for log lookups, DB queries, refunds, etc.
 */
export function CopyableId({ id, label = 'ID' }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard write can fail in non-secure contexts; silently ignore.
    }
  };

  return (
    <button
      onClick={onClick}
      title={`Copy ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        background: copied ? 'var(--brand-50)' : 'var(--surface-default)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 999,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        userSelect: 'all',
        transition: 'background 120ms ease-out',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
        {label}
      </span>
      <span>{id}</span>
      <span style={{ color: copied ? 'var(--brand-600)' : 'var(--text-tertiary)', fontSize: 11 }}>
        {copied ? '✓' : '⎘'}
      </span>
    </button>
  );
}
