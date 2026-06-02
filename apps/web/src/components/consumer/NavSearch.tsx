'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Search } from './icons';

/** Inline, submittable search box for the desktop top nav. */
export function NavSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      className="topnav-search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
      }}
    >
      <Search size={18} color="var(--text-tertiary)" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search botox, facials, laser, spas…"
        aria-label="Search treatments"
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: 'var(--text-primary)' }}
      />
    </form>
  );
}
