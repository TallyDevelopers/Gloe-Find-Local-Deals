'use client';

import { useAuth, useClerk } from '@clerk/nextjs';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CLERK_APPEARANCE } from '../../../../components/consumer/clerkAppearance';
import { formatCredit } from '../../../../components/consumer/format';
import { Check, Gift } from '../../../../components/consumer/icons';
import { trpc } from '../../../../lib/trpc';

/** Pending-invite cookie. TrpcProvider forwards it as `x-gloe-referral-code`
 *  on every API request; attribution fires at the JIT user insert. */
const REFERRAL_COOKIE = 'gloe_ref';
const COOKIE_MAX_AGE_S = 7 * 24 * 3600; // matches the 7-day attribution window

function setReferralCookie(code: string) {
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${COOKIE_MAX_AGE_S}; SameSite=Lax`;
}

function clearReferralCookie() {
  document.cookie = `${REFERRAL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** Friendly copy for attributeSignup refusal reasons (vague on purpose for
 *  the fraud-flavored ones — don't explain what tripped). */
const REFUSAL_MESSAGES: Record<string, string> = {
  invalid_code: 'That invite code isn’t valid.',
  code_not_found: 'That invite code isn’t valid.',
  self_referral: 'That’s your own invite code — share it with a friend instead.',
  already_attributed: 'An invite code is already applied to your account.',
  already_purchased: 'Invite credit is for first bookings — you’ve already made one.',
  signup_too_old: 'Invite codes can only be applied within 7 days of joining.',
};

/**
 * /r/[code] — referral invite landing (GLO-24). Signed-out: stores the code
 * (cookie) and hands off to Clerk sign-up; attribution happens server-side on
 * the first authenticated request. Signed-in: offers a one-tap "apply code"
 * when still eligible (within 7 days of signup, no purchases).
 */
export function ReferralLanding({ code }: { code: string }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { openSignUp } = useClerk();
  const program = trpc.referral.program.useQuery();
  const status = trpc.referral.status.useQuery(undefined, { enabled: !!isSignedIn });
  const submit = trpc.referral.submitCode.useMutation();
  const utils = trpc.useUtils();
  const [result, setResult] = useState<{ attributed: boolean; reason: string } | null>(null);

  // Park the code so it survives the Clerk sign-up round trip.
  useEffect(() => {
    if (/^[A-Z2-9]{4,12}$/.test(code)) setReferralCookie(code);
  }, [code]);

  async function applyCode() {
    const res = await submit.mutateAsync({ code });
    setResult(res);
    if (res.attributed) {
      clearReferralCookie();
      void utils.credits.balance.invalidate();
      void utils.referral.status.invalidate();
    }
  }

  const p = program.data;

  return (
    <div className="consumer-container" style={{ maxWidth: 560, paddingTop: 40, paddingBottom: 56 }}>
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '32px 26px', textAlign: 'center', boxShadow: '0 8px 30px rgba(43,32,25,0.08)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-50)', border: '1px solid var(--brand-100)' }}>
          <Gift size={26} color="var(--brand-600)" />
        </div>

        {program.isLoading || !isLoaded ? (
          <p style={{ marginTop: 18, color: 'var(--text-tertiary)' }}>Loading…</p>
        ) : !p ? (
          <>
            <h1 style={{ fontSize: 26, marginTop: 16 }}>Invites are paused</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              The referral program isn’t running right now — but the deals still are.
            </p>
            <BrowseLink />
          </>
        ) : result ? (
          result.attributed ? (
            <>
              <h1 style={{ fontSize: 26, marginTop: 16 }}>
                <Check size={22} color="var(--brand-600)" style={{ verticalAlign: -3 }} /> Credit claimed
              </h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
                {formatCredit(p.giveCents)} in Gloē credit is waiting in your wallet. It applies
                automatically on your first booking
                {p.minFirstPurchaseCents > 0 ? ` of ${formatCredit(p.minFirstPurchaseCents)}+` : ''}.
              </p>
              <BrowseLink primary label="Find your first treatment" />
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 26, marginTop: 16 }}>That didn’t work</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
                {REFUSAL_MESSAGES[result.reason] ?? 'We couldn’t apply this invite code.'}
              </p>
              <BrowseLink />
            </>
          )
        ) : !isSignedIn ? (
          <>
            <h1 style={{ fontSize: 26, marginTop: 16 }}>You’ve been invited</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              Join Gloē with code <strong style={{ color: 'var(--brand-700)', letterSpacing: '0.06em' }}>{code}</strong> and
              get {formatCredit(p.giveCents)} off your first med-spa booking
              {p.minFirstPurchaseCents > 0 ? ` of ${formatCredit(p.minFirstPurchaseCents)}+` : ''}.
            </p>
            <button
              type="button"
              onClick={() =>
                openSignUp({
                  appearance: CLERK_APPEARANCE,
                  forceRedirectUrl: '/wallet',
                  signInForceRedirectUrl: '/wallet',
                })
              }
              style={{ width: '100%', marginTop: 22, background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '15px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
            >
              Claim your {formatCredit(p.giveCents)}
            </button>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.5 }}>
              Your credit lands in your wallet right after you sign up.
            </p>
          </>
        ) : status.data?.canSubmitCode ? (
          <>
            <h1 style={{ fontSize: 26, marginTop: 16 }}>Claim your invite</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              Apply code <strong style={{ color: 'var(--brand-700)', letterSpacing: '0.06em' }}>{code}</strong> to
              get {formatCredit(p.giveCents)} off your first booking
              {p.minFirstPurchaseCents > 0 ? ` of ${formatCredit(p.minFirstPurchaseCents)}+` : ''}.
            </p>
            <button
              type="button"
              disabled={submit.isPending}
              onClick={applyCode}
              style={{ width: '100%', marginTop: 22, background: 'var(--brand-500)', color: 'var(--text-inverse)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '15px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: submit.isPending ? 0.7 : 1 }}
            >
              {submit.isPending ? 'Applying…' : `Apply code · get ${formatCredit(p.giveCents)}`}
            </button>
            {submit.error ? (
              <p style={{ color: 'var(--error)', fontSize: 13.5, marginTop: 10 }}>{submit.error.message}</p>
            ) : null}
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 26, marginTop: 16 }}>Good news — you’re already in</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
              Invite codes are for brand-new members, so this one can’t be applied to your account.
              You can share your own from the wallet — give {formatCredit(p.giveCents)}, get {formatCredit(p.getCents)}.
            </p>
            <BrowseLink />
          </>
        )}
      </div>
    </div>
  );
}

function BrowseLink({ primary, label }: { primary?: boolean; label?: string }) {
  return primary ? (
    <Link
      href="/"
      style={{ display: 'block', marginTop: 22, background: 'var(--brand-500)', color: 'var(--text-inverse)', borderRadius: 'var(--radius-pill)', padding: '15px 20px', fontSize: 16, fontWeight: 700 }}
    >
      {label ?? 'Browse deals'}
    </Link>
  ) : (
    <Link href="/" style={{ display: 'inline-block', marginTop: 18, color: 'var(--brand-600)', fontWeight: 600 }}>
      {label ?? 'Browse deals'} →
    </Link>
  );
}
