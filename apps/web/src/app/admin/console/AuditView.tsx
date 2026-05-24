'use client';

import { useState } from 'react';

import { trpc } from '../../../lib/trpc';

const ACTION_GROUPS: { key: string; label: string }[] = [
  { key: '',                  label: 'All' },
  { key: 'transfer.',         label: 'Transfers' },
  { key: 'instant_payout.',   label: 'Instant payouts' },
  { key: 'payout.',           label: 'Standard payouts' },
  { key: 'fee_tier.',         label: 'Fee tiers' },
  { key: 'vendor.',           label: 'Vendor admin' },
  { key: 'redemption.',       label: 'Redemptions' },
  { key: 'refund.',           label: 'Refunds' },
];

export function AuditView() {
  const [actionPrefix, setActionPrefix] = useState<string>('');
  const list = trpc.admin.listAuditLog.useQuery({ action: actionPrefix || undefined, limit: 150 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Audit log</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Every money-moving + admin action. Append-only. The receipts.
        </p>
      </div>

      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ACTION_GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setActionPrefix(g.key)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: actionPrefix === g.key ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
                background: actionPrefix === g.key ? 'var(--brand-500)' : 'var(--surface-elevated)',
                color: actionPrefix === g.key ? 'white' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div style={tableShell}>
        {list.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !list.data || list.data.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No audit entries match.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {list.data.map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
              }}>
                <div style={{ minWidth: 130, fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                  {new Date(a.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                </div>
                <div style={{ minWidth: 220, fontSize: 13, fontWeight: 700, color: actionColor(a.action), fontFamily: 'monospace' }}>
                  {a.action}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>
                    {a.actorName ? <span style={{ color: 'var(--text-primary)' }}>{a.actorName}</span> : <span style={{ color: 'var(--text-tertiary)' }}>system</span>}
                    {a.vendorName ? <span style={{ color: 'var(--text-secondary)' }}> · {a.vendorName}</span> : null}
                  </div>
                  {a.meta && Object.keys(a.meta).length > 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                      {Object.entries(a.meta).slice(0, 4).map(([k, v]) => (
                        <span key={k} style={{ marginRight: 12 }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>{k}=</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{shortValue(v)}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function actionColor(action: string): string {
  if (action.endsWith('.refused') || action.endsWith('.failed') || action.includes('suspended')) return 'var(--error)';
  if (action.endsWith('.created') || action.endsWith('.success') || action.endsWith('.paid') || action.endsWith('.requested')) return 'var(--success)';
  if (action.endsWith('.toggled') || action.endsWith('.updated') || action.endsWith('.set')) return 'var(--brand-600)';
  return 'var(--text-secondary)';
}

function shortValue(v: unknown): string {
  if (v == null) return '∅';
  if (typeof v === 'string') return v.length > 40 ? v.slice(0, 40) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 40 ? s.slice(0, 40) + '…' : s;
  } catch {
    return String(v);
  }
}

const tableShell: React.CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'auto',
};
const toolbar: React.CSSProperties = {
  display: 'flex', gap: 10, padding: 10,
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};
