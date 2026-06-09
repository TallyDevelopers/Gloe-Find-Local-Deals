'use client';

import { useEffect, useRef, useState } from 'react';

import { Card } from '../../components/ui';
import { trpc } from '../../lib/trpc';

/**
 * GLO-19: the vendor side of license verification. Collects license number,
 * state, type, and a photo/PDF of the license, then submits for admin review.
 * Re-renders as a status banner while pending and as a rejection notice (with
 * resubmit) if the admin bounces it.
 */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const LICENSE_TYPES = [
  'Medical Director (MD/DO)',
  'Nurse Practitioner (NP)',
  'Registered Nurse (RN)',
  'Physician Assistant (PA)',
  'Licensed Aesthetician',
  'Cosmetology / Esthetics Establishment',
  'Other',
];

export function LicenseCard() {
  const utils = trpc.useUtils();
  const infoQ = trpc.vendor.licenseInfo.useQuery();
  const sign = trpc.vendor.signLicenseUpload.useMutation();
  const submit = trpc.vendor.submitLicense.useMutation({
    onSuccess: async () => {
      await utils.vendor.licenseInfo.invalidate();
      await utils.vendor.setupStatus.invalidate();
    },
  });

  const info = infoQ.data;
  const [number, setNumber] = useState('');
  const [state, setState] = useState('');
  const [type, setType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Prefill once from an earlier (e.g. rejected) submission.
  useEffect(() => {
    if (!info || hydrated) return;
    setNumber(info.licenseNumber ?? '');
    setState(info.licenseState ?? '');
    setType(info.licenseType ?? '');
    setHydrated(true);
  }, [info, hydrated]);

  if (!info) return null;

  const shell = (children: React.ReactNode) => (
    <div id="license-card">
      <Card>
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>Medical license &amp; verification</h2>
        {children}
      </Card>
    </div>
  );

  if (info.status === 'verified') {
    return shell(
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ color: 'var(--success)', fontSize: 18 }}>✓</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Verified</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {info.licenseType ?? 'License'} · {info.licenseState ?? ''} {info.licenseNumber ? `· #${info.licenseNumber}` : ''}
          </div>
        </div>
      </div>,
    );
  }

  if (info.status === 'pending_review') {
    return shell(
      <div
        style={{
          marginTop: 8,
          padding: '12px 14px',
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-100)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-600)' }}>Under review</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
          We&rsquo;re verifying {info.licenseType ?? 'your license'} #{info.licenseNumber} ({info.licenseState}).
          You&rsquo;ll be able to go live as soon as it&rsquo;s approved — usually within a business day.
        </div>
      </div>,
    );
  }

  // unverified or rejected → the form
  const canSubmit = number.trim().length >= 3 && state && type && (file || info.hasDocument);

  const doSubmit = async () => {
    setError(null);
    try {
      let documentPath: string | null = null;
      if (file) {
        setUploading(true);
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
        const signed = await sign.mutateAsync({ fileExt: ext });
        const put = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) throw new Error('Document upload failed. Try again.');
        documentPath = signed.path;
      }
      if (!documentPath) throw new Error('Attach a photo or PDF of your license.');
      await submit.mutateAsync({
        licenseNumber: number.trim(),
        licenseState: state,
        licenseType: type,
        documentPath,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
    } finally {
      setUploading(false);
    }
  };

  return shell(
    <>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 14 }}>
        Every spa on Gloē is licensed &amp; reviewed. Send us the license your practice operates
        under — we verify it with the issuing state board before your deals go live.
      </p>

      {info.status === 'rejected' ? (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            background: 'rgba(178,69,69,0.08)',
            border: '1px solid rgba(178,69,69,0.25)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>
            We couldn&rsquo;t verify your last submission
          </div>
          {info.rejectionReason ? (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{info.rejectionReason}</div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <Field label="License number">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              maxLength={60}
              placeholder="e.g. RN-1234567"
              style={input}
            />
          </Field>
          <Field label="State">
            <select value={state} onChange={(e) => setState(e.target.value)} style={input}>
              <option value="">—</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="License type">
          <select value={type} onChange={(e) => setType(e.target.value)} style={input}>
            <option value="">Choose…</option>
            {LICENSE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="License document" hint="A clear photo or PDF of the license itself.">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 14 }}
          />
        </Field>

        {error ? <div style={{ fontSize: 13, color: 'var(--error)' }}>{error}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={doSubmit}
            disabled={!canSubmit || uploading || submit.isPending}
            style={{
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 700,
              background: 'var(--brand-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              opacity: !canSubmit || uploading || submit.isPending ? 0.5 : 1,
            }}
          >
            {uploading || submit.isPending ? 'Submitting…' : 'Submit for verification'}
          </button>
        </div>
      </div>
    </>,
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      {children}
      {hint ? <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{hint}</span> : null}
    </label>
  );
}

const input: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
  color: 'var(--text-primary)',
};
