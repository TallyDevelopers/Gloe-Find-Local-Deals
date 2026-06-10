import { SignUp } from '@clerk/nextjs';

import { BizAuthShell } from '../../../components/BizAuthShell';
import { CLERK_BIZ_APPEARANCE, CLERK_PAGE_APPEARANCE } from '../../../components/consumer/clerkAppearance';

/**
 * Sign-up. Honors a `redirect_url` query param (default `/` for shoppers;
 * business pages pass `?redirect_url=/vendor`). Vendor-bound sign-ups render
 * inside the dark business shell so the /business → auth → /vendor funnel
 * reads as one continuous flow.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const dest = redirect_url && redirect_url.startsWith('/') ? redirect_url : '/';
  const signInHref = `/sign-in${redirect_url ? `?redirect_url=${encodeURIComponent(redirect_url)}` : ''}`;

  if (dest.startsWith('/vendor')) {
    return (
      <BizAuthShell
        title="Create your business login"
        subtitle="One account runs your whole spa — you’ll add the business details right after this."
      >
        <SignUp appearance={CLERK_BIZ_APPEARANCE} forceRedirectUrl={dest} signInUrl={signInHref} />
      </BizAuthShell>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignUp appearance={CLERK_PAGE_APPEARANCE} forceRedirectUrl={dest} signInUrl={signInHref} />
    </main>
  );
}
