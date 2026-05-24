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

  // Payment succeeded → mark transaction paid + create the voucher(s).
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; metadata: Record<string, string> };
    const m = pi.metadata;
    if (m?.userId && m?.variantId && m?.dealId && m?.vendorId) {
      try {
        await fulfillPurchase(sql, pi.id, {
          userId: m.userId,
          variantId: m.variantId,
          dealId: m.dealId,
          vendorId: m.vendorId,
          quantity: Number(m.quantity || '1'),
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
