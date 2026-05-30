import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';

import type { Sql } from '../db/client';
import { getPassArt } from './walletPassArt';

/**
 * Apple Wallet (PassKit) integration. Generates signed `.pkpass` bundles for
 * voucher claims so customers can add them to the iOS Wallet app — the pass
 * surfaces on the lock screen when they're near the vendor.
 *
 * The signing cert is a Pass Type ID cert from developer.apple.com, exported
 * as a .p12 and split into signerCert.pem + signerKey.pem (one-time setup in
 * apps/api/secrets/, gitignored). Apple's WWDR intermediate cert chains the
 * signature back to Apple's root.
 *
 * Pass JSON spec: https://developer.apple.com/documentation/walletpasses/pass
 */

// Resolve secrets relative to this source file, NOT process.cwd() — the API
// can be started from either the repo root or apps/api, and the cwd-based
// path duplicates segments when started from apps/api.
const SECRETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'secrets');

// Lazy-load and cache certs — reads from disk once per process.
let cachedCerts: {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase: string;
} | null = null;

function getCerts() {
  if (cachedCerts) return cachedCerts;
  cachedCerts = {
    wwdr: readFileSync(join(SECRETS_DIR, 'wwdr.pem')),
    signerCert: readFileSync(join(SECRETS_DIR, 'signerCert.pem')),
    signerKey: readFileSync(join(SECRETS_DIR, 'signerKey.pem')),
    signerKeyPassphrase: process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE ?? '',
  };
  return cachedCerts;
}

interface ClaimRow {
  id: string;
  vendor_id: string;
  qr_payload: string;
  human_code: string;
  expires_at: string;
  status: string;
  snapshot: {
    dealTitle: string;
    vendorName: string;
    variantLabel: string;
    dealPriceCents: number;
  };
  vendor_name: string;
  vendor_address_line1: string | null;
  vendor_address_line2: string | null;
  vendor_city: string | null;
  vendor_region: string | null;
  vendor_postal_code: string | null;
  vendor_lat: number | null;
  vendor_lng: number | null;
}

/**
 * Look up everything we need to build a pass: claim + vendor location.
 * Returns null if the claim doesn't exist or doesn't belong to this user.
 */
async function fetchClaimForPass(
  sql: Sql,
  userId: string,
  claimId: string,
): Promise<ClaimRow | null> {
  const rows = await sql<ClaimRow[]>`
    SELECT
      c.id,
      c.vendor_id,
      c.qr_payload,
      c.human_code,
      c.expires_at,
      c.status,
      c.snapshot,
      v.business_name      AS vendor_name,
      v.address_line1      AS vendor_address_line1,
      v.address_line2      AS vendor_address_line2,
      v.city               AS vendor_city,
      v.region             AS vendor_region,
      v.postal_code        AS vendor_postal_code,
      ST_Y(v.location::geometry) AS vendor_lat,
      ST_X(v.location::geometry) AS vendor_lng
    FROM public.claims c
    JOIN public.vendors v ON v.id = c.vendor_id
    WHERE c.id = ${claimId} AND c.user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/** Join the vendor's split address fields into a single line for display. */
function formatVendorAddress(claim: ClaimRow): string {
  const street = [claim.vendor_address_line1, claim.vendor_address_line2]
    .filter(Boolean)
    .join(' ');
  const cityRegion = [claim.vendor_city, claim.vendor_region].filter(Boolean).join(', ');
  const full = [street, cityRegion, claim.vendor_postal_code].filter(Boolean).join(' · ');
  return full || claim.vendor_name;
}

/**
 * Build a signed .pkpass buffer for a single claim. Throws if the claim
 * doesn't belong to the user or required env/certs are missing.
 *
 * The pass is a "coupon" (Apple's term for vouchers/deals) — the strip layout
 * is wider and more visual than eventTicket, and Wallet surfaces it on the
 * lock screen when near the vendor.
 */
export async function buildVoucherPass(
  sql: Sql,
  userId: string,
  claimId: string,
): Promise<Buffer> {
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID;
  const teamIdentifier = process.env.APPLE_TEAM_ID;
  if (!passTypeIdentifier || !teamIdentifier) {
    throw new Error('Missing APPLE_PASS_TYPE_ID or APPLE_TEAM_ID env');
  }

  const claim = await fetchClaimForPass(sql, userId, claimId);
  if (!claim) throw new Error('Claim not found');

  const certs = getCerts();
  const art = await getPassArt();

  // Build the pass.json structure inline — passkit-generator accepts it via
  // the constructor and produces the bundle, signature, and zip. The art
  // buffers (icon/logo/strip @1x/2x/3x) ship as bundle files.
  const pass = new PKPass(
    art,
    {
      wwdr: certs.wwdr,
      signerCert: certs.signerCert,
      signerKey: certs.signerKey,
      signerKeyPassphrase: certs.signerKeyPassphrase,
    },
    {
      formatVersion: 1,
      passTypeIdentifier,
      teamIdentifier,
      organizationName: 'Gloē',
      serialNumber: claim.id,
      description: `${claim.snapshot.vendorName} — ${claim.snapshot.dealTitle}`,
      // Warm dark backdrop reads well against the gold strip; ivory text and
      // champagne labels match the brand palette + the strip's gold accents.
      backgroundColor: 'rgb(26, 19, 15)',
      foregroundColor: 'rgb(250, 245, 242)',
      labelColor: 'rgb(200, 154, 140)',
      // stripColor lets Wallet tint UI chrome under the strip — match the gold.
      stripColor: 'rgb(200, 154, 140)',
    },
  );

  // "coupon" layout: header strip + primary value + secondary/auxiliary rows.
  pass.type = 'coupon';

  // Wallet automatically greys out the pass at this date.
  pass.setExpirationDate(new Date(claim.expires_at));

  // QR code at the bottom — what spa staff scans to redeem.
  pass.setBarcodes({
    format: 'PKBarcodeFormatQR',
    message: claim.qr_payload,
    messageEncoding: 'iso-8859-1',
    altText: claim.human_code,
  });

  // Auto-surface the pass on the lock screen when near the vendor's address.
  // Apple shows the pass within ~100m by default.
  if (claim.vendor_lat !== null && claim.vendor_lng !== null) {
    pass.setLocations({
      latitude: claim.vendor_lat,
      longitude: claim.vendor_lng,
      relevantText: `Your ${claim.snapshot.dealTitle} is ready to redeem.`,
    });
  }
  pass.headerFields.push({
    key: 'expires',
    label: 'EXPIRES',
    value: new Date(claim.expires_at).toISOString(),
    dateStyle: 'PKDateStyleMedium',
    timeStyle: 'PKDateStyleNone',
  });
  pass.primaryFields.push({
    key: 'deal',
    label: claim.snapshot.vendorName.toUpperCase(),
    value: claim.snapshot.dealTitle,
  });
  pass.secondaryFields.push({
    key: 'variant',
    label: 'PACKAGE',
    value: claim.snapshot.variantLabel,
  });
  pass.auxiliaryFields.push({
    key: 'code',
    label: 'BACKUP CODE',
    value: claim.human_code,
  });
  // Back-of-pass fields — only visible when the user taps "info" on the pass.
  pass.backFields.push(
    {
      key: 'vendor-address',
      label: 'Location',
      value: formatVendorAddress(claim),
    },
    {
      key: 'how-to-use',
      label: 'How to use',
      value:
        'Show this pass at the front desk to redeem. Staff will scan the QR code (or type the backup code).',
    },
    {
      key: 'terms',
      label: 'Terms',
      value:
        'One redemption per pass. Non-transferable. Expires on the date shown. Subject to vendor availability.',
    },
  );

  return pass.getAsBuffer();
}
