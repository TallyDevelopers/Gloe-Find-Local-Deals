import { randomBytes } from 'node:crypto';

import type postgres from 'postgres';

import type { Sql } from '../db/client';

export type ClaimStatus = 'active' | 'redeemed' | 'expired' | 'cancelled';

export interface ClaimSnapshot {
  dealTitle: string;
  vendorName: string;
  vendorId: string;
  variantLabel: string;
  originalPriceCents: number;
  dealPriceCents: number;
}

export interface Claim {
  id: string;
  dealId: string;
  variantId: string;
  vendorId: string;
  snapshot: ClaimSnapshot;
  qrPayload: string;
  humanCode: string;
  status: ClaimStatus;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
}

const HUMAN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I

function generateHumanCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    code += HUMAN_CODE_ALPHABET[byte % HUMAN_CODE_ALPHABET.length];
  }
  return code;
}

interface CreateClaimInput {
  userId: string;
  dealId: string;
  variantId: string;
}

export async function createClaim(sql: Sql, input: CreateClaimInput): Promise<Claim> {
  const { userId, dealId, variantId } = input;

  // Validate variant + deal + vendor and build snapshot in one query
  const dealInfo = await sql<{
    deal_title: string;
    vendor_id: string;
    vendor_name: string;
    variant_label: string;
    original_price_cents: number;
    deal_price_cents: number;
    spots_total: number | null;
    spots_claimed: number;
    code_validity_days: number;
    deal_expires_at: string;
  }[]>`
    SELECT
      d.title                 AS deal_title,
      d.vendor_id             AS vendor_id,
      v.business_name         AS vendor_name,
      dv.label                AS variant_label,
      dv.original_price_cents AS original_price_cents,
      dv.deal_price_cents     AS deal_price_cents,
      dv.spots_total          AS spots_total,
      dv.spots_claimed        AS spots_claimed,
      d.code_validity_days    AS code_validity_days,
      d.expires_at            AS deal_expires_at
    FROM public.deals d
    JOIN public.vendors v ON v.id = d.vendor_id
    JOIN public.deal_variants dv ON dv.deal_id = d.id AND dv.id = ${variantId}
    WHERE d.id = ${dealId} AND d.status = 'active'
    LIMIT 1
  `;
  const info = dealInfo[0];
  if (!info) {
    throw new Error('Deal or variant not found / not active');
  }
  if (info.spots_total !== null && info.spots_claimed >= info.spots_total) {
    throw new Error('No spots left for this variant');
  }
  if (new Date(info.deal_expires_at) < new Date()) {
    throw new Error('Deal has expired');
  }

  const snapshot: ClaimSnapshot = {
    dealTitle: info.deal_title,
    vendorName: info.vendor_name,
    vendorId: info.vendor_id,
    variantLabel: info.variant_label,
    originalPriceCents: info.original_price_cents,
    dealPriceCents: info.deal_price_cents,
  };

  const qrPayload = `gloe:claim:${randomBytes(16).toString('hex')}`;
  const humanCode = generateHumanCode();

  const inserted = await sql<{ id: string; created_at: string; expires_at: string }[]>`
    INSERT INTO public.claims (
      user_id, deal_id, variant_id, vendor_id,
      snapshot, qr_payload, human_code,
      expires_at
    ) VALUES (
      ${userId}, ${dealId}, ${variantId}, ${info.vendor_id},
      ${sql.json(snapshot as unknown as postgres.JSONValue)}, ${qrPayload}, ${humanCode},
      now() + (${info.code_validity_days}::text || ' days')::interval
    )
    RETURNING id, created_at, expires_at
  `;
  const row = inserted[0];
  if (!row) throw new Error('Failed to create claim');

  // Bump the variant's spots_claimed counter
  await sql`
    UPDATE public.deal_variants
    SET spots_claimed = spots_claimed + 1
    WHERE id = ${variantId}
  `;

  return {
    id: row.id,
    dealId,
    variantId,
    vendorId: info.vendor_id,
    snapshot,
    qrPayload,
    humanCode,
    status: 'active',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    redeemedAt: null,
  };
}

export async function listClaimsForUser(sql: Sql, userId: string): Promise<Claim[]> {
  const rows = await sql<{
    id: string;
    deal_id: string;
    variant_id: string;
    vendor_id: string;
    snapshot: ClaimSnapshot;
    qr_payload: string;
    human_code: string;
    status: ClaimStatus;
    created_at: string;
    expires_at: string;
    redeemed_at: string | null;
  }[]>`
    SELECT id, deal_id, variant_id, vendor_id, snapshot, qr_payload, human_code,
           status, created_at, expires_at, redeemed_at
    FROM public.claims
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    dealId: r.deal_id,
    variantId: r.variant_id,
    vendorId: r.vendor_id,
    snapshot: r.snapshot,
    qrPayload: r.qr_payload,
    humanCode: r.human_code,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
  }));
}

export async function getClaimByIdForUser(
  sql: Sql,
  userId: string,
  claimId: string,
): Promise<Claim | null> {
  const rows = await sql<{
    id: string;
    deal_id: string;
    variant_id: string;
    vendor_id: string;
    snapshot: ClaimSnapshot;
    qr_payload: string;
    human_code: string;
    status: ClaimStatus;
    created_at: string;
    expires_at: string;
    redeemed_at: string | null;
  }[]>`
    SELECT id, deal_id, variant_id, vendor_id, snapshot, qr_payload, human_code,
           status, created_at, expires_at, redeemed_at
    FROM public.claims
    WHERE id = ${claimId} AND user_id = ${userId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    dealId: r.deal_id,
    variantId: r.variant_id,
    vendorId: r.vendor_id,
    snapshot: r.snapshot,
    qrPayload: r.qr_payload,
    humanCode: r.human_code,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
  };
}

export class RedemptionError extends Error {
  constructor(message: string, public readonly code: 'NOT_FOUND' | 'NOT_YOURS' | 'NOT_ACTIVE' | 'EXPIRED') {
    super(message);
    this.name = 'RedemptionError';
  }
}

/** Append-only audit row. Fire-and-forget — never block the user path on this. */
async function logRedemptionAttempt(
  sql: Sql,
  args: {
    vendorId: string;
    attemptedBy: string;
    codeAttempted: string;
    claimId: string | null;
    outcome: 'success' | 'lookup_only' | 'refused';
    errorCode: string | null;
  },
): Promise<void> {
  try {
    await sql`
      INSERT INTO public.redemption_attempts
        (vendor_id, attempted_by, code_attempted, claim_id, outcome, error_code)
      VALUES (
        ${args.vendorId}, ${args.attemptedBy}, ${args.codeAttempted},
        ${args.claimId}, ${args.outcome}, ${args.errorCode}
      )
    `;
  } catch (e) {
    // Never let an audit-log failure break a redemption.
    console.error('[redemption audit] failed to log:', (e as Error).message);
  }
}

export interface ClaimLookup {
  claimId: string;
  dealId: string;
  vendorId: string;
  status: ClaimStatus;
  snapshot: ClaimSnapshot;
  humanCode: string;
  expiresAt: string;
  redeemedAt: string | null;
  customerFirstName: string | null;
}

/**
 * Look up a claim by either its qr_payload (camera scan) or human_code
 * (manual entry), scoped to a specific vendor. Returns details for the
 * confirm screen. Does NOT mutate state — only fetches.
 *
 * Throws RedemptionError if the claim is missing, doesn't belong to this
 * vendor, or is in a non-redeemable state.
 */
export async function lookupClaimForVendor(
  sql: Sql,
  vendorId: string,
  attemptedBy: string,
  qrOrCode: string,
): Promise<ClaimLookup> {
  const trimmed = qrOrCode.trim();
  const codeUpper = trimmed.toUpperCase().replace(/^GLOE[-_]?/, '');
  const rows = await sql<{
    id: string;
    deal_id: string;
    vendor_id: string;
    status: ClaimStatus;
    snapshot: ClaimSnapshot;
    human_code: string;
    expires_at: string;
    redeemed_at: string | null;
    customer_first_name: string | null;
  }[]>`
    SELECT
      c.id, c.deal_id, c.vendor_id, c.status, c.snapshot,
      c.human_code, c.expires_at, c.redeemed_at,
      u.first_name AS customer_first_name
    FROM public.claims c
    JOIN public.users u ON u.id = c.user_id
    WHERE c.qr_payload = ${trimmed}
       OR c.human_code = ${codeUpper}
    LIMIT 1
  `;
  const r = rows[0];

  const audit = (claimId: string | null, errorCode: string | null) =>
    logRedemptionAttempt(sql, {
      vendorId,
      attemptedBy,
      codeAttempted: trimmed,
      claimId,
      outcome: errorCode ? 'refused' : 'lookup_only',
      errorCode,
    });

  if (!r) { void audit(null, 'NOT_FOUND'); throw new RedemptionError('Voucher not found.', 'NOT_FOUND'); }
  if (r.vendor_id !== vendorId) {
    void audit(r.id, 'NOT_YOURS');
    throw new RedemptionError("That voucher isn't for your business.", 'NOT_YOURS');
  }
  if (r.status === 'redeemed') {
    void audit(r.id, 'NOT_ACTIVE');
    throw new RedemptionError('This voucher was already redeemed.', 'NOT_ACTIVE');
  }
  if (r.status === 'cancelled') {
    void audit(r.id, 'NOT_ACTIVE');
    throw new RedemptionError('This voucher was cancelled.', 'NOT_ACTIVE');
  }
  if (r.status === 'expired' || new Date(r.expires_at) < new Date()) {
    void audit(r.id, 'EXPIRED');
    throw new RedemptionError('This voucher has expired.', 'EXPIRED');
  }

  void audit(r.id, null);
  return {
    claimId: r.id,
    dealId: r.deal_id,
    vendorId: r.vendor_id,
    status: r.status,
    snapshot: r.snapshot,
    humanCode: r.human_code,
    expiresAt: r.expires_at,
    redeemedAt: r.redeemed_at,
    customerFirstName: r.customer_first_name,
  };
}

/**
 * Real redemption — vendor-authenticated, the live path. Replaces the dev
 * stub. The caller must already have verified that `vendorId` is the
 * vendor that the logged-in user owns (the router does this via
 * requireVendor).
 *
 * Wall: claim must belong to this vendor, be 'active', and not expired.
 *
 * On success: flips claim to 'redeemed' atomically. Then, if the vendor has
 * auto_release_on_redemption=true, also fires the Stripe Transfer.
 *
 * A Transfer failure does NOT roll back the redemption — the customer was
 * served. The error is surfaced in the response so the operator sees it.
 */
export async function redeemClaimByVendor(
  sql: Sql,
  vendorId: string,
  attemptedBy: string,
  claimId: string,
): Promise<{
  redeemed: boolean;
  released: { transferId: string; amountCents: number } | null;
  releaseError: string | null;
}> {
  // Atomic: only flip if active AND belongs to this vendor AND not expired.
  // Four conditions in one write; two requests racing on the same voucher,
  // exactly one wins.
  const flipped = await sql<{ id: string }[]>`
    UPDATE public.claims
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = ${claimId}
      AND vendor_id = ${vendorId}
      AND status = 'active'
      AND expires_at > now()
    RETURNING id
  `;

  if (flipped.length === 0) {
    // Re-fetch to give a useful error.
    const stateRows = await sql<{ status: ClaimStatus; vendor_id: string; expires_at: string }[]>`
      SELECT status, vendor_id, expires_at FROM public.claims WHERE id = ${claimId} LIMIT 1
    `;
    const s = stateRows[0];
    const audit = (code: string) =>
      logRedemptionAttempt(sql, {
        vendorId, attemptedBy, codeAttempted: claimId,
        claimId: s ? claimId : null, outcome: 'refused', errorCode: code,
      });
    if (!s) { void audit('NOT_FOUND'); throw new RedemptionError('Voucher not found.', 'NOT_FOUND'); }
    if (s.vendor_id !== vendorId) {
      void audit('NOT_YOURS');
      throw new RedemptionError("That voucher isn't for your business.", 'NOT_YOURS');
    }
    if (new Date(s.expires_at) < new Date()) {
      void audit('EXPIRED');
      throw new RedemptionError('This voucher has expired.', 'EXPIRED');
    }
    void audit('NOT_ACTIVE');
    throw new RedemptionError(`This voucher is ${s.status} and can't be redeemed.`, 'NOT_ACTIVE');
  }

  void logRedemptionAttempt(sql, {
    vendorId, attemptedBy, codeAttempted: claimId,
    claimId, outcome: 'success', errorCode: null,
  });

  const { shouldAutoReleaseForClaim, releaseTransferForClaim } = await import('./payouts');
  if (!(await shouldAutoReleaseForClaim(sql, claimId))) {
    return { redeemed: true, released: null, releaseError: null };
  }

  try {
    const r = await releaseTransferForClaim(sql, claimId);
    return {
      redeemed: true,
      released: { transferId: r.transferId, amountCents: r.amountCents },
      releaseError: null,
    };
  } catch (e) {
    return {
      redeemed: true,
      released: null,
      releaseError: e instanceof Error ? e.message : 'unknown release error',
    };
  }
}

/**
 * @deprecated Use redeemClaimByVendor. Kept temporarily for the mobile
 * "test redeem" button if it still exists; new code shouldn't call this.
 */
export async function devMarkRedeemed(
  sql: Sql,
  userId: string,
  claimId: string,
): Promise<{
  redeemed: boolean;
  released: { transferId: string; amountCents: number } | null;
  releaseError: string | null;
}> {
  const flipped = await sql<{ id: string }[]>`
    UPDATE public.claims
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = ${claimId} AND user_id = ${userId} AND status = 'active'
    RETURNING id
  `;
  if (flipped.length === 0) {
    return { redeemed: false, released: null, releaseError: null };
  }

  const { shouldAutoReleaseForClaim, releaseTransferForClaim } = await import('./payouts');
  if (!(await shouldAutoReleaseForClaim(sql, claimId))) {
    return { redeemed: true, released: null, releaseError: null };
  }

  try {
    const r = await releaseTransferForClaim(sql, claimId);
    return {
      redeemed: true,
      released: { transferId: r.transferId, amountCents: r.amountCents },
      releaseError: null,
    };
  } catch (e) {
    return {
      redeemed: true,
      released: null,
      releaseError: e instanceof Error ? e.message : 'unknown release error',
    };
  }
}
