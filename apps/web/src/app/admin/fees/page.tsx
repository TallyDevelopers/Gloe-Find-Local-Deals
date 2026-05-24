'use client';

import { UserButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

import { Wordmark } from '../../../components/Wordmark';
import { FeeTiersEditor } from '../components/FeeTiersEditor';

export default function FeesPage() {
  const router = useRouter();
  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-elevated)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 15 }}>← Admin</button>
            <Wordmark size={22} tone="gold" />
          </div>
          <UserButton />
        </div>
      </header>
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 32 }}>Platform fees</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
            Layer tiers by deal price. Each booking uses the active tier whose range it falls into.
            Override per-vendor from the vendor's detail page.
          </p>
        </div>
        <FeeTiersEditor vendorId={null} />
      </main>
    </div>
  );
}
