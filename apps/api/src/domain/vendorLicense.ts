import type { Sql } from '../db/client';

/**
 * GLO-19: provider license verification.
 *
 * We market spas as "vetted & licensed" — this is the process that backs the
 * claim. A vendor submits license number + state + type plus a document
 * (photo/PDF, stored in the private `license-docs` bucket); an admin reviews
 * it in god-mode and approves or rejects.
 *
 * Approving the license is also the moment a `pending_approval` vendor goes
 * `active` — it IS the vendor-approval step. (Stripe is still required to
 * post deals via getSetupStatus; admin_bypass keeps working for
 * founder-onboarded spas.) Vendors that were live before this shipped are
 * grandfathered: their status is untouched and they show as `unverified`
 * in the admin roster for follow-up.
 */

export type LicenseStatus = 'unverified' | 'pending_review' | 'verified' | 'rejected';

export interface VendorLicenseInfo {
  status: LicenseStatus;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseType: string | null;
  hasDocument: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

/** The current user's own license submission state, for the vendor dashboard. */
export async function getLicenseInfo(sql: Sql, ownerUserId: string): Promise<VendorLicenseInfo | null> {
  const rows = await sql<{
    license_status: LicenseStatus;
    license_number: string | null;
    license_state: string | null;
    license_type: string | null;
    license_document_path: string | null;
    license_submitted_at: string | null;
    license_reviewed_at: string | null;
    license_rejection_reason: string | null;
  }[]>`
    SELECT license_status, license_number, license_state, license_type,
           license_document_path, license_submitted_at, license_reviewed_at,
           license_rejection_reason
    FROM public.vendors
    WHERE owner_user_id = ${ownerUserId}
    LIMIT 1
  `;
  const v = rows[0];
  if (!v) return null;
  return {
    status: v.license_status,
    licenseNumber: v.license_number,
    licenseState: v.license_state,
    licenseType: v.license_type,
    hasDocument: !!v.license_document_path,
    submittedAt: v.license_submitted_at,
    reviewedAt: v.license_reviewed_at,
    rejectionReason: v.license_rejection_reason,
  };
}

export interface LicenseSubmission {
  licenseNumber: string;
  licenseState: string;
  licenseType: string;
  /**
   * Storage path inside the license-docs bucket, from vendor.signLicenseUpload.
   * Null = keep the previously-uploaded document (resubmit-after-rejection
   * where only the typed fields changed).
   */
  documentPath: string | null;
}

export class LicenseSubmitError extends Error {}

/**
 * Vendor submits (or resubmits after a rejection) their license for review.
 * Always lands in `pending_review` — verification is an admin decision.
 * A vendor that is already VERIFIED cannot resubmit (it would revoke their
 * own canPostDeals/canScan until re-review — a self-inflicted outage); a
 * license change for a verified vendor is an admin conversation.
 */
export async function submitLicense(sql: Sql, vendorId: string, input: LicenseSubmission): Promise<VendorLicenseInfo> {
  const rows = await sql<{ license_status: LicenseStatus; license_submitted_at: string; license_document_path: string | null }[]>`
    UPDATE public.vendors
    SET license_number = ${input.licenseNumber},
        license_state = ${input.licenseState.toUpperCase()},
        license_type = ${input.licenseType},
        license_document_path = COALESCE(${input.documentPath}, license_document_path),
        license_status = 'pending_review',
        license_submitted_at = now(),
        license_reviewed_at = NULL,
        license_rejection_reason = NULL
    WHERE id = ${vendorId}
      AND license_status <> 'verified'
      AND (${input.documentPath}::text IS NOT NULL OR license_document_path IS NOT NULL)
    RETURNING license_status, license_submitted_at, license_document_path
  `;
  const v = rows[0];
  if (!v) {
    const existing = await sql<{ license_status: LicenseStatus }[]>`
      SELECT license_status FROM public.vendors WHERE id = ${vendorId} LIMIT 1
    `;
    if (!existing[0]) throw new LicenseSubmitError('Vendor not found.');
    if (existing[0].license_status === 'verified') {
      throw new LicenseSubmitError('Your license is already verified. Contact support to update it.');
    }
    throw new LicenseSubmitError('Attach a photo or PDF of your license.');
  }
  return {
    status: v.license_status,
    licenseNumber: input.licenseNumber,
    licenseState: input.licenseState.toUpperCase(),
    licenseType: input.licenseType,
    hasDocument: !!v.license_document_path,
    submittedAt: v.license_submitted_at,
    reviewedAt: null,
    rejectionReason: null,
  };
}

export class LicenseReviewError extends Error {}

/**
 * Admin decision. Approve → license verified, and a pending_approval vendor
 * goes active (this is the "vetted" gate opening). Reject → vendor sees the
 * reason on their dashboard and can resubmit; their account status is
 * untouched (a grandfathered live vendor is never knocked offline by a
 * rejected license — suspension stays a separate, deliberate act).
 *
 * Both branches require an actual PENDING submission: a stale admin tab or a
 * double-fired mutation can neither verify a vendor with nothing on file nor
 * reject (and thereby un-verify) an already-verified license.
 */
export async function reviewVendorLicense(
  sql: Sql,
  vendorId: string,
  decision: 'approve' | 'reject',
  reason?: string | null,
): Promise<{ licenseStatus: LicenseStatus; vendorStatus: string }> {
  if (decision === 'approve') {
    const rows = await sql<{ status: string }[]>`
      UPDATE public.vendors
      SET license_status = 'verified',
          license_reviewed_at = now(),
          license_rejection_reason = NULL,
          verified_at = COALESCE(verified_at, now()),
          status = CASE WHEN status = 'pending_approval' THEN 'active' ELSE status END
      WHERE id = ${vendorId} AND license_status = 'pending_review'
      RETURNING status
    `;
    const v = rows[0];
    if (!v) throw new LicenseReviewError('No pending license submission to approve.');
    return { licenseStatus: 'verified', vendorStatus: v.status };
  }
  const rows = await sql<{ status: string }[]>`
    UPDATE public.vendors
    SET license_status = 'rejected',
        license_reviewed_at = now(),
        license_rejection_reason = ${reason ?? null}
    WHERE id = ${vendorId} AND license_status = 'pending_review'
    RETURNING status
  `;
  const v = rows[0];
  if (!v) throw new LicenseReviewError('No pending license submission to reject.');
  return { licenseStatus: 'rejected', vendorStatus: v.status };
}

/** Vendors awaiting license review, oldest first — the admin queue. */
export async function getLicenseReviewQueue(sql: Sql) {
  const rows = await sql<{
    id: string;
    business_name: string;
    city: string;
    license_number: string;
    license_state: string;
    license_type: string | null;
    license_submitted_at: string;
  }[]>`
    SELECT id, business_name, city, license_number, license_state, license_type, license_submitted_at
    FROM public.vendors
    WHERE license_status = 'pending_review'
    ORDER BY license_submitted_at ASC
  `;
  return rows.map((r) => ({
    vendorId: r.id,
    businessName: r.business_name,
    city: r.city,
    licenseNumber: r.license_number,
    licenseState: r.license_state,
    licenseType: r.license_type,
    submittedAt: r.license_submitted_at,
  }));
}
