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

/**
 * Dev/testing only — until the vendor app exists.
 * In production, the vendor app calls a different endpoint that requires the
 * scanning provider's auth.
 */
export async function devMarkRedeemed(sql: Sql, userId: string, claimId: string): Promise<void> {
  await sql`
    UPDATE public.claims
    SET status = 'redeemed', redeemed_at = now()
    WHERE id = ${claimId} AND user_id = ${userId} AND status = 'active'
  `;
}
