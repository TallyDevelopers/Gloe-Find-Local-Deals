import type { Metadata } from 'next';

import { ReferralLanding } from './ReferralLanding';

/**
 * Server wrapper for the referral invite landing (GLO-24). Public — the whole
 * point is signed-out arrivals from a shared gloe.app/r/CODE link. All the
 * behavior (cookie, sign-up handoff, signed-in submit) lives in the client
 * island.
 */
export const metadata: Metadata = {
  title: 'You’re invited · Gloē',
  description: 'A friend sent you credit toward your first med-spa booking on Gloē.',
};

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ReferralLanding code={code.trim().toUpperCase()} />;
}
