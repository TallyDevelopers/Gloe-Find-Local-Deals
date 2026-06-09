import 'dotenv/config';

import { createSignedReadUrl, createSignedUpload } from '../db/storage';

/**
 * Storage-only probe for GLO-19 (no database access): exercises the signed
 * UPLOAD and signed READ code paths against the private license-docs bucket
 * with one scratch object, asserts public access is blocked, then deletes it.
 */

function assert(cond: unknown, label: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function main() {
  const scratch = `storage-probe/${Date.now()}`;
  const signed = await createSignedUpload(scratch, 'pdf', 'license');
  assert(signed.publicUrl === '', 'private bucket hands out no public URL');
  assert(signed.path.startsWith(`${scratch}/`), 'object path is scoped to the caller folder');

  const put = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: new Blob(['%PDF-1.4 probe'], { type: 'application/pdf' }),
  });
  assert(put.ok, `signed upload accepted (${put.status})`);

  const publicProbe = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/public/license-docs/${signed.path}`,
  );
  assert([400, 403, 404].includes(publicProbe.status), `public read blocked (${publicProbe.status})`);

  const readUrl = await createSignedReadUrl('license', signed.path);
  const read = await fetch(readUrl);
  assert(read.ok, `signed read serves the doc (${read.status})`);
  const body = await read.text();
  assert(body.includes('probe'), 'doc round-trips intact');

  const del = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/license-docs/${signed.path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  assert(del.ok, `scratch object deleted (${del.status})`);

  console.log('\nSTORAGE PROBE PASSED 🎉');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
