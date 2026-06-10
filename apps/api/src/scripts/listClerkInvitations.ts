import 'dotenv/config';

import { clerk } from '../context/auth';

/** Read-only: list recent Clerk invitations + which instance we're talking to. */
async function main() {
  const key = process.env.CLERK_SECRET_KEY ?? '';
  console.log('Clerk instance type:', key.startsWith('sk_live') ? 'PRODUCTION' : key.startsWith('sk_test') ? 'DEVELOPMENT (emails come from accounts.dev — check spam)' : 'unknown');
  const list = await clerk.invitations.getInvitationList({ limit: 10 });
  if (list.data.length === 0) {
    console.log('No invitations exist on this Clerk instance — the create call never succeeded.');
    return;
  }
  for (const inv of list.data) {
    console.log(`${inv.emailAddress} · status=${inv.status} · created=${new Date(inv.createdAt).toISOString()} · url=${inv.url ?? '—'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
