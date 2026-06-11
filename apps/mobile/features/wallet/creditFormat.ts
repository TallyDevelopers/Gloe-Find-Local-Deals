/**
 * Credit-money formatting + friendly ledger labels, shared by the wallet
 * credit card, the history sheet, the referral screen, and checkout.
 *
 * `formatPrice` (discover/format.ts) rounds to whole dollars — right for deal
 * prices, wrong for credit math where partial redemptions leave real cents.
 */
export function formatCredit(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  const sign = cents < 0 ? '−' : '';
  return `${sign}$${abs % 100 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}

/** Short date for expiry lines, e.g. "Jun 24". */
export function formatCreditDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * One label per ledger kind. The history endpoint mixes lot kinds (earns,
 * amount > 0) and entry kinds (spends/reversals, amount < 0) in one feed.
 */
const KIND_LABELS: Record<string, string> = {
  // Lots (earned)
  referral_give: 'Welcome credit',
  referral_get: 'Referral reward',
  purchase_reward: 'Booking reward',
  signup_bonus: 'Sign-up bonus',
  promo: 'Promo credit',
  admin_grant: 'Credit from Gloē',
  refund_return: 'Refund credit',
  // Entries (spent / reversed)
  redemption: 'Applied to a booking',
  expiry: 'Credit expired',
  clawback: 'Credit reversed',
  forfeiture: 'Credit forfeited',
};

export function creditKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? 'Gloē credit';
}
