import { SignUp } from '@clerk/nextjs';

import { CLERK_APPEARANCE } from '../../../components/consumer/clerkAppearance';

/**
 * Sign-up. Honors a `redirect_url` query param (default `/` for shoppers;
 * business pages pass `?redirect_url=/vendor`).
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const dest = redirect_url && redirect_url.startsWith('/') ? redirect_url : '/';
  const signInHref = `/sign-in${redirect_url ? `?redirect_url=${encodeURIComponent(redirect_url)}` : ''}`;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignUp appearance={CLERK_APPEARANCE} forceRedirectUrl={dest} signInUrl={signInHref} />
    </main>
  );
}
