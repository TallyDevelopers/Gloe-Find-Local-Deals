'use client';

import { useMemo, useState } from 'react';

import { trpc } from '../../../lib/trpc';

type Role = 'owner' | 'moderator';

/**
 * God-mode "Admins" view. Lists everyone with console access and lets owners
 * grant / revoke it and flip roles. Owners can do everything; moderators see
 * the roster read-only. The backend enforces the same rules (last-owner guard,
 * no self-removal) — this UI just mirrors them so the buttons match reality.
 */
export function AdminsView() {
  const utils = trpc.useUtils();
  const admins = trpc.admin.listAdmins.useQuery();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('moderator');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The caller's own role drives whether management controls show at all.
  const myRole: Role | null = useMemo(
    () => admins.data?.find((a) => a.isYou)?.role ?? null,
    [admins.data],
  );
  const canManage = myRole === 'owner';
  const ownerCount = useMemo(
    () => admins.data?.filter((a) => a.role === 'owner').length ?? 0,
    [admins.data],
  );

  const refresh = () => utils.admin.listAdmins.invalidate();

  const addAdmin = trpc.admin.addAdmin.useMutation({
    onSuccess: () => {
      setEmail('');
      setRole('moderator');
      setError(null);
      setNotice('Admin added.');
      void refresh();
    },
    onError: (e) => { setNotice(null); setError(e.message); },
  });
  const removeAdmin = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => { setError(null); setNotice('Admin removed.'); void refresh(); },
    onError: (e) => { setNotice(null); setError(e.message); },
  });
  const setAdminRole = trpc.admin.setAdminRole.useMutation({
    onSuccess: () => { setError(null); setNotice('Role updated.'); void refresh(); },
    onError: (e) => { setNotice(null); setError(e.message); },
  });

  const busy = addAdmin.isPending || removeAdmin.isPending || setAdminRole.isPending;

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    addAdmin.mutate({ email: email.trim(), role });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>Admins</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Everyone with access to this console. <strong>Owners</strong> can manage billing, the team, and
          every god-mode action; <strong>moderators</strong> handle day-to-day review and support.
        </p>
      </div>

      {/* Add admin — owners only */}
      {canManage ? (
        <form onSubmit={submitAdd} style={addCard}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Add an admin</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            They must have signed into Gloē at least once with this email.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
              style={{ ...input, flex: 1, minWidth: 220 }}
              disabled={busy}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={{ ...input, cursor: 'pointer' }}
              disabled={busy}
            >
              <option value="moderator">Moderator</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" style={primaryBtn} disabled={busy || !email.trim()}>
              {addAdmin.isPending ? 'Adding…' : 'Add admin'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '10px 12px', background: 'var(--surface-secondary)', borderRadius: 'var(--radius-md)' }}>
          You're a moderator — only owners can add or remove admins.
        </div>
      )}

      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {/* Roster */}
      <div style={tableShell}>
        {admins.isLoading ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Loading…</div>
        ) : !admins.data || admins.data.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>No admins.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-secondary)', color: 'var(--text-tertiary)' }}>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Added</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {admins.data.map((a) => {
                const isLastOwner = a.role === 'owner' && ownerCount <= 1;
                return (
                  <tr key={a.userId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <Td>
                      <strong>{a.email ?? '(no email)'}</strong>
                      {a.isYou ? <span style={youTag}>you</span> : null}
                    </Td>
                    <Td>
                      {canManage ? (
                        <select
                          value={a.role}
                          onChange={(e) => setAdminRole.mutate({ userId: a.userId, role: e.target.value as Role })}
                          disabled={busy || isLastOwner}
                          title={isLastOwner ? 'Promote another owner before changing this one' : undefined}
                          style={{ ...input, padding: '4px 8px', fontSize: 12, cursor: isLastOwner ? 'not-allowed' : 'pointer' }}
                        >
                          <option value="moderator">Moderator</option>
                          <option value="owner">Owner</option>
                        </select>
                      ) : (
                        <RoleBadge role={a.role} />
                      )}
                    </Td>
                    <Td style={{ color: 'var(--text-secondary)' }}>{new Date(a.createdAt).toLocaleDateString()}</Td>
                    <Td align="right">
                      {canManage && !a.isYou && !isLastOwner ? (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${a.email ?? 'this admin'}'s access?`)) {
                              removeAdmin.mutate({ userId: a.userId });
                            }
                          }}
                          disabled={busy}
                          style={dangerBtn}
                        >
                          Remove
                        </button>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const owner = role === 'owner';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      textTransform: 'capitalize',
      background: owner ? 'var(--brand-50)' : 'var(--surface-secondary)',
      color: owner ? 'var(--brand-600)' : 'var(--text-secondary)',
    }}>{role}</span>
  );
}

function Banner({ tone, children }: { tone: 'error' | 'ok'; children: React.ReactNode }) {
  const err = tone === 'error';
  return (
    <div style={{
      fontSize: 13,
      padding: '9px 12px',
      borderRadius: 'var(--radius-md)',
      background: err ? 'rgba(218,79,71,0.08)' : 'rgba(46,160,115,0.10)',
      color: err ? 'var(--error)' : 'var(--success)',
    }}>{children}</div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return <th style={{ textAlign: align ?? 'left', padding: '10px 14px', fontWeight: 600, fontSize: 12 }}>{children}</th>;
}

function Td({ children, align, style }: { children: React.ReactNode; align?: 'right'; style?: React.CSSProperties }) {
  return (
    <td style={{ textAlign: align ?? 'left', padding: '10px 14px', ...style }}>{children}</td>
  );
}

const tableShell: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  background: 'var(--surface-elevated)',
};

const addCard: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-elevated)',
  padding: 14,
  display: 'flex', flexDirection: 'column', gap: 4,
};

const input: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', fontSize: 13, fontWeight: 700,
  border: '1px solid var(--brand-500)', background: 'var(--brand-500)', color: '#fff',
  borderRadius: 'var(--radius-md)', cursor: 'pointer',
};

const dangerBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border-default)',
  color: 'var(--error)', fontWeight: 600, fontSize: 12,
  padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
};

const youTag: React.CSSProperties = {
  marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-tertiary)',
  background: 'var(--surface-secondary)', padding: '1px 6px', borderRadius: 999,
};
