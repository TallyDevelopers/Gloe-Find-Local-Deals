'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { trpc } from '../../../lib/trpc';

type Hit = RouterOutputs['admin']['search'][number];

const KIND_ICON: Record<Hit['kind'], string> = {
  vendor: '◧',
  customer: '☻',
  transaction: '$',
  deal: '✦',
};

const KIND_LABEL: Record<Hit['kind'], string> = {
  vendor: 'Vendor',
  customer: 'Customer',
  transaction: 'Transaction',
  deal: 'Deal',
};

/**
 * ⌘K palette. Mount once near the root of the admin shell; opens on:
 *   - Cmd/Ctrl + K
 *   - the `/` key (when no input is focused)
 *   - external prop trigger (sidebar Search button)
 */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = trpc.admin.search.useQuery(
    { query },
    { enabled: open && query.trim().length >= 2, staleTime: 1000 },
  );
  const hits: Hit[] = search.data ?? [];

  // Reset state when opening; focus the input.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // give the modal a tick to render before focusing
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, Math.max(hits.length - 1, 0))); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const hit = hits[cursor];
        if (hit) {
          onClose();
          router.push(hit.href);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, hits, cursor, onClose, router]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 16, 10, 0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Search vendors, customers, transactions, deals…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 16,
            }}
          />
          <kbd style={kbd}>esc</kbd>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {query.trim().length < 2 ? (
            <Empty text="Type to search." />
          ) : search.isLoading ? (
            <Empty text="Searching…" />
          ) : hits.length === 0 ? (
            <Empty text={`No results for "${query}".`} />
          ) : (
            hits.map((h, i) => (
              <button
                key={`${h.kind}:${h.id}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => { onClose(); router.push(h.href); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 18px',
                  border: 'none',
                  background: i === cursor ? 'var(--brand-50)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ width: 18, color: 'var(--brand-600)', fontWeight: 700, textAlign: 'center' }}>
                  {KIND_ICON[h.kind]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {h.subtitle}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                  {KIND_LABEL[h.kind]}
                </span>
              </button>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span><kbd style={kbd}>↑↓</kbd> nav</span>
          <span><kbd style={kbd}>↵</kbd> open</span>
          <span><kbd style={kbd}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: '24px 18px', color: 'var(--text-tertiary)', fontSize: 14, textAlign: 'center' }}>
      {text}
    </div>
  );
}

const kbd: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'var(--surface-secondary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)',
};
