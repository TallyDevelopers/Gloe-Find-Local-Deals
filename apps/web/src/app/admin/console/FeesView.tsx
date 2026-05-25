'use client';

import { FeeTiersEditor } from '../components/FeeTiersEditor';

export function FeesView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 32 }}>Platform fees</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Layer tiers by deal price. Each booking uses the active tier whose range it falls into.
          Override per-vendor from the vendor's detail page.
        </p>
      </div>
      <FeeTiersEditor vendorId={null} />
    </div>
  );
}
