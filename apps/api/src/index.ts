import 'dotenv/config';

import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { sql } from './db/client';
import { createContext } from './context/context';
import { appRouter } from './router';
import { fulfillPurchase } from './domain/checkout';
import { handleStripePayoutWebhook } from './domain/payoutWebhooks';
import { constructWebhookEvent } from './domain/stripe';
import { syncVendorStripeStatus } from './domain/vendorStripe';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*', // tighten before launch
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  }),
);

app.get('/', (c) =>
  c.json({ name: 'gloe-api', status: 'ok', time: new Date().toISOString() }),
);

app.get('/health', (c) => c.json({ ok: true }));

/**
 * Stripe webhook. Raw body + signature verification (must read the body as text
 * for the signature to validate). Syncs a connected account's status onto the
 * vendor when onboarding completes / capabilities change.
 */
app.post('/webhooks/stripe', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) return c.json({ error: 'missing signature' }, 400);
  const raw = await c.req.text();

  let event;
  try {
    event = constructWebhookEvent(raw, signature);
  } catch (e) {
    console.error('Stripe webhook signature failed:', (e as Error).message);
    return c.json({ error: 'bad signature' }, 400);
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as { id: string };
    try {
      await syncVendorStripeStatus(sql, account.id);
    } catch (e) {
      console.error('Failed to sync vendor stripe status:', (e as Error).message);
    }
  }

  // Payout lifecycle on connected accounts — mirror state to our `payouts` table.
  if (
    event.type === 'payout.created' ||
    event.type === 'payout.paid' ||
    event.type === 'payout.failed' ||
    event.type === 'payout.canceled'
  ) {
    try {
      await handleStripePayoutWebhook(sql, event);
    } catch (e) {
      console.error('Failed to handle payout webhook:', (e as Error).message);
    }
  }

  // Gift-link checkout finished — capture payer identity from the Session
  // (it's not on the bare PaymentIntent) and fulfill against the txn we
  // already recorded by session ID. payment_intent.succeeded may also fire
  // for the same charge; fulfillPurchase is idempotent so either order is safe.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string;
      payment_intent?: string | null;
      payment_status?: 'paid' | 'unpaid' | 'no_payment_required' | null;
      metadata?: Record<string, string>;
      customer_details?: { email?: string | null; name?: string | null } | null;
    };
    const m = session.metadata;
    if (session.payment_status === 'paid' && m?.userId && m?.variantId && m?.dealId && m?.vendorId) {
      // The PI fee isn't on the session itself — pull the same expanded
      // payment_intent.latest_charge.balance_transaction we use for in-app.
      let stripeFeeCents = 0;
      const piId = typeof session.payment_intent === 'string' ? session.payment_intent : '';
      if (piId) {
        try {
          const Stripe = (await import('stripe')).default;
          const stripeKey = process.env.STRIPE_SECRET_KEY;
          if (stripeKey) {
            const sc = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });
            const full = await sc.paymentIntents.retrieve(piId, {
              expand: ['latest_charge.balance_transaction'],
            });
            const charge = full.latest_charge;
            if (charge && typeof charge !== 'string') {
              const bt = charge.balance_transaction;
              if (bt && typeof bt !== 'string' && typeof bt.fee === 'number') {
                stripeFeeCents = bt.fee;
              }
            }
          }
        } catch (e) {
          console.error('Failed to load Stripe fee for gift session:', (e as Error).message);
        }
      }
      try {
        await fulfillPurchase(sql, piId, {
          userId: m.userId,
          variantId: m.variantId,
          dealId: m.dealId,
          vendorId: m.vendorId,
          quantity: Number(m.quantity || '1'),
          stripeFeeCents,
          payerEmail: session.customer_details?.email ?? null,
          payerName: session.customer_details?.name ?? null,
          stripeCheckoutSessionId: session.id,
        });
      } catch (e) {
        console.error('Failed to fulfill gift purchase:', (e as Error).message);
      }
    }
  }

  // Payment succeeded → mark transaction paid + create the voucher(s).
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as {
      id: string;
      metadata: Record<string, string>;
      latest_charge?: { balance_transaction?: { fee: number } | string | null } | string | null;
    };
    const m = pi.metadata;
    // Stripe's actual processing fee lives on the charge's balance_transaction.
    // Pull it so we can persist real fee data instead of a guess.
    let stripeFeeCents = 0;
    try {
      const Stripe = (await import('stripe')).default;
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey) {
        const sc = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' });
        const full = await sc.paymentIntents.retrieve(pi.id, {
          expand: ['latest_charge.balance_transaction'],
        });
        const charge = full.latest_charge;
        if (charge && typeof charge !== 'string') {
          const bt = charge.balance_transaction;
          if (bt && typeof bt !== 'string' && typeof bt.fee === 'number') {
            stripeFeeCents = bt.fee;
          }
        }
      }
    } catch (e) {
      // Non-fatal — we'd rather record $0 fee than skip fulfillment entirely.
      console.error('Failed to load Stripe fee:', (e as Error).message);
    }
    if (m?.userId && m?.variantId && m?.dealId && m?.vendorId) {
      try {
        await fulfillPurchase(sql, pi.id, {
          userId: m.userId,
          variantId: m.variantId,
          dealId: m.dealId,
          vendorId: m.vendorId,
          quantity: Number(m.quantity || '1'),
          stripeFeeCents,
        });
      } catch (e) {
        console.error('Failed to fulfill purchase:', (e as Error).message);
      }
    }
  }

  return c.json({ received: true });
});

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) =>
      createContext({ c }) as unknown as Promise<Record<string, unknown>>,
  }),
);

const port = Number(process.env.PORT) || 4000;
// Bind to 0.0.0.0 so physical devices on the same Wi-Fi can reach the dev API
// (default would be loopback-only, breaking iPhone testing against the Mac).
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`▲ Gloe API listening on http://0.0.0.0:${info.port}`);
});
