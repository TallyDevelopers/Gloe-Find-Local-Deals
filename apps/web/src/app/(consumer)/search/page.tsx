'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { DealCard } from '../../../components/consumer/DealCard';
import { DealGridSkeleton } from '../../../components/consumer/Skeletons';
import { Search as SearchIcon, X } from '../../../components/consumer/icons';
import { useDealLocationArgs } from '../../../lib/location';
import { trpc } from '../../../lib/trpc';

const RECENT_KEY = 'gloe.recentSearches.v1';

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function pushRecent(term: string) {
  if (typeof window === 'undefined' || !term.trim()) return;
  const next = [term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 8);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function useDebounced<T>(value: T, ms = 180): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locArgs = useDealLocationArgs();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(params.get('q') ?? '');
  const [recent, setRecent] = useState<string[]>([]);
  const debounced = useDebounced(q.trim(), 180);
  const active = debounced.length >= 2;

  useEffect(() => {
    setRecent(readRecent());
    inputRef.current?.focus();
  }, []);

  // Keep ?q= in sync (shareable URLs) without a full navigation.
  useEffect(() => {
    const url = q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search';
    window.history.replaceState(null, '', url);
  }, [q]);

  const results = trpc.deals.search.useQuery(
    { q: debounced, ...locArgs, limit: 40 },
    { enabled: active },
  );
  const suggestions = trpc.deals.suggest.useQuery(
    { q: debounced, ...locArgs, limit: 8 },
    { enabled: active },
  );
  const trending = trpc.deals.trending.useQuery({ ...locArgs, limit: 10 }, { enabled: !active });

  function commit(term: string) {
    setQ(term);
    pushRecent(term);
    setRecent(readRecent());
  }

  const fallbackChips = useMemo(() => ['Botox', 'Hydrafacial', 'Lip filler', 'Microneedling', 'Chemical peel'], []);

  return (
    <div className="consumer-container" style={{ maxWidth: 1100 }}>
      {/* Search field */}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)' }}>
          <SearchIcon size={20} color="var(--text-tertiary)" />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) commit(q.trim());
          }}
          placeholder="Search treatments, spas, brands…"
          aria-label="Search"
          style={{
            width: '100%',
            fontSize: 18,
            padding: '16px 48px 16px 50px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-default)',
            background: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxShadow: '0 2px 14px rgba(43,32,25,0.05)',
          }}
        />
        {q ? (
          <button
            type="button"
            onClick={() => { setQ(''); inputRef.current?.focus(); }}
            aria-label="Clear"
            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 6 }}
          >
            <X size={18} color="var(--text-tertiary)" />
          </button>
        ) : null}
      </div>

      {/* Suggestion chips while typing */}
      {active && suggestions.data && suggestions.data.length > 0 ? (
        <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 14 }}>
          {suggestions.data.map((s) => (
            <Chip key={`${s.term}-${s.subtypeSlug ?? ''}`} onClick={() => commit(s.term)}>
              {s.term}
            </Chip>
          ))}
        </div>
      ) : null}

      {/* Results */}
      {active ? (
        <div style={{ marginTop: 24 }}>
          {results.isLoading ? (
            <DealGridSkeleton count={8} />
          ) : results.data && results.data.deals.length > 0 ? (
            <>
              <div className="section-head" style={{ marginTop: 0 }}>
                <h2 style={{ fontSize: 20 }}>{results.data.deals.length} results for “{debounced}”</h2>
              </div>
              <div className="deal-grid">
                {results.data.deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            </>
          ) : (
            <ZeroState term={debounced} chips={(trending.data ?? []).map((t) => t.term)} onPick={commit} fallback={fallbackChips} />
          )}
        </div>
      ) : (
        /* Idle state: recent + trending */
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {recent.length > 0 ? (
            <Section title="Recent" action={{ label: 'Clear', onClick: () => { window.localStorage.removeItem(RECENT_KEY); setRecent([]); } }}>
              <ChipRow items={recent} onPick={commit} />
            </Section>
          ) : null}
          <Section title="Popular near you">
            <ChipRow items={(trending.data ?? []).map((t) => t.term)} fallback={fallbackChips} onPick={commit} />
          </Section>
        </div>
      )}
    </div>
  );
}

function ZeroState({ term, chips, fallback, onPick }: { term: string; chips: string[]; fallback: string[]; onPick: (t: string) => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>No matches for “{term}” nearby</div>
      <p style={{ color: 'var(--text-secondary)', marginTop: 8, marginBottom: 20 }}>Try one of these instead:</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(chips.length ? chips : fallback).slice(0, 8).map((t) => (
          <Chip key={t} onClick={() => onPick(t)}>{t}</Chip>
        ))}
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{title}</div>
        {action ? (
          <button type="button" onClick={action.onClick} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: 13, fontWeight: 600 }}>
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ items, fallback, onPick }: { items: string[]; fallback?: string[]; onPick: (t: string) => void }) {
  const list = items.length ? items : fallback ?? [];
  return (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
      {list.map((t) => (
        <Chip key={t} onClick={() => onPick(t)}>{t}</Chip>
      ))}
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        fontSize: 14,
        fontWeight: 600,
        padding: '9px 16px',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-elevated)',
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="consumer-container" style={{ paddingTop: 24 }}><DealGridSkeleton count={8} /></div>}>
      <SearchInner />
    </Suspense>
  );
}
