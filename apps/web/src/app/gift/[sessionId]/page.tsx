import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

/**
 * Public "gift" landing page. The customer in the mobile app generates a
 * Checkout Session, we hand them back gloe.app/gift/{sessionId}, and they
 * share that URL. The recipient lands here — a beautiful, restrained,
 * personalized moment — and taps Continue to checkout (which takes them to
 * Stripe-hosted checkout). After payment Stripe redirects back here with
 * ?success=1, which renders the "they'll love it" state.
 *
 * The page reads the Checkout Session straight from Stripe's REST API
 * server-side. No DB call, no auth. The session ID is unguessable (Stripe IDs
 * are 64-char tokens) and the page exposes no private data — only what's
 * already visible to the payer at checkout (line item, vendor name, amount).
 */

interface StripeCheckoutSession {
  id: string;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required' | null;
  amount_total: number | null;
  url: string | null;
  metadata: Record<string, string> | null;
  line_items?: {
    data: {
      description?: string | null;
      price: {
        product: {
          name?: string | null;
          description?: string | null;
          images?: string[] | null;
        };
      };
    }[];
  };
}

async function fetchSession(sessionId: string): Promise<StripeCheckoutSession | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured on web app');
  // Expand line items so we get the product name + image without a second call.
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product`,
    {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as StripeCheckoutSession;
}

function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return '';
  return `$${(cents / 100).toFixed(0)}`;
}

interface GiftPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ success?: string }>;
}

export async function generateMetadata({ params }: GiftPageProps): Promise<Metadata> {
  const { sessionId } = await params;
  const session = await fetchSession(sessionId).catch(() => null);
  const product = session?.line_items?.data?.[0]?.price?.product;
  const title = product?.name ?? 'A little something for you';
  return {
    title,
    description: 'Continue to secure checkout.',
    openGraph: {
      title,
      description: 'Continue to secure checkout.',
      ...(product?.images?.[0] ? { images: [product.images[0]] } : {}),
    },
  };
}

export default async function GiftPage({ params, searchParams }: GiftPageProps) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const session = await fetchSession(sessionId);
  if (!session) notFound();

  const isPaid = session.payment_status === 'paid' || sp.success === '1';
  const isExpired = session.status === 'expired';
  const product = session.line_items?.data?.[0]?.price?.product;
  const productName = product?.name ?? 'Your selection';
  const vendorAndVariant = product?.description ?? '';
  const productImage = product?.images?.[0] ?? null;
  const amount = formatPrice(session.amount_total);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface-primary)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 20px 64px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span
            style={{
              fontFamily: 'var(--font-outfit)',
              fontWeight: 600,
              fontSize: 28,
              letterSpacing: '0.14em',
              color: 'var(--gold)',
            }}
          >
            Gloē
          </span>
        </div>

        {isExpired ? <ExpiredState /> : isPaid ? <PaidState productName={productName} /> : (
          <OpenState
            productName={productName}
            vendorAndVariant={vendorAndVariant}
            productImage={productImage}
            amount={amount}
            checkoutUrl={session.url ?? ''}
          />
        )}

        <p
          style={{
            marginTop: 32,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            letterSpacing: '0.02em',
          }}
        >
          Secure checkout via Stripe · Apple Pay accepted
        </p>
      </div>
    </main>
  );
}

function OpenState({
  productName,
  vendorAndVariant,
  productImage,
  amount,
  checkoutUrl,
}: {
  productName: string;
  vendorAndVariant: string;
  productImage: string | null;
  amount: string;
  checkoutUrl: string;
}) {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-fraunces)',
            fontSize: 36,
            fontWeight: 500,
            lineHeight: 1.15,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          A little something for you
        </h1>
      </div>

      <div
        style={{
          background: 'var(--surface-elevated)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(43,32,25,0.06)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {productImage ? (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: 'var(--surface-secondary)' }}>
            <Image
              src={productImage}
              alt={productName}
              fill
              sizes="(max-width: 440px) 100vw, 440px"
              style={{ objectFit: 'cover' }}
              priority
            />
          </div>
        ) : null}
        <div style={{ padding: 24 }}>
          <h2
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1.25,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 6,
            }}
          >
            {productName}
          </h2>
          {vendorAndVariant ? (
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                margin: 0,
                marginBottom: 20,
              }}
            >
              {vendorAndVariant}
            </p>
          ) : null}
          <p
            style={{
              fontFamily: 'var(--font-fraunces)',
              fontSize: 32,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 20,
            }}
          >
            {amount}
          </p>
          <a
            href={checkoutUrl}
            style={{
              display: 'block',
              textAlign: 'center',
              background: 'var(--brand-500)',
              color: 'var(--text-inverse)',
              padding: '16px 24px',
              borderRadius: 999,
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'var(--font-inter)',
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}
          >
            Continue to checkout
          </a>
        </div>
      </div>
    </>
  );
}

function PaidState({ productName }: { productName: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 20,
        padding: '48px 28px',
        textAlign: 'center',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 42,
          marginBottom: 16,
          color: 'var(--gold)',
        }}
      >
        ✦
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.2,
          color: 'var(--text-primary)',
          margin: 0,
          marginBottom: 12,
        }}
      >
        All set
      </h1>
      <p
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Your payment for <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{productName}</strong> went through.
        The voucher is already in their wallet.
      </p>
    </div>
  );
}

function ExpiredState() {
  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 20,
        padding: '48px 28px',
        textAlign: 'center',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-fraunces)',
          fontSize: 24,
          fontWeight: 500,
          color: 'var(--text-primary)',
          margin: 0,
          marginBottom: 12,
        }}
      >
        This link has expired
      </h1>
      <p
        style={{
          fontSize: 15,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Ask whoever sent it to generate a fresh one.
      </p>
    </div>
  );
}
