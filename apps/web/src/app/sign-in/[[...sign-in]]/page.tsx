import { SignIn } from '@clerk/nextjs';

import { BizAuthShell } from '../../../components/BizAuthShell';
import { CLERK_BIZ_APPEARANCE, CLERK_PAGE_APPEARANCE } from '../../../components/consumer/clerkAppearance';

/**
 * Sign-in. Honors a `redirect_url` query param so the consumer flow returns to
 * where the shopper was (default `/`), while the business pages link here with
 * `?redirect_url=/vendor` to land in the vendor portal. Vendor-bound sign-ins
 * render inside the dark business shell for funnel continuity.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const dest = redirect_url && redirect_url.startsWith('/') ? redirect_url : '/';
  const signUpHref = `/sign-up${redirect_url ? `?redirect_url=${encodeURIComponent(redirect_url)}` : ''}`;

  if (dest.startsWith('/vendor')) {
    return (
      <BizAuthShell
        title="Welcome back"
        subtitle="Sign in to manage your spa — deals, redemptions, and payouts."
      >
        <SignIn appearance={CLERK_BIZ_APPEARANCE} forceRedirectUrl={dest} signUpUrl={signUpHref} />
      </BizAuthShell>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignIn appearance={CLERK_PAGE_APPEARANCE} forceRedirectUrl={dest} signUpUrl={signUpHref} />
    </main>
  );
}
