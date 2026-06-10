import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { sql } from '../db/client';
import { createSignedReadUrl, createSignedUpload } from '../db/storage';
import { getSetupStatus } from '../domain/vendorSignup';
import { getLicenseInfo, getLicenseReviewQueue, reviewVendorLicense, submitLicense } from '../domain/vendorLicense';

/**
 * End-to-end license verification test (GLO-19), with the REAL domain code
 * against the live DB + live storage:
 *   1. Seed an owned vendor in pending_approval (the organic signup state).
 *   2. Upload a fake "license doc" through the signed-upload flow into the
 *      PRIVATE license-docs bucket; assert the public URL 403s.
 *   3. submitLicense → pending_review; setup checklist still gates posting.
 *   4. Vendor appears in the admin review queue.
 *   5. reject → vendor sees the reason; resubmit → pending_review again.
 *   6. approve → license verified AND vendor flips active; checklist's
 *      license step turns done; signed READ url serves the doc.
 *   7. Hard-delete everything seeded.
 */

function assert(cond: unknown, label: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const ownerUserId = randomUUID();
  console.log('1. Seeding test user + vendor (pending_approval)…');
  await sql`
    INSERT INTO public.users (id, clerk_user_id, email, first_name)
    VALUES (${ownerUserId}, ${'test_license_' + suffix}, ${'license-test-' + suffix + '@example.com'}, 'LicenseTest')
  `;
  const vRows = await sql<{ id: string }[]>`
    INSERT INTO public.vendors (owner_user_id, business_name, slug, phone, address_line1, city, region, postal_code, country, location, status)
    VALUES (${ownerUserId}, ${'License Test Spa ' + suffix}, ${'license-test-' + suffix}, '5550100', '1 Test St', 'Austin', 'TX', '78701', 'US', ST_SetSRID(ST_MakePoint(-97.74, 30.27), 4326)::geography, 'pending_approval')
    RETURNING id
  `;
  const vendorId = vRows[0]!.id;

  try {
    console.log('2. Uploading doc via signed upload to the PRIVATE bucket…');
    const signed = await createSignedUpload(vendorId, 'pdf', 'license');
    assert(signed.publicUrl === '', 'no public URL is handed out for the private bucket');
    const put = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Blob(['%PDF-1.4 fake license for test'], { type: 'application/pdf' }),
    });
    assert(put.ok, `signed upload succeeds (${put.status})`);
    const publicProbe = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/public/license-docs/${signed.path}`,
    );
    assert(publicProbe.status === 400 || publicProbe.status === 403 || publicProbe.status === 404,
      `public access to the doc is blocked (${publicProbe.status})`);

    console.log('3. Vendor submits license…');
    await submitLicense(sql, vendorId, {
      licenseNumber: 'RN-' + suffix,
      licenseState: 'tx',
      licenseType: 'Registered Nurse (RN)',
      documentPath: signed.path,
    });
    let info = await getLicenseInfo(sql, ownerUserId);
    assert(info?.status === 'pending_review', 'license lands in pending_review');
    assert(info?.licenseState === 'TX', 'state is normalized to uppercase');
    let setup = await getSetupStatus(sql, ownerUserId);
    assert(setup?.steps.license === false, 'checklist license step NOT done while pending');
    assert(setup?.canPostDeals === false, 'cannot post deals while pending');

    console.log('4. Admin queue…');
    const queue = await getLicenseReviewQueue(sql);
    assert(queue.some((q) => q.vendorId === vendorId), 'vendor shows in the review queue');

    console.log('5. Reject → resubmit…');
    const rejected = await reviewVendorLicense(sql, vendorId, 'reject', 'Number does not match the TX board.');
    assert(rejected.licenseStatus === 'rejected', 'rejection sets license_status=rejected');
    assert(rejected.vendorStatus === 'pending_approval', 'rejection does NOT change vendor status');
    info = await getLicenseInfo(sql, ownerUserId);
    assert(info?.rejectionReason === 'Number does not match the TX board.', 'vendor sees the rejection reason');
    await submitLicense(sql, vendorId, {
      licenseNumber: 'RN-' + suffix + '-2',
      licenseState: 'TX',
      licenseType: 'Registered Nurse (RN)',
      documentPath: signed.path,
    });
    info = await getLicenseInfo(sql, ownerUserId);
    assert(info?.status === 'pending_review' && info.rejectionReason === null, 'resubmit returns to pending_review and clears the reason');

    console.log('6. Approve…');
    const approved = await reviewVendorLicense(sql, vendorId, 'approve');
    assert(approved.licenseStatus === 'verified', 'approval sets license_status=verified');
    assert(approved.vendorStatus === 'active', 'approval flips pending_approval vendor to active');
    setup = await getSetupStatus(sql, ownerUserId);
    assert(setup?.steps.license === true, 'checklist license step done after approval');
    assert(setup?.canPostDeals === false, 'still cannot post (Stripe not connected) — gate composition holds');
    const readUrl = await createSignedReadUrl('license', signed.path);
    const read = await fetch(readUrl);
    assert(read.ok, `signed READ url serves the doc for admin (${read.status})`);

    console.log('\nALL PASSED 🎉');
  } finally {
    console.log('7. Cleaning up…');
    await sql`DELETE FROM public.audit_log WHERE vendor_id = ${vendorId}`;
    await sql`DELETE FROM public.vendors WHERE id = ${vendorId}`;
    await sql`DELETE FROM public.users WHERE id = ${ownerUserId}`;
    await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/license-docs/${vendorId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch(() => {});
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
