'use client';

import { Html5Qrcode } from 'html5-qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RouterOutputs } from '@gloe/api-client';

import { Card } from '../../components/ui';
import { trpc } from '../../lib/trpc';

type Lookup = RouterOutputs['vendor']['lookupVoucher'];
type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'lookup'; code: string }
  | { kind: 'confirm'; lookup: Lookup }
  | { kind: 'redeeming' }
  | { kind: 'done'; lookup: Lookup; release: { transferId: string; amountCents: number } | null; releaseError: string | null };

const SCANNER_ELEMENT_ID = 'gloe-qr-scanner';

function money(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ScanTab({ canScan }: { canScan: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const lookup = trpc.vendor.lookupVoucher.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      setPhase({ kind: 'confirm', lookup: data });
    },
    onError: (e) => {
      setErrorMsg(e.message);
      setPhase({ kind: 'idle' });
    },
  });

  const redeem = trpc.vendor.redeemVoucher.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      const current = phase;
      if (current.kind === 'redeeming' || current.kind === 'confirm') {
        const lookupData = current.kind === 'confirm' ? current.lookup : (phase as never);
        // pull the lookup we were confirming, regardless of which intermediate state
        const fallback = current.kind === 'confirm' ? current.lookup : null;
        setPhase({
          kind: 'done',
          lookup: fallback as Lookup,
          release: data.released,
          releaseError: data.releaseError,
        });
        void lookupData;
      }
      void utils.vendor.hubSnapshot.invalidate();
      void utils.vendor.vouchers.invalidate();
      void utils.vendor.stripeMoney.invalidate();
    },
    onError: (e) => {
      setErrorMsg(e.message);
      setPhase({ kind: 'idle' });
    },
  });

  // Track the active confirm-screen lookup so the 'done' state can use it.
  const confirmLookupRef = useRef<Lookup | null>(null);
  useEffect(() => {
    if (phase.kind === 'confirm') confirmLookupRef.current = phase.lookup;
  }, [phase]);

  const handleCode = useCallback((code: string) => {
    if (!code || code.trim().length === 0) return;
    setErrorMsg(null);
    setPhase({ kind: 'lookup', code });
    lookup.mutate({ code });
  }, [lookup]);

  const restart = () => {
    setErrorMsg(null);
    setManualCode('');
    setManualOpen(false);
    setPhase({ kind: 'idle' });
  };

  if (!canScan) {
    return (
      <Card>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Scan</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Finish setup (license + Stripe) to start redeeming vouchers.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div>
        <h1 style={{ fontSize: 28 }}>Scan</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 4 }}>
          Point at the customer's QR code, or enter their code by hand.
        </p>
      </div>

      {phase.kind === 'idle' || phase.kind === 'scanning' || phase.kind === 'lookup' ? (
        <>
          <ScannerCard
            onDetected={handleCode}
            busy={phase.kind === 'lookup'}
            onActiveChange={(active) => setPhase(active ? { kind: 'scanning' } : { kind: 'idle' })}
          />
          {errorMsg ? (
            <Card style={{ background: 'rgba(178,69,69,0.08)', borderColor: 'rgba(178,69,69,0.25)' }}>
              <div style={{ color: 'var(--error)', fontSize: 14, fontWeight: 600 }}>{errorMsg}</div>
            </Card>
          ) : null}
          <Card>
            {!manualOpen ? (
              <button
                onClick={() => setManualOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-600)',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Enter code manually
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) handleCode(manualCode.trim());
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                    Voucher code
                  </span>
                  <input
                    autoFocus
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="GLOE-XXXXX"
                    style={{
                      padding: '12px 14px',
                      fontSize: 18,
                      letterSpacing: '0.08em',
                      fontFamily: 'var(--font-display, monospace)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--surface-elevated)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setManualOpen(false); setManualCode(''); }} style={secondaryBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={!manualCode.trim() || lookup.isPending} style={primaryBtn}>
                    {lookup.isPending ? 'Looking up…' : 'Look up'}
                  </button>
                </div>
              </form>
            )}
          </Card>
        </>
      ) : null}

      {phase.kind === 'confirm' ? (
        <ConfirmCard
          lookup={phase.lookup}
          pending={redeem.isPending}
          onConfirm={() => {
            setPhase({ kind: 'redeeming' });
            redeem.mutate({ claimId: phase.lookup.claimId });
          }}
          onCancel={restart}
        />
      ) : null}

      {phase.kind === 'redeeming' ? (
        <Card><div style={{ textAlign: 'center', padding: '24px 0' }}>Redeeming…</div></Card>
      ) : null}

      {phase.kind === 'done' ? (
        <DoneCard
          lookup={confirmLookupRef.current ?? phase.lookup}
          release={phase.release}
          releaseError={phase.releaseError}
          onAnother={restart}
        />
      ) : null}
    </>
  );
}

function ScannerCard({
  onDetected,
  busy,
  onActiveChange,
}: {
  onDetected: (code: string) => void;
  busy: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  // 'off'      → camera not running (genuinely off / denied / stopped)
  // 'starting' → start() called; html5-qrcode is already painting the live
  //              <video> but its promise hasn't resolved yet.
  // 'on'       → camera fully live and scanning.
  // The overlay must NOT say "Camera off" during 'starting', because the live
  // feed is already visible behind it (the bug this state machine fixes).
  const [camera, setCamera] = useState<'off' | 'starting' | 'on'>('off');
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        const state = s.getState();
        // Html5QrcodeScannerState.SCANNING = 2
        if (state === 2) await s.stop();
      } catch {
        // ignore — camera may already be stopping
      }
      try {
        // Let html5-qrcode remove its OWN injected <video>/<canvas> nodes.
        // React never owns these (the scanner div has no React children),
        // so this can't collide with React's reconciliation.
        s.clear();
      } catch {
        // ignore
      }
    }
    setCamera('off');
    onActiveChange(false);
  }, [onActiveChange]);

  const start = useCallback(async () => {
    setError(null);
    setCamera('starting');
    // Guard against a double-start leaving an orphaned camera/video.
    if (scannerRef.current) {
      try { scannerRef.current.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, /* verbose */ false);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          // Fire once, then stop the camera so we don't double-fire while
          // the lookup runs.
          void stop().then(() => onDetectedRef.current(decodedText));
        },
        () => { /* per-frame failures are noisy; ignore */ },
      );
      setCamera('on');
      onActiveChange(true);
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      const msg = e instanceof Error ? e.message : '';
      let friendly: string;
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        // iOS Safari only exposes the camera API over HTTPS (or localhost).
        friendly = 'Camera unavailable. Open this page over https:// (camera is blocked on insecure connections). You can still enter the code by hand below.';
      } else if (name === 'NotAllowedError' || name === 'SecurityError' || /permission/i.test(msg)) {
        friendly = 'Camera permission denied. Allow camera access in your browser, or enter the code by hand below.';
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        friendly = 'No camera found. You can still enter the code by hand below.';
      } else if (name === 'NotReadableError') {
        friendly = 'Camera is in use by another app. Close it and try again, or enter the code by hand below.';
      } else {
        friendly = msg || 'Could not start camera. You can still enter the code by hand below.';
      }
      setError(friendly);
      try { scannerRef.current?.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
      setCamera('off');
      onActiveChange(false);
    }
  }, [stop, onActiveChange]);

  // Clean up on unmount.
  useEffect(() => {
    return () => { void stop(); };
  }, [stop]);

  return (
    <Card>
      {/*
        IMPORTANT: #gloe-qr-scanner must have NO React-rendered children.
        html5-qrcode injects its own <video>/<canvas> here and wipes the
        node's innerHTML on teardown. If React also owns a child inside it,
        React's reconciler throws "removeChild: not a child of this node"
        and the whole page crashes on every scan. Keep the placeholder as a
        sibling overlay instead.
      */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: 420,
          margin: '0 auto',
          background: 'var(--surface-secondary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div id={SCANNER_ELEMENT_ID} style={{ width: '100%', height: '100%' }} />
        {camera !== 'on' ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            {camera === 'starting' ? 'Starting camera…' : 'Camera off'}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
        {camera === 'off' ? (
          <button onClick={start} disabled={busy} style={primaryBtn}>
            {busy ? 'Looking up…' : 'Start camera'}
          </button>
        ) : (
          <button onClick={stop} disabled={camera === 'starting'} style={secondaryBtn}>
            {camera === 'starting' ? 'Starting…' : 'Stop camera'}
          </button>
        )}
      </div>
      {error ? (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--error)', textAlign: 'center' }}>{error}</div>
      ) : null}
    </Card>
  );
}

function ConfirmCard({
  lookup,
  pending,
  onConfirm,
  onCancel,
}: {
  lookup: Lookup;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-100)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--brand-600)', textTransform: 'uppercase', marginBottom: 6 }}>
        Confirm redemption
      </div>
      <h2 style={{ fontSize: 24, lineHeight: 1.2, marginBottom: 4 }}>
        {lookup.snapshot.dealTitle}
      </h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 14 }}>
        {lookup.snapshot.variantLabel}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 14, marginBottom: 18 }}>
        <div>
          <div style={{ color: 'var(--text-tertiary)' }}>Customer</div>
          <div style={{ fontWeight: 600 }}>{lookup.customerFirstName ?? 'Customer'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)' }}>Paid</div>
          <div style={{ fontWeight: 600 }}>{money(lookup.snapshot.dealPriceCents)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)' }}>Code</div>
          <div style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{lookup.humanCode}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)' }}>Expires</div>
          <div style={{ fontWeight: 600 }}>{new Date(lookup.expiresAt).toLocaleDateString()}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={pending} style={secondaryBtn}>Cancel</button>
        <button onClick={onConfirm} disabled={pending} style={confirmBtn}>
          {pending ? 'Redeeming…' : 'Confirm redemption'}
        </button>
      </div>
    </Card>
  );
}

function DoneCard({
  lookup,
  release,
  releaseError,
  onAnother,
}: {
  lookup: Lookup;
  release: { transferId: string; amountCents: number } | null;
  releaseError: string | null;
  onAnother: () => void;
}) {
  return (
    <Card style={{ background: 'rgba(76, 145, 95, 0.08)', border: '1px solid rgba(76, 145, 95, 0.25)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--success)', textTransform: 'uppercase', marginBottom: 6 }}>
        ✓ Redeemed
      </div>
      <h2 style={{ fontSize: 24, lineHeight: 1.2, marginBottom: 4 }}>{lookup.snapshot.dealTitle}</h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 14 }}>
        {lookup.customerFirstName ?? 'Customer'} · {lookup.snapshot.variantLabel}
      </div>

      {release ? (
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14 }}>
          {money(release.amountCents)} sent to your Stripe account.
        </div>
      ) : releaseError ? (
        <div style={{
          background: 'rgba(178,69,69,0.08)',
          border: '1px solid rgba(178,69,69,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 14,
        }}>
          <div style={{ color: 'var(--error)', fontWeight: 700, marginBottom: 2 }}>
            Money held — payout couldn't be released
          </div>
          {releaseError}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          Money will be released by Gloē on the standard schedule.
        </div>
      )}

      <button onClick={onAnother} style={primaryBtn}>Scan another</button>
    </Card>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 700,
  borderRadius: 999,
  border: '1px solid var(--brand-500)',
  background: 'var(--brand-500)',
  color: 'white',
  minHeight: 40,
};
const confirmBtn: React.CSSProperties = {
  ...primaryBtn,
  background: 'var(--success)',
  border: '1px solid var(--success)',
};
const secondaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 999,
  border: '1px solid var(--border-default)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
  minHeight: 40,
};
