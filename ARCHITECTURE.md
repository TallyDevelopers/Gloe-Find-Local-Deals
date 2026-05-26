# Gloē — Architecture (one-pager)

> The system on one page. Read this before any other doc. If you need depth on a slice, the other docs go deep:
> - **[MONEY_FLOW.md](./MONEY_FLOW.md)** — how a dollar moves from card to bank
> - **[CREDITS_AND_FEES.md](./CREDITS_AND_FEES.md)** — pricing + credit-loyalty spec
> - **[TEST_SCENARIOS.md](./TEST_SCENARIOS.md)** — manual E2E test plan

---

## The mental model

Gloē is a **two-sided aesthetic-services marketplace** built as a monorepo with three frontend surfaces sharing one API and one database.

```
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│ MOBILE — customer      │       │ WEB — vendor portal    │       │ WEB — god mode         │
│ Expo / React Native    │       │ Next.js (Counter UX)   │       │ Next.js (Founder UX)   │
│ "Browse, buy, redeem"  │       │ "Scan, manage, get $"  │       │ "Run the marketplace"  │
└──────────┬─────────────┘       └────────────┬───────────┘       └──────────────┬─────────┘
           │                                  │                                  │
           │ tRPC over HTTPS                  │ tRPC over HTTPS                  │ tRPC over HTTPS
           │                                  │                                  │
           ▼                                  ▼                                  ▼
        ┌─────────────────────────────────────────────────────────────────────────┐
        │                       API — Hono + tRPC (Node 20)                       │
        │  Routers: claims · checkout · deals · vendor · admin · me · …           │
        │  Domain:  payouts · audit · fees · stripe · vendorHub · claims · …      │
        └────────────────────────────┬─────────────────────────────┬──────────────┘
                                     │                             │
                       ┌─────────────▼──────────────┐  ┌───────────▼──────────────┐
                       │  Postgres (Supabase)        │  │  Stripe                  │
                       │  Source of truth for:       │  │  System of record for:   │
                       │  - users, vendors, deals    │  │  - card charges          │
                       │  - claims (vouchers)        │  │  - Connect accounts      │
                       │  - transactions             │  │  - transfers + payouts   │
                       │  - payouts (mirrored)       │  │  - application fees      │
                       │  - audit_log + attempts     │  │                          │
                       │  - platform_fees (tiers)    │  │                          │
                       └─────────────────────────────┘  └──────────────────────────┘

                  Other external services:
                    • Clerk        — identity / sessions (every surface)
                    • Google Maps  — geocoding + redemption maps
```

---

## Surfaces (what users see)

| Surface | Code path | Audience | What it does |
|---|---|---|---|
| **Mobile app** | `apps/mobile` (Expo + React Native) | **Customers** | Browse local aesthetic deals, buy with Apple Pay / card, hold vouchers, show QR at redemption. |
| **Vendor portal** | `apps/web/src/app/vendor` (Next.js) | **Vendors** (spa owners / front-desk) | Daily ops: today's queue, scan QR / enter code to redeem, see money flow, manage deals, opt in to instant payouts. Designed for everyday counter use. |
| **God mode** | `apps/web/src/app/admin` (Next.js) | **Founder (Ryan)** | Control surface: pulse of the marketplace, transactions explorer, vendors table, customers, payouts, fees editor, audit log. `⌘K` global search across everything. |

All three surfaces hit the same tRPC API; per-procedure authorization decides what each can see/do (`adminProcedure` vs `protectedProcedure` vs `publicProcedure`).

---

## The API (one Node service)

`apps/api` — **Hono** HTTP framework, **tRPC** for typed RPC, **postgres-js** for direct SQL, **Stripe SDK** for everything money. Runs on Node 20.

**Routers** (`apps/api/src/router/`) — thin: input validation + auth + delegate to domain.
**Domain** (`apps/api/src/domain/`) — all business logic lives here. Examples:

- `checkout.ts` — create PaymentIntent + write `transactions` row
- `claims.ts` — voucher lifecycle, redemption with walls + audit
- `payouts.ts` — Stripe Transfer on redemption + Instant Payout orchestration
- `fees.ts` — tier resolution (vendor override beats global)
- `stripe.ts` — single seam to the Stripe SDK; nothing else imports it
- `audit.ts` — modular audit log; every money-moving / admin action calls `writeAudit()`
- `vendorHub.ts` / `admin.ts` — query layer for the two portals
- `payoutWebhooks.ts` — mirrors Stripe payout lifecycle into our `payouts` table

**Webhooks** (`apps/api/src/index.ts`):
- `account.updated` → sync vendor's Stripe onboarding state
- `payment_intent.succeeded` → fulfill the purchase, issue voucher(s)
- `payout.created/paid/failed/canceled` → mirror to our `payouts` table

---

## Data stores

### Postgres (Supabase)
Authoritative for **everything we control** — users, vendors, deals, deal_variants, claims, transactions, payouts (mirror), platform_fees, redemption_attempts, audit_log.

Why direct postgres (not an ORM): the schema is small, the queries are explicit, and we want zero magic between us and the DB on money-touching paths. Supabase is just managed Postgres + Auth helpers — we don't use their client SDK in the API.

### Stripe
Authoritative for **money itself** — card charges, connected-account state, transfers, payouts, application fees. We mirror what we need into our DB (so vendor portals can render without round-tripping Stripe on every page load) but never trust the mirror over Stripe when it matters.

The pattern: **our DB knows what *should* happen, Stripe knows what *did* happen, webhooks reconcile.**

### Clerk
Identity provider. Holds users + sessions. Every API call validates a Clerk token; the API resolves the Clerk user id → our internal `users.id`. We never store passwords.

---

## How a dollar flows (compressed — see MONEY_FLOW.md for the full thing)

```
1. CHARGE     customer → Gloē platform balance       (Stripe PaymentIntent)
2. TRANSFER   Gloē → vendor's Connect balance        (on QR redemption)
3. PAYOUT     vendor Connect → vendor bank           (Stripe daily, automatic)
   or 3'.     vendor Connect → vendor debit card     (Instant Payout, 3% fee, Gloē keeps 2%)
```

Gloē's platform fee is **implicit math** — we transfer less than we charged, the difference *is* the fee. Stripe never sees a "Gloē fee" line item for the platform fee. The 3% instant-payout fee is the one fee Stripe *does* know about (configured as an application-fee scheme in the Stripe Dashboard).

---

## Shared packages

`packages/` — typed code shared across the three surfaces.

- `@gloe/api-client` — generated tRPC client + inferred types (`RouterOutputs`, `RouterInputs`). The single seam between any frontend and the API's type surface.
- `@gloe/auth` — Clerk helpers shared by web + mobile.
- `@gloe/location` — geo helpers shared by mobile (discover) and web (vendor signup).
- `@gloe/ui` — design tokens + a small set of cross-platform primitives.

---

## What this architecture deliberately does NOT have (yet)

Each of these is a deferred choice, not an oversight:

- **No microservices.** One API. One DB. Splittable when traffic forces the issue, not before.
- **No real-time / WebSockets.** Polling at 10–30s is enough for everything we render today.
- **No queue / job runner.** Webhooks + tRPC mutations cover today's async needs. The scheduled-job items in `CREDITS_AND_FEES.md` §6b (24h hold, reconciliation) will need a cron — likely Vercel Cron or a tiny worker — when we build them.
- **No analytics warehouse.** Live SQL aggregates on the same Postgres are fine at current volume.
- **No feature flags.** Hardcoded conditionals. Add `growthbook` or similar when there's something worth A/B-testing.
- **No CI/CD.** Local `npx tsc --noEmit` for now; production deploys happen later.

---

## Where each "thing" lives (cheat sheet)

| If you want to change… | Look in… |
|---|---|
| How a customer browses or buys | `apps/mobile/features/discover/`, `apps/mobile/app/(app)/` |
| Vendor portal layout / scan UX | `apps/web/src/app/vendor/` |
| God-mode console | `apps/web/src/app/admin/console/` |
| Add or edit a tRPC procedure | `apps/api/src/router/*.router.ts` |
| Anything money-moving | `apps/api/src/domain/{checkout,payouts,stripe,fees}.ts` |
| Add a Stripe webhook | `apps/api/src/index.ts` + new domain handler |
| Schema | Supabase MCP (`apply_migration`) or `psql` directly |
| Auth rules | `apps/api/src/router/trpc.ts` (procedures + middleware) + `apps/web/src/middleware.ts` (Next gate) |
| Audit-log a new action | Extend `AuditAction` in `apps/api/src/domain/audit.ts`, call `writeAudit()` at the source |

---

## What changes when we hit scale

These are the load-bearing assumptions today. The day one of them breaks is the day the architecture has to evolve:

| Assumption | Breaks when | Likely change |
|---|---|---|
| One Node API serves all traffic | More than ~hundreds of req/sec sustained | Add a load balancer + horizontal copies of the API |
| Direct SQL on Postgres for every dashboard | Aggregates take > 1s | Materialized views / a read replica / push to a warehouse |
| Webhooks land directly into our DB | Webhook bursts during peak hours | Buffer to a queue (SQS / Pub/Sub) first |
| Polling for "live" UI | A vendor watches a screen all day | WebSockets / SSE for the few hot pages |
| One repo, one team (Ryan) | Second + third engineer joins | Don't split the repo; do enforce stricter directory ownership |

For now: the boring monolith is the right answer. Don't gold-plate.
