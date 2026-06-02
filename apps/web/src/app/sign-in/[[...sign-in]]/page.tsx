import { SignIn } from '@clerk/nextjs';

const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#b8806f',
    colorBackground: '#ffffff',
    colorText: '#2b2019',
    borderRadius: '12px',
    fontFamily: 'Inter, sans-serif',
  },
} as const;

/**
 * Sign-in. Honors a `redirect_url` query param so the consumer flow returns to
 * where the shopper was (default `/`), while the business pages link here with
 * `?redirect_url=/vendor` to land in the vendor portal.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const dest = redirect_url && redirect_url.startsWith('/') ? redirect_url : '/';
  const signUpHref = `/sign-up${redirect_url ? `?redirect_url=${encodeURIComponent(redirect_url)}` : ''}`;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <SignIn appearance={CLERK_APPEARANCE} forceRedirectUrl={dest} signUpUrl={signUpHref} />
    </main>
  );
}
