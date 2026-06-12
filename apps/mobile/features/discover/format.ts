export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/** Exact money — "$15", or "$14.50" when it isn't whole. */
export function formatMoneyExact(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Promo badge copy (GLO-44): custom label override, else auto "Extra $X off"
 *  generated from the amount so the badge can't go stale. */
export function promoBadgeLabel(promo: { amountCents: number; label: string | null }): string {
  return promo.label?.trim() || `Extra ${formatMoneyExact(promo.amountCents)} off`;
}

/** Price after the deal promo (GLO-44) — what the buyer actually pays. */
export function promoPriceCents(dealPriceCents: number, promo: { amountCents: number } | null | undefined): number {
  return promo ? Math.max(0, dealPriceCents - promo.amountCents) : dealPriceCents;
}
