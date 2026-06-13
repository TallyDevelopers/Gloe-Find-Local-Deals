/**
 * In-memory holder for a referral code typed on the sign-up form. While set,
 * every API request carries it in the `x-gloe-referral-code` header (the
 * channel context/auth.ts reads) — the server only acts on it at the moment
 * the user row is JIT-created, so leaving it set afterwards is harmless.
 * In-memory is enough: the JIT insert happens on the first authenticated
 * request right after sign-up, always within the same app session.
 */
let pendingCode: string | null = null;

export function setPendingReferralCode(code: string | null): void {
  const trimmed = code?.trim().toUpperCase() ?? '';
  pendingCode = trimmed.length > 0 ? trimmed : null;
}

export function getPendingReferralCode(): string | null {
  return pendingCode;
}
