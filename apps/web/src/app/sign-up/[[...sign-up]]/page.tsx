import { SignUp } from '@clerk/nextjs';

import { BizAuthShell } from '../../../components/BizAuthShell';
import {
  CLERK_BIZ_APPEARANCE,
  CLERK_INVITED_BIZ_APPEARANCE,
  CLERK_PAGE_APPEARANCE,
} from '../../../components/consumer/clerkAppearance';

/**
 * Sign-up. Honors a `redirect_url` query param (default `/` for shoppers;
 * business pages pass `?redirect_url=/vendor`). Vendor-bound sign-ups render
 * inside the dark business shell so the /business → auth → /vendor funnel
 * reads as one continuous flow.
 *
 * Invited owners (claim & invite, GLO-5) arrive with `invited_email` plus a
 * `__clerk_ticket`: the ticket already verifies that email, so the copy says
 * so and the social buttons are hidden (signing up via SSO as a different
 * address would break the claim-by-email match).
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; invited_email?: string }>;
}) {
  const { redirect_url, invited_email } = await searchParams;
  const dest = redirect_url && redirect_url.startsWith('/') ? redirect_url : '/';
  const signInHref = `/sign-in${redirect_url ? `?redirect_url=${encodeURIComponent(redirect_url)}` : ''}`;

  if (dest.startsWith('/vendor')) {
    const invitedEmail = invited_email?.includes('@') ? invited_email : null;
    return (
      <BizAuthShell
        title={invitedEmail ? 'Finish setting up your login' : 'Create your business login'}
        subtitle={
          invitedEmail
            ? `This invite is for ${invitedEmail} — that email is already verified and will be your login. Choose a password and you’ll land in your spa’s dashboard.`
            : 'One account runs your whole spa — you’ll add the business details right after this.'
        }
      >
        <SignUp
          appearance={invitedEmail ? CLERK_INVITED_BIZ_APPEARANCE : CLERK_BIZ_APPEARANCE}
          forceRedirectUrl={dest}
          signInUrl={signInHref}
        />
      </BizAuthShell>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignUp appearance={CLERK_PAGE_APPEARANCE} forceRedirectUrl={dest} signInUrl={signInHref} />
    </main>
  );
}
