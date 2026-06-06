# Gloē — Single Source of Truth

> The first place a woman opens when she's thinking about getting Botox, filler, or any aesthetic treatment — to find the best deal near her, today.

Last consolidated: 2026-05-29. Last updated: 2026-06-01 (search & discovery engine; doc restructured with a Start-Here map + dual investor/builder lenses).

---

## 🧭 Start Here

**Gloē in one line:** the first app a woman opens when she's thinking about Botox, filler, or any aesthetic treatment — to find and book the best deal near her, today. A two-sided marketplace: **consumers** find and buy deals; **vendors** post for free and pay only when a customer actually shows up and redeems.

### This doc has two readers — every section is written for both

> **📖 How to read any section:** look for the two parts.
> **💼 The pitch** = plain English. What it does, why it matters, where the money is. No code. (For investors — and for *you* remembering why a thing exists.)
> **🔧 Under the hood** = how it's actually built. Files, flow, schema. (For building on it.)

- **💼 Investor / business path:** §1 What Gloē is → §2 Business model → the **Feature index** below → §16 Costs → §14 Roadmap.
- **🔧 Builder path:** §3 Architecture → §4 Money pipeline → §5 Schema → the feature deep-dives (§6–§8) → §11 Runbook.

### Feature index — everything Gloē does, at a glance

| Feature | 💼 In plain English | 🔧 Where it's documented | Status |
|---|---|---|---|
| **Discover feed** | Browse the best aesthetic deals near you, ranked | §6 Consumer app | ✅ |
| **Search** | Type a treatment — even misspelled or slang ("tox") — get nearby matches | §6A Search engine | ✅ |
| **Claim & pay** | Buy a voucher in-app with Apple Pay or card | §6B Pay & share · §4 Money | ✅ |
| **Share to pay** | Text a link so someone *else* pays for your treatment | §6B Pay & share | ✅ |
| **Voucher & redeem** | QR voucher; the vendor scans it to mark it used | §4 Money · §6 | ✅ |
| **Apple Wallet** | Add the voucher to Apple Wallet (`.pkpass`) | §6C Apple Wallet | ✅ (live "redeemed" update pending) |
| **Push notifications** | Get pinged when something happens (reply, redemption) | §6D Notifications | ✅ |
| **Saved** | Heart deals to come back to | §6 Consumer app | ✅ |
| **Concierge support** | In-app chat with Gloē, photo/video, god-mode reply | §6 · §8 Admin | ✅ |
| **Bottom navigation** | Discover · Saved · Wallet · Profile | §6E App shell | ✅ |
| **Loyalty points** | Members earn points (purchases + actions) and redeem them toward bookings | §9 Credit · Linear GLO-24 | 🟡 planned |
| **Reviews** | Gloē reviews + live Google reviews (with reviewer photos) on each deal; leads with whichever has more | §6 Consumer | ✅ |
| **Vendor storefront** | Public spa profile — hero, logo, "Gloē's take", hours, vibe, amenities, providers, deals, video reel, reviews, map | §7 Vendor · WEB.md | ✅ |
| **Vendor profile videos** | Spas upload short "Inside the spa" clips (vendor-level, shown on the profile) | §7 Vendor | ✅ |
| **Location maps** | Cached static map of each spa, auto-captured when their address is set | §5 · §7 | ✅ |
| **Vendor — post a deal** | Vendors list a treatment; we auto-tag it (Botox/Dysport) | §7 Vendor · §6A | ✅ |
| **Vendor — scan & redeem** | Vendor scans the customer's QR to mark redeemed | §7 Vendor portal | ✅ |
| **Vendor — get paid** | Stripe Connect payout when a deal is redeemed; instant payout option | §4 Money · §7 | ✅ |
| **Admin god mode** | Run the whole business: vendors, payouts, fees, refunds, support | §8 Admin | ✅ |
| **Refunds** | Full/partial refunds + a forensic refund ledger | §8 Admin | ✅ |

### Status board (the honest state)

- **✅ Shipped & working:** the full buy→redeem→get-paid loop, search & discovery, refunds, support, Apple Wallet passes, push, Gloē + Google reviews on deals, the redesigned vendor storefront (profile + "Inside the spa" video reel), cached location maps.
- **🟡 In progress / planned:** loyalty points (planned — earn + redeem, see Linear GLO-24), Apple Wallet live status updates, search/click logging.
- **❌ Launch blockers (do before App Store):** Sign in with Apple, dispute/chargeback webhook, ATT prompt, counsel-reviewed Terms/Privacy, provider license verification. **The canonical, living backlog now lives in Linear → "Gloē" project** (filter the `launch-blocker` label); §10 is the in-doc snapshot.

> **Where work is tracked:** **Linear** (Gloē project, `GLO-*`) is the roadmap — what's next & why. **This doc** is what *exists* today. When a Linear ticket ships, it gets reflected here.

### Where everything lives (full nav)

§1–2 the story & money model · §3–5 how it's built (architecture, money pipeline, database) · §6–6E the consumer app & its features · §7 vendor portal · §8 admin · §9 credit · **§10 what's done vs not** · §11 launch runbook · §12 test scripts · §13 day-to-day ops · §14 roadmap · §15 legal · §16 costs · §17 out of scope · §18 FAQ.

---

## Table of Contents

1. [What Gloē is](#1-what-gloē-is)
2. [The business model](#2-the-business-model)
3. [Architecture](#3-architecture)
4. [The money pipeline](#4-the-money-pipeline)
5. [Database schema](#5-database-schema)
6. [Consumer app](#6-consumer-app)
6A. [Search & discovery engine](#6a-search--discovery-engine)
6B. [Claim, pay & "Share to pay"](#6b-claim-pay--share-to-pay)
6C. [Apple Wallet passes](#6c-apple-wallet-passes)
6D. [Push notifications](#6d-push-notifications)
6E. [App shell & bottom navigation](#6e-app-shell--bottom-navigation)
7. [Vendor portal](#7-vendor-portal)
8. [Admin (god mode)](#8-admin-god-mode)
9. [Credit & loyalty system](#9-credit--loyalty-system)
10. [What's shipped, what's pending](#10-whats-shipped-whats-pending)
11. [Pre-launch runbook](#11-pre-launch-runbook)
12. [Manual test scenarios](#12-manual-test-scenarios)
13. [Operating the system day-to-day](#13-operating-the-system-day-to-day)
14. [Roadmap (v1 → v4)](#14-roadmap-v1--v4)
15. [Legal & compliance](#15-legal--compliance)
16. [Infrastructure & costs](#16-infrastructure--costs)
17. [Out of scope (for now)](#17-out-of-scope-for-now)
18. [FAQ — common confusions](#18-faq--common-confusions)

---

## 1. What Gloē is

### 💼 The pitch

Gloē is the first place a woman looks when she's thinking about Botox, filler, or any aesthetic treatment — an app that shows the **best real deals near her** and lets her book in two taps. Vendors (medspas, injectors, wellness clinics) list deals **for free** and only pay Gloē when a customer **actually shows up and redeems**. Think "Groupon for aesthetics," but curated, mobile-first, and incentive-aligned — we only make money when our vendors do.

**North Star Metric:** monthly redemptions per active consumer. Not downloads, not signups — the moment a voucher gets scanned at the spa. That's a real booking, real money, real value on both sides.

### 🔧 Under the hood

A two-sided marketplace for aesthetic services (Botox, filler, medspa, facials, IV, body, dental, etc.). **Three surfaces, one backend:**
- **Mobile (iOS):** Expo dev-client. Consumer-facing — browse, claim, redeem.
- **Web — vendor portal:** Next.js at `apps/web/src/app/vendor`. Signup, deals, dashboard, scanner.
- **Web — admin (god mode):** Next.js at `apps/web/src/app/admin`. Vendor approval, payouts, fees, audit.
- **API:** Hono + tRPC at `apps/api`. All business logic.

---

## 2. The business model

### 💼 The pitch

**Pay-per-transaction, NOT subscription.** Locked 2026-05-19.

- Consumers browse free, pay full deal price in-app (Apple Pay / card) at claim time.
- Vendors sign up free, post deals free, pay **no monthly anything**.
- Gloē collects payment, holds the funds, and pays the vendor out **on redemption** minus a platform fee.

**Why pay-as-you-earn.** The original $99–199/mo vendor subscription was killed because:

> "If customers just sign up for a subscription and pay but there's not enough clients, they're gonna feel like they're paying for nothing as opposed to you just sign up, you don't pay anything until someone pays."

It aligns incentives (Gloē only makes money when vendors do), kills onboarding friction, and beats Groupon's 30–50% on positioning ("post free, we get paid only when you do").

**Why we win.**
- **Groupon:** takes 30–50% and dilutes the brand. We take ~20% (and we set it) and curate.
- **RealSelf:** review-heavy, deal-light. We're transactional.
- **Instagram ads:** vendors burn $1k+/mo and get nothing trackable. We charge nothing until a real booking lands.
- **UNNI (closest competitor):** validates the market exists. We win on visual polish + breadth.

**Two revenue lines:** (1) the **platform fee** on every sale (~20%, tiered, we set it), and (2) a thin margin on **instant payouts** — vendors who want their money in ~30 min instead of 1–2 days pay Stripe 3%; Stripe's real cost is ~1%, so **Gloē nets ~2%** per instant payout (vendor still sees ~94.7%). Standard ACH payouts stay free.

### 🔧 Under the hood

**The fee schedule is not hardcoded — it's data.** Tiers live in the `platform_fees` table, fully editable in admin (add / edit / deactivate / per-vendor override). `computeFee` reads whatever active rows exist; it never assumes a fixed scheme. Current live config:

| Deal price | Gloē fee |
|---|---|
| $0–$500 | 20% |
| $500+ | flat $60 |

> The active sub-$500 tier currently starts at **$0** (label reads "$100–$499" but `min_cents=0`), so deals under $100 also pay 20%. A setting, not a bug — change it in admin. If `computeFee` finds no matching active tier, it falls back to a safe 12%.

- **Per-vendor override:** a `vendor_id`-scoped tier beats the global one (`ORDER BY is_override DESC`). Forward-only; historical bookings frozen via `platform_fee_snapshot` JSON on `transactions`.
- **Instant payout** is a Stripe Connect pricing scheme (3%) auto-applied to every Instant Payout under the platform. Full money mechanics in §4.

---

## 3. Architecture

### 💼 The pitch

Three apps — a consumer iPhone app, a vendor website, and an admin "god mode" — all talking to **one brain** (the API) and **one database**. The API decides what *should* happen; Stripe confirms what *did*; webhooks keep the two honest. It's a deliberately boring, proven, type-safe stack chosen so a **solo founder can run the whole business reliably** — not a science project. The whole thing is one codebase (a monorepo), so a change to a rule shows up everywhere at once.

### 🔧 Under the hood

### Mental model

Two-sided marketplace. Three frontends. One API. One DB. The API knows what *should* happen, Stripe knows what *did* — webhooks reconcile.

### Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Backend language | TypeScript | Type-safety end-to-end with mobile + web |
| API framework | Hono | Light, fast, edge-ready if we need it |
| Type-safe RPC | tRPC | One source of truth for inputs/outputs |
| Database | Postgres (Supabase) | PostGIS for geo, RLS for auth-at-DB |
| Mobile | Expo (React Native) | iOS-first; dev-client (not Expo Go) due to native modules |
| Web | Next.js (App Router) | Shared with mobile via packages/ |
| UI | Tamagui | Same primitives mobile + web |
| Auth | Clerk | Email/Apple/Google + 2FA, hosted |
| Payments | Stripe Connect (Express) | KYC, payouts, 1099-K all handled |
| Push | APNs direct (HTTP/2 + JWT) | No Expo push proxy in the loop |
| Deploy | Railway | API + web; envs in dashboard |
| Storage | Supabase Storage | Photos + videos; pre-signed uploads |

### Repo layout

```
GlowApp/
├─ apps/
│  ├─ mobile/         Expo iOS consumer app
│  ├─ web/            Next.js (vendor portal + admin)
│  └─ api/            Hono + tRPC
└─ packages/
   ├─ api-client/     tRPC client + shared types
   ├─ ui/             Tamagui tokens + components
   └─ ui/brand/       Wordmark, brand font (canonical)
```

### API domain modules (`apps/api/src/domain/`)

| File | Purpose |
|---|---|
| `admin.ts` | God mode queries — vendor roster, deal review, payout release, audit. |
| `apns.ts` | Apple Push Notifications. ES256 JWT, per-topic (app vs pass), token mgmt. |
| `audit.ts` | Audit log writer. Every money + vendor action logged. |
| `checkout.ts` | `createPurchase()` — validates deal/variant, computes fee, creates PaymentIntent, records pending txn. |
| `claims.ts` | Voucher lifecycle — create on payment, redeem on scan, expire on cron. Snapshot freeze. QR + human code. |
| `dealCreate.ts` | Deal + variant + photo + video insert. Draft vs. pending_review. |
| `dealMap.ts` | Google Static Maps cache for redemption location. |
| `deals.ts` | Deal queries — list, search, filter, expire elapsed. Drive-time estimate via straight-line + tiered mph. |
| `devices.ts` | Device token store. Upsert on launch, delete on APNs 410. |
| `fees.ts` | Platform fee tier logic. Per-vendor override. |
| `googleMaps.ts` | Places autocomplete + place details. |
| `payouts.ts` | `releaseTransferForClaim()` — 11 routing walls before sending vendor share. Instant payout eligibility. |
| `payoutWebhooks.ts` | Stripe payout.* webhook handler. Mirrors to payouts table. |
| `reviews.ts` | Deal reviews — list, create, vendor response. |
| `saved.ts` | Saved deals + vendors. |
| `stripe.ts` | Single seam to Stripe SDK. PaymentIntent, Transfer, Checkout, Connect onboarding. |
| `vendorHub.ts` | Vendor dashboard data — sold today, redeemed, held balance, etc. |
| `vendorOps.ts` | Vendor lifecycle — refund txn, wind-down vendor, reverse transfers. |
| `vendorSignup.ts` | Vendor creation + Stripe account ID + tier. |
| `vendorStorefront.ts` | Public vendor profile + storefront feed. |
| `vendorStripe.ts` | Stripe onboarding + dashboard link generation. |
| `walletPass.ts` | Apple Wallet pass generation. PassKit signing. |
| `walletPassArt.ts` | Dynamic pass background art. |

### Why no microservices

Single Node API + direct SQL for dashboards + webhooks direct to DB + polling for "live" UIs + one repo. When each breaks: add a load balancer, materialize views, buffer to a queue, switch to WebSockets, enforce ownership instead of splitting.

---

## 4. The money pipeline

### 💼 The pitch

How money actually moves, in plain English: the customer pays Gloē up front; we **hold** the cash; when she actually shows up and **redeems**, we release the vendor's share (minus our fee) to their Stripe account, and Stripe pays it to their bank. The vendor only gets paid for **real, completed** bookings — that's the entire promise, and it's also our fraud protection. We never touch raw card details (Stripe does), and the API and Stripe webhooks constantly cross-check each other so money can't silently go missing.

### 🔧 Under the hood

### TL;DR — four stages

1. **Charge.** Customer pays $200 → lands on Gloē's platform balance (PaymentIntent, no `transfer_data`).
2. **Transfer.** Customer redeems → Gloē moves $160 to vendor's Connect account (Stripe Transfer). *(20% fee = $40 stays on platform; at current live rates.)*
3. **Payout.** Stripe runs daily ACH → vendor bank gets $160 in 1–2 days. Free.
3'. **Instant payout** *(optional).* Vendor taps "pay me now" → ~30 min to debit card. 3% fee taken by Stripe pricing scheme; Gloē nets ~2%.

### Stage 1 — Charge

```
PaymentIntent.create({
  amount: 20000,           // $200 in cents
  // NO transfer_data — money stays on Gloē's balance
  metadata: { dealId, variantId, vendorId, userId, quantity }
})
```

- `transactions` row inserted with `status='pending_payment'`, fee snapshot frozen as JSON.
- Webhook `payment_intent.succeeded` flips to `paid` + fires `fulfillPurchase()` → creates N claims (one per voucher).

### Stage 2 — Transfer (on redemption)

```
releaseTransferForClaim(claimId)
  ├─ wall: claim exists + status='redeemed'
  ├─ wall: txn exists + status='paid'
  ├─ wall: vendor stripe_account_status='active'
  ├─ wall: caller is vendor (auth) — NEVER trust caller's vendor_id
  ├─ wall: idempotency key
  ├─ wall: sanity cap ($1K auto-routes to review on launch)
  └─ Transfer.create({ amount: vendor_payout_cents, destination: vendor.stripe_account_id })
```

- Stripe knows nothing about the platform fee — we just transfer less.
- Transfer is idempotent at Stripe layer via key `transfer_for_claim_${claimId}`.
- Transaction.stripe_transfer_id set; audit log written.
- Default: auto-release with 24h hold (tunable per vendor). Manual review mode for first ~50 live redemptions before flipping global auto.

### Stage 3 — Standard payout

- Stripe runs scheduled ACH (vendor's chosen `payout_schedule`).
- Webhooks fire: `payout.created` → `payout.paid` (or `payout.failed`).
- `payoutWebhooks.ts` mirrors to our `payouts` table. Idempotent via `stripe_payout_id` unique.
- Gloē **does not trigger** standard payouts. Stripe owns the cadence.

### Stage 3' — Instant payout

- Vendor taps "Pay me now." Eligibility: `payouts_enabled=true` + debit card on file.
- `createInstantPayout()` calls Stripe with `method='instant'`.
- Stripe deducts 3% **application fee** (configured as pricing scheme in Stripe Dashboard).
- Stripe's cost ~1%, so Gloē nets ~2%.
- Same payout webhook handlers as standard.

### Refunds

**Pre-redemption (simple):**
- Admin clicks Refund → `refundPaymentIntent()` → money goes back to customer's card.
- Vendor was never paid; no clawback needed.
- Claim flips to `cancelled`.

**Post-redemption (hard, requires vendor consent):**
- `reverseTransferForClaim()` → `transfers.createReversal()` on the Stripe Transfer.
- Then `refundPaymentIntent()` on the original charge.
- Vendor's connected-account balance debited; we should not do this without their signed agreement.

### Disputes & chargebacks (PLANNED — not yet built as of 2026-05-29)

**Status: no dispute webhook exists today.** `charge.dispute.created` is not handled. If a customer disputes via their bank right now, Stripe pulls the funds back automatically but our DB never learns of it — the transaction stays `paid` and the claim stays redeemable. The word "disputed" appears only as a filter option in admin (`admin.ts`), backed by nothing. This needs to ship before real volume.

**Pre-redemption dispute (the common, easy case).** Money is still on Gloē's platform balance — no Transfer has fired yet, vendor hasn't been paid. The fix is mostly bookkeeping + a wall:

1. **Webhook** — add `charge.dispute.created` (and `charge.dispute.closed`) to the Stripe webhook handler. Register the events in both test and live endpoints.
2. **Freeze the claim** — on dispute open, flip the claim to a non-redeemable state (`cancelled`, or a new `disputed` status) so it **cannot be redeemed while the dispute is open**. This is the critical move: it blocks any future Transfer.
3. **Mark the transaction** — set `transactions.status='disputed'`, snapshot the Stripe dispute id.
4. **New wall #12** — `releaseTransferForClaim()` must refuse if the transaction has an open dispute. (Belt-and-suspenders: even if a claim somehow stays active, the transfer won't fire.)
5. **On dispute won/lost (`charge.dispute.closed`)** — reconcile: if won, the claim can be reactivated (or left cancelled per policy); if lost, funds are already gone, close out the transaction as `refunded`/charged-back and audit-log it.

**Post-redemption dispute (the hard case).** Vendor was already paid via Transfer. This is the same shape as a post-redemption refund — needs the existing `reverseTransferForClaim()` clawback against the vendor's connected-account balance, which can go negative. Requires the vendor agreement language in ToS (marketplace facilitator / chargeback-liability clause). Treat as a manual admin action at launch, automate later.

**Build order:** ship the pre-redemption path (webhook + freeze + wall #12) before first real customers; the post-redemption clawback can stay manual initially.

### Reconciliation

- `reconcileVendorTransfers()` (admin router) queries Stripe transfers and diffs against our DB. Manually triggered today; cron-friendly.
- Run nightly once live volume justifies.

### State machines

```
transactions:    pending_payment → paid → released  →  refunded  or  partially_refunded
                                       ↘ (vendor never onboarded → stays paid, money held)
                                       ↘ disputed   (PLANNED: charge.dispute.created)

claims:          active → redeemed   →  (transfer fires)
                       ↘ expired   (cron, past expires_at)
                       ↘ cancelled (refund pre-redemption, OR PLANNED: dispute freeze)

payouts:         pending → paid
                        ↘ failed
                        ↘ cancelled
```

### Walls (every transfer passes all)

1. Auth — caller must be vendor owner OR admin
2. Routing — derive vendor account server-side, never trust input
3. Claim status — must be `redeemed`
4. Transaction status — must be `paid`
5. Vendor Stripe status — must be `active`
6. Idempotency — Stripe key `transfer_for_claim_${claimId}`
7. Sanity cap — $1K+ auto-routes to admin review at launch (remove later)
8. Hold window — default 24h post-redemption (per-vendor tunable)
9. Vendor not suspended
10. Stripe account `payouts_enabled=true`
11. License on file (manual today)
12. No open dispute on the transaction (**PLANNED** — ships with the dispute webhook above)

---

## 5. Database schema

### 💼 The pitch

The single source of record for the whole business — every vendor and customer, every deal, every voucher, every dollar in and out. It's Postgres (battle-tested), with **geography built in** (so "deals near me" is fast and exact) and **security enforced at the database itself** — a customer literally cannot query another customer's data even if the app had a bug. Boring and bulletproof on purpose; this is the money layer.

### 🔧 Under the hood

All tables in Supabase Postgres. PostGIS extension on. RLS enabled (auth at DB layer).

### Core tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Consumer accounts (Clerk-backed) | clerk_user_id, email, phone, name, deleted_at (soft-delete tombstone for account deletion) |
| `vendors` | Practice accounts | id, owner_user_id, business_name, stripe_account_id, stripe_account_status, auto_release_on_redemption, suspended, percentage_fee_override |
| `deals` | Listings | id, vendor_id, title, description, status (draft/pending_review/active/expired), category_id, secondary_category_id, redemption_address, redemption_lat/lng, fine_print, restrictions |
| `deal_variants` | Per-deal options | deal_id, label, unit_count, unit_label, original_price_cents, deal_price_cents, spots_total, spots_claimed |
| `deal_photos` | Deal imagery | deal_id, url, display_order |
| `deal_videos` | Deal video | deal_id, url, thumbnail_url, caption, duration_seconds |
| `claims` | Vouchers | id, user_id, deal_id, variant_id, vendor_id, status (active/redeemed/expired/cancelled), qr_payload, human_code, expires_at, redeemed_at, snapshot (frozen metadata JSON) |
| `transactions` | Money records | id, vendor_id, user_id, consumer_paid_cents, vendor_payout_cents, platform_fee_cents, status, stripe_payment_intent_id, stripe_transfer_id, platform_fee_snapshot (JSON) |
| `payouts` | Stripe payouts mirror | id, vendor_id, stripe_payout_id, amount_cents, status, arrival_estimate_at, arrived_at, failure_message |
| `platform_fees` | Fee tiers (admin-editable) | label, min_cents, max_cents, percent_bps, flat_cents, min_fee_cents, vendor_id (null=global, set=override), active |
| `device_tokens` | iOS push targets | user_id, platform, token, last_seen_at |
| `pass_registrations` | Apple Wallet pass devices | device_library_identifier, pass_type_identifier, serial_number (=claim.id), push_token, authentication_token |
| `audit_log` | Every mutation | action, actor_id, resource_ids (JSON), meta (JSON), created_at |
| `reviews` | Deal reviews | id, deal_id, author_id, rating, comment, vendor_response |
| `review_photos` | Review imagery | review_id, url, display_order |
| `saved_deals` | Favorited deals | user_id, deal_id |
| `saved_vendors` | Favorited vendors | user_id, vendor_id |
| `categories` | Service taxonomy | slug, label, description, icon, parent_id |
| `support_tickets` | Concierge cases (consumer ↔ Gloē) | id, user_id, subject, category, status (open/awaiting_us/awaiting_customer/resolved/closed), last_message_at, resolved_at |
| `support_messages` | Ticket thread messages | id, ticket_id, sender_type (customer/agent/system), sender_user_id, body, read_at |
| `support_message_attachments` | Photo/video on a message | id, message_id, kind (image/video), url, thumbnail_url, width, height, display_order |
| `region_waitlist` | Out-of-area demand capture | email (unique), city_label, lat, lng |
| `message_threads` / `messages` | **DEAD** — vendor↔consumer scaffolding, 0 rows, unused. Not the support tables. |

### Storage buckets (Supabase Storage, public)

`deal-photos`, `deal-videos`, `deal-maps`, `review-photos`, `support-attachments`, `org-assets`. Signed uploads via `createSignedUpload(ownerId, fileExt, kind)` in `db/storage.ts` — the `BUCKETS` map keys: photo/video/review/support. Public URLs stored on the row; paths are unguessable UUIDs.

### Migration tracking

The full schema history (38 migrations from the `drop_all_legacy_tables` reset forward) is tracked in `supabase/migrations/`. **Going forward, every schema change gets a file there in the same PR.** Note: the latest tables (`support_*`, `region_waitlist`, `users.deleted_at`) were applied directly via the Supabase MCP and are live, but a few of those migration files may still need backfilling into `supabase/migrations/` — verify before relying on a from-zero rebuild.

### Service taxonomy categories (14)

1. Neuromodulators (Botox, Dysport, Xeomin)
2. Dermal fillers
3. Skin treatments (laser, peels, microneedling, hydrafacial)
4. Body contouring (CoolSculpting, Emsculpt)
5. Hair removal & restoration
6. Massage & spa
7. IV therapy & wellness drips
8. Facials & skincare services
9. Vitamin / B12 shots
10. Cosmetic dentistry (whitening, veneers)
11. Lashes & brows
12. PRP / microneedling combos
13. Vaginal rejuvenation
14. Concierge / mobile aesthetic

Hierarchical, editable in admin without code change.

---

## 6. Consumer app

### 💼 The pitch

The iPhone app a customer actually uses: **find** a deal (Discover + Search), **save** favorites, **buy and store** her voucher (Wallet), and manage her account + reach support (Profile). Designed to feel premium and get a first-timer from "curious about Botox" to "booked" in well under a minute. Individual features have their own deep-dives — §6A search, §6B pay, §6C Apple Wallet, §6D notifications, §6E the tab bar.

### 🔧 Under the hood

### Tabs

| Tab | Status | Purpose |
|---|---|---|
| Discover | Shipped | Feed of deals near you. Category rail, featured carousel, filter pills. |
| Map | **Not built** | Removed from nav. Future addition for v1.1. |
| Saved | Shipped | Bookmarked deals + vendors. Segmented control. |
| Wallet | Shipped | Active vouchers, past claims, soonest-expiring hero, credit balance (stub at $0). |
| Profile | Shipped | Account settings, sign out. Delete account = **stub**. |

### Key flows

**Onboarding (3 screens max):**
- Splash → location ask (contextual, on first "Near me" tap, not cold) → optional sign-in. No paywall.
- Anonymous browse OK. Sign-in required only at claim time.

**Deal detail flow:**
- `app/(app)/deal/[id].tsx`
- Hero image, vendor card, variant picker, reviews, redemption map, restrictions, fine print
- "Claim" CTA → Stripe payment sheet → success → voucher screen.

**Voucher screen (`my-deal/[id].tsx`):**
- Three visual states: active, redeemed, expired.
- QR code (generated client-side via `react-native-qrcode-svg`), human-readable 6-digit code, expires countdown.
- Vendor live info fetched fresh (phone, address).
- "Add to Apple Wallet" badge.
- Share button (sends gift link via `createGiftLink`).
- **Redemption is vendor-only.** The customer screen only *displays* the QR + code; the vendor scans/enters it in their scanner to redeem. There is no consumer self-redeem button or mutation — a "Simulate redemption" button + the `devMarkRedeemed` path were removed 2026-05-29 because they could fire a payout with no one showing up.

**Search:** ✅ **Built** — `app/(app)/search.tsx` is the live fuzzy/synonym-aware search; `deals.search` / `deals.suggest` / `deals.trending` / `deals.detectSubtype` / `deals.categoryTreatments` back it. Full breakdown in **§6A**.

**Out-of-area ("coming soon") gate:**
- We launch in LA / Orange County / San Diego. When a user's resolved location has **zero deals within 50mi** (GPS resolved, no category/filter active), Discover shows `ComingSoon` instead of an empty grid.
- The gate is **data-driven, not a hardcoded boundary**: the moment a new city gets its first live deal, the next nearby user sees a feed automatically — no deploy, no flag. "The listing unlocks the gate."
- The screen lists the cities that are **actually live** (`waitlist.liveCities` → distinct cities with active deals), so the "Now live in …" copy is never stale even with multiple cities open.
- Email capture (`waitlist.join`, public) stores `{email, city_label, lat, lng}` in `region_waitlist` (upsert on email). No notification fires yet — this is demand collection. Admin god-mode **Waitlist** tab (`WaitlistView`) shows demand ranked by city = the expansion roadmap. "Browse SoCal deals" escape hatch lets out-of-area users into the SD-default feed anyway.

**In-app support tickets (consumer ↔ Gloē):**
- Profile → Help & support opens `support/cases.tsx` (list of cases + new request) → `support/[id].tsx` (chat thread). Customer opens a case, sees ongoing cases in chat format, replies inline.
- Backend: `support_tickets` + `support_messages` tables (purpose-built — NOT the dead vendor-shaped `message_threads`). 5-state machine: `open → awaiting_us → awaiting_customer → resolved → closed`. `domain/supportTickets.ts` (consumer, all `userId`-scoped, IDOR-guarded) + `support.router.ts`.
- God mode: **Support** tab (`SupportView.tsx`) lists tickets `awaiting_us`-first (triage queue) with a reply drawer. Agent reply is the ONLY place an APNs push fires (`createAgentReply` in `admin.ts` → `sendApnsPushToUser`, fire-and-forget, `data:{type:'support_reply',ticketId}` read flat on device).
- Push-on-reply + a **permission-aware** caption above the composer: "You can close the app — we'll notify you the moment we reply" (granted) vs a "turn on notifications" prompt (denied). Notification tap deep-links to the thread via a listener in `usePushRegistration.ts`.
- **v1 is in-app + push only.** No email (inbound or outbound) — deferred; it's a zero-rework bolt-on (`domain/email.ts` via Resend) once gloe.app DNS is set. Account deletion CASCADEs tickets+messages (PII).
- Also fixed in this work: `device_tokens` RLS was DISABLED (a pre-existing hole) — now enabled with owner policies.

**Concierge attachments (photos + videos):**
- Customers attach images/videos to any support message — via **camera** or **library**, chosen from a branded bottom sheet (`AttachmentSheet.tsx`, not the dated `ActionSheetIOS`). `useSupportUpload.ts` handles pick/capture → signed upload → public URL.
- Rendered inline in the mobile chat (`MessageAttachments.tsx`, images tappable to full-screen, videos with play) AND in god mode (`SupportView.tsx` renders consumer media; admin reply is text-only for v1).
- Backend: `support_message_attachments` table + `support-attachments` bucket. `support.signAttachmentUpload` (consumer) + `admin.signSupportAttachmentUpload` (god mode). `create`/`reply` accept an `attachments[]`; a body-or-attachment refine lets a photo-only message through.
- iOS: `NSPhotoLibraryUsageDescription` + `NSCameraUsageDescription` + `NSMicrophoneUsageDescription` in Info.plist (the missing photo key was hard-crashing the picker).
- **Watch-out:** the batched attachment fetch uses `ANY(...)::uuid[]` — the `::uuid[]` cast is required (postgres.js `sql.array()` yields `text[]`; without the cast the query throws and the router masked it as a bogus NOT_FOUND/"couldn't open conversation"). The getCase catch now surfaces non-NOT_FOUND errors as 500 instead of hiding them.

### Account deletion (Apple 5.1.1(v)) — SHIPPED

`me.deleteAccount` (`domain/account.ts`). **Anonymize-and-deactivate, not hard delete** — `transactions.user_id` is FK-RESTRICT, so financial/tax records must survive. It: deletes the Clerk identity → scrubs PII → tombstones `clerk_user_id` (`deleted:<uuid>`) → sets `users.deleted_at`. CASCADE FKs (claims, saves, reviews, devices, support) drop automatically. UI is a tucked-away destructive link at the bottom of Profile (not a big button), double-confirmed.

### Image caching (expo-image) — SHIPPED

Every **remote** photo across the app renders through `CachedImage` (`features/image/CachedImage.tsx`, wraps `expo-image` with `memory-disk` cache + 200ms fade). Replaced raw RN `<Image>` in ~15 files (deal cards, hero, vendor storefront, vouchers, reviews, checkout, profile avatar). `prefetchImages()` warms photos before they scroll into view. Local `require()` assets (e.g. the Apple Wallet badge) stay on raw `<Image>`. Native dep → needs a rebuild to activate.

### Prefetch / preload layer — SHIPPED

`usePrefetch()` warms a screen's data on `onPressIn` (fires ~80–150ms before nav, lands inside the 30s staleTime window → cache hit, no spinner): deal detail on card press, vendor on the vendor row, support thread on the active-case card. `BootWarmup` warms categories at launch; `ClaimedDealsProvider` warms active vouchers' data + images. Discipline: press-in only, never on scroll (don't spam 50 requests browsing the feed).

### Native modules in use

`@stripe/stripe-react-native`, `react-native-maps`, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-svg`, `react-native-passkit-wallet`, `react-native-qrcode-svg`.

Means we need a **dev-client build** (not Expo Go). Rebuild via `npx expo run:ios` whenever a native module changes or `Info.plist` changes.

### iOS gotchas baked in

- `NSLocalNetworkUsageDescription` in Info.plist — required for physical-device LAN connections to the dev API (added 2026-05-23).
- API URL auto-resolved at runtime from `Constants.expoConfig?.hostUri` so one bundle works for sim + device.
- Stale Metro host on iPhone (white screen, no Metro fetches) = rebuild via `npx expo run:ios --device`. Don't diagnose.

---

## 6A. Search & discovery engine

### 💼 The pitch

Type what you want — even misspelled ("botx") or in slang ("tox", "skinny shot") — and get the best matching deals **near you, instantly.** It understands aesthetic treatments the way patients actually talk about them, not just exact keywords. That's the difference between an app people search once, get nothing, and abandon — and one they actually use to find things. Built to feel like DoorDash/Groupon search, on infrastructure we already had.

### 🔧 Under the hood

DoorDash/Groupon-grade search, built on Postgres — **no Elasticsearch, no Algolia, no new infra**. The whole thing is one ranked query plus a domain brain. Shipped 2026-06-01.

### The one idea

**Search and filters are the same query.** There is no separate search code path — `listDeals` (`apps/api/src/domain/deals.ts`) is the single ranked engine, and search is just that engine with a text-relevance term folded into the blended score. Discover, category filter, treatment drill-down, and the search box all call the same function with different args.

### How a query becomes results

```
"botx"  ─┬─► expandQuery()  ──►  ["botx"]                    (typo: trigram saves it)
"tox"   ─┼─► expandQuery()  ──►  ["tox","botox","dysport",   (slang: synonym layer)
         │                        "jeuveau","xeomin","daxxify"]
"ozempic"┴─► expandQuery()  ──►  ["ozempic","semaglutide",   (brand→generic)
                                  "tirzepatide","weight loss"]
                                         │
                                         ▼
              SQL: pg_trgm word_similarity + substring, across
              deal title · vendor name · category · subtype
                                         │
                                         ▼
        relevance folded into the blended ranking score:
        text-match·5 + hard-match·3 + sponsored + rating − distance + recency
```

**Two layers do the magic:**

1. **Fuzzy (pg_trgm).** `word_similarity` over title/vendor/category/subtype with GIN trigram indexes (migration `20260601120000_search_trigram_indexes`). Typos resolve: "botx"→botox (0.60), "filer"→filler, "microneedeling"→microneedling. Floor at `SEARCH_SIM_THRESHOLD = 0.4` — below that, only exact/substring ("hard") matches survive, so junk → empty.
2. **Synonyms (`aestheticSynonyms.ts`).** Curated aesthetic slang/brand → treatment map a generic engine could never know: "tox"→every neuromodulator, "skinny shot"/"ozempic"→semaglutide, "fat freeze"→CoolSculpting, "vampire facial"→microneedling+PRP. Category catch-alls deliberately stripped so "tox" stays specific (neuromodulators), not all-injectables.

Ranking lives in `listDeals`' blended score: a strong text match dominates, but distance/rating/recency still tie-break — a great match nearby beats an equally-great one across town. Sponsored boost is **halved during search** so paid placement can't bury a better match.

### Endpoints (`deals.*`)

| Endpoint | What it does |
|---|---|
| `deals.list` | The feed. Now also takes `subtypeSlug` (treatment drill-down). |
| `deals.search` | `q` + all filters + `sort`. Fuzzy + synonym + ranked. |
| `deals.suggest` | Type-ahead autocomplete — treatments matching the partial query, inventory-ranked. |
| `deals.trending` | "Popular near you" — treatments with the most nearby deals (inventory-based; swap to real search/purchase counts once logged). |
| `deals.categoryTreatments` | Treatments under a category with **≥2 nearby deals** — powers the inventory-gated drill-down pills. |
| `deals.detectSubtype` | **Reverse** of the synonym engine: title → treatment, for vendor auto-tagging. |

**Filters/sort** (all on the one engine): `subtypeSlug`, `minRating`, price range, min-discount, distance, and `sort` ∈ relevance / distance / price / rating / discount.

### Treatment auto-tagging (vendor side)

The taxonomy is **7 categories → 42 treatment subtypes** (Botox, Dysport, Juvederm, Sculptra, Semaglutide…). For search to know "this deal is Botox," the deal must carry `subtype_id`. The post-deal form captures it **without overwhelming the vendor**:

- `detectTreatment(title, subtypes, categorySlug)` reads the title as they type and returns the implied treatment + confidence. **Brand names auto-fill** ("Botox — first-timer" → ✓ Botox); **generic words suggest** ("lip filler" → "Looks like Dermal Filler?"). Category-scoped so names under two categories (Laser Hair Removal) disambiguate.
- Vendor sees **one chip**, not 12. "Change" reveals only that category's treatments. Fully optional; detection never overrides a manual/edit choice.

### Customer drill-down (inventory-gated)

Pills are the **7 categories** by default. Tap one → an optional second row of **treatment** sub-pills appears — but only treatments with **≥2 nearby deals** (`TreatmentPills` renders nothing below that). Cold-start safe: with thin inventory there's no drill row (no dead-ends "showing nothing but one"); as vendors are added and treatments cross the floor, the row lights up **on its own, same code**. Drilling is always opt-in — a leading "All" pill keeps the whole category.

### Search screen (`apps/mobile/app/(app)/search.tsx`)

Debounced (180ms) instant results · autocomplete suggestion chips while typing · idle state = recent searches (SecureStore) + "popular near you" · **zero results never dead-ends** (suggests popular nearby treatments) · compact result rows (resized thumbs, price/discount, vendor·rating·distance) with save + prefetch tap-through.

### Map discovery (`apps/mobile/app/(app)/map.tsx`, GLO-25)

ResortPass-style full-screen map, reached via the **square brand-colored map button** to the right of the discover search bar (`features/discover-header/MapButton.tsx`; the search bar itself is now square-cornered to match). iOS-first — Android is a deliberate fast-follow.

- Opens centered on the user's current browse location ("Near you") from `SelectedLocationProvider`.
- **Static top chrome** (3 rows): location bar · **scrollable service pills** (All / Injectables / Skin / … — reuses `FilterPills` / `useCategoryOptions`, same DB taxonomy) · **filter chip row** `MapFilterChips` (Filter · Vibe · Price · Rating · Sort). Every chip opens `MapFilterSheet` focused on its section; all map 1:1 onto `deals.list` inputs (`mapFilters.ts`), so applying is a spread. Vibe/rating/sort/price are **fully wired**, not stubs.
- **One teal pin per spa** (`groupDealsBySpa` collapses the deal list to vendors; GLO-25 decision = card-per-spa, not per-deal). Pins **cluster** when zoomed out via a dependency-free grid bucketer (`clustering.ts`) — no supercluster lib. The active spa's pin darkens to ink.
- **Three-detent bottom sheet** (`MapBrowseSheet`, RN core Animated + PanResponder, no sheet/gesture dep): **collapsed** = map + swipeable cards; **mid** = cards crossfade out, sheet rises to ~45% with the vertical listing and a map peek above; **full** = map gone, straight scrollable listing under the pinned header. One `Animated.Value` (the sheet's top) drives the snap + the card↔list opacity crossfade.
- **Swipeable cards** (`MapDealCard.tsx`) two-way synced to the pins: swiping a card centers + highlights its pin; tapping a pin collapses the sheet and scrolls its card into view. A card shows the spa's headline deal + vibe + "+N more experiences" (routes to the vendor storefront when the spa has several).
- **"Search this area"** pill appears after panning and re-queries `deals.list` using the visible map center + a radius derived from the region span — **no backend change** (vendor lat/lng already ride on every deal).

**Vibes** (the spa's "feel" — a real aesthetics-purchase driver): a `vibes` jsonb array on `vendors` (mirrors `amenities` — `apps/api/src/domain/vibes.ts` canonical list, GIN-indexed, migration `20260606200000_add_vendor_vibes`). Vendors self-select 1–3 in the Post-Deal form (`VibePicker`); shown on the consumer storefront; filtered on the map via `deals.list`'s `vibes` input (`v.vibes ?| array[...]`). `deals.list` also gained `minRating` + `sort` inputs (already supported by `listDeals`, just newly exposed) to power the Rating + Sort chips. Seeded vibes backfilled for the demo spas.

### Why it scales (and won't hurt us later)

Everything is **data-driven + adaptive + human-confirmed**, nothing cemented to "4 deals in San Diego":
- Taxonomy = DB rows. Add "Kybella" = one INSERT → it shows in search, pills, and the detector instantly.
- Drill-downs gate on **live counts** — embarrassing-at-4-deals (hides depth), great-at-4,000 (reveals it), zero code change.
- Synonym/alias maps are additive and degrade gracefully (a missing alias just falls back to fuzzy).
- Relevance is abstracted in the ranking → swapping pg_trgm for **Algolia / pgvector semantic / ML learning-to-rank** later is a layer swap, not a rewrite.

**The one future-proofing TODO:** search/click logging (the data flywheel). Cheap now, it's what powers real "trending," learned synonyms, and ML ranking once there's traffic. Not yet wired — the deliberate "invest now, win later" piece.

---

## 6B. Claim, pay & "Share to pay"

### 💼 The pitch

A customer finds a deal and buys a voucher in **seconds** — Apple Pay or card, right in the app, no account-funding or wallet top-up. If she'd rather **someone else pay** (her mom, her partner), she taps **"Share to pay,"** texts a link, and whoever opens it pays — but the voucher still lands in **her** account. We never hold inventory or take payment risk; Stripe runs the charge and we orchestrate. **We make money on a platform fee taken out of each sale** (see §2). The voucher only exists once money clears, so there's no "paid but no voucher" or "voucher but no money" state.

### 🔧 Under the hood

`apps/api/src/domain/checkout.ts` + `checkout.router.ts`. Two entry points, one fulfillment path:

- **In-app purchase** — `checkout.createPurchase`. Computes the fee on the order total (`computeFee`), creates a **held Stripe PaymentIntent**, writes a `pending_payment` row in `transactions`, returns the `clientSecret` → the app's Stripe **PaymentSheet** (Apple Pay + card). Vouchers (`claims`) are minted **only** on the `payment_intent.succeeded` webhook — one per quantity — so an unpaid order never yields a live voucher.
- **Share to pay** — `checkout.createGiftLink`. Creates a Stripe **Checkout Session** (Stripe-hosted page) and returns a Gloē URL (`PUBLIC_WEB_ORIGIN`). Any cardholder pays on that page; the voucher credits to the **redeemer** (`metadata.userId`), not the payer. Hard **$500/link cap** (`GIFT_LINK_MAX_AMOUNT_CENTS`) bounds fraud blast-radius since cardholder ≠ redeemer. Tagged `payment_source='gift_link'`.
- Both converge on `fulfillPurchase` (resolved from the webhook by PaymentIntent id or Checkout Session id), which mints the vouchers. The full money flow — fee tiers, held funds, transfer on redemption — is **§4**.

---

## 6C. Apple Wallet passes

### 💼 The pitch

After buying, the customer adds her voucher to **Apple Wallet** with one tap — so it lives on her lock screen and she can redeem at the counter **without even opening the app**. It feels premium and legitimate (like an airline boarding pass), and it keeps Gloē present on her phone between visits. A small thing that makes the whole product feel real.

### 🔧 Under the hood

`apps/api/src/domain/walletPass.ts` (`buildVoucherPass`) builds a **signed `.pkpass`** with `passkit-generator`: Apple **`coupon`** layout, `serialNumber = claim.id`, a QR barcode carrying the redemption payload. Signed with the Pass Type ID cert (`signerCert.pem` + `signerKey.pem` + WWDR), loaded from `secrets/` locally or base64 env vars in prod (see §11 Phase 4). Mobile: `features/wallet/AddToWalletBadge.tsx` renders the official Add-to-Apple-Wallet button and hands the pass to PassKit.

**Live updates** (flipping the pass to "Redeemed" automatically) need the APNs **Pass Web Service** — the `pass_registrations` schema exists, the wiring is pending. Not a launch blocker. See §10.

---

## 6D. Push notifications

### 💼 The pitch

Gloē pings the customer **when it matters** — a reply from support, a voucher about to expire, a redemption confirmation. That's what brings people back and builds trust that the app is "alive." We ask for permission **contextually** (after her first save or purchase, not on a cold launch) — the difference between ~60–80% opt-in and ~20%.

### 🔧 Under the hood

**Direct APNs** (no Expo push middleman): ES256 JWT auth with the `.p8` key (`apps/api/src/domain/apns.ts`). Device tokens are registered by `features/notifications/PushRegistrationBridge.tsx` + `usePushRegistration.ts` → stored in the `devices` table (`devices.ts` / `devices.router.ts`). A `410 Gone` from APNs prunes the dead token. Fired on events like a support agent reply (§8). Capability + entitlement notes are in §11.

---

## 6E. App shell & bottom navigation

### 💼 The pitch

**Four tabs, the whole app:** **Discover** (find deals), **Saved** (your shortlist), **Wallet** (your vouchers + the QR to redeem), **Profile** (account, support, settings). Simple enough that a first-timer understands the entire product in five seconds — which is the point. iPhone-only for v1 (iPad is a roadmap item).

### 🔧 Under the hood

`apps/mobile/app/(app)/(tabs)/_layout.tsx` — Expo Router `Tabs`, four screens (`discover`, `saved`, `wallet`, `profile`), icons via `features/tabs/TabIcon.tsx`, brand-tinted active state. The **Wallet tab** (`wallet.tsx`) is the voucher home: active vouchers sorted soonest-to-expire, a hero treatment for the most-urgent one, tap → `/my-deal/[id]` for the full-screen QR. (This tab replaced the old "messages" tab — see git history.)

---

## 7. Vendor portal

### 💼 The pitch

Where a medspa runs its Gloē presence: sign up, get approved, **post deals** (auto-tagged by treatment), **scan customers' QR codes** to redeem, and **get paid**. Free to join, no monthly fee — the whole reason vendors say yes instead of burning $1k/mo on Instagram ads. Built as a website (not an app) because owners and front-desk staff live on a laptop at the counter.

### 🔧 Under the hood

`apps/web/src/app/vendor` (Next.js).

### Screens shipped

| Screen | What it does |
|---|---|
| Signup | Business name, phone, address (Places autocomplete), categories. Creates vendor + Stripe Express account. |
| Dashboard | Hub snapshot: sold today, redeemed today, active vouchers, held balance, 7d paid, in-transit, failed payout count. |
| Stripe balance widget | Real-time Stripe `available` + `pending` balances. Separate query from hub snapshot. |
| Post Deal | Full form — title, description, variants, photos, video upload, amenities, **vibe (1–3)**, 1–2 categories, restrictions, fine print. Draft or submit for review. |
| Scan tab | Live QR camera (html5-qrcode) + manual code input fallback. Lookup → confirm → redeem. Blocked until Stripe onboarding done. |
| Stripe Connect onboarding | Generates hosted Express onboarding link. Status mirrored back via webhook. |
| Instant payout | "Pay me now" button. Eligibility: payouts_enabled + debit card. ~30 min arrival, 3% fee. |

### Vendor edit flow

`updateDeal` mutation exists. Edit UI shipped but not feature-flagged separately.

---

## 8. Admin (god mode)

### 💼 The pitch

The founder's cockpit — **one screen to run the entire business:** approve vendors, watch the money, set fees, issue refunds, handle support, and audit every action. It's what lets one person operate a two-sided marketplace without a team. If the consumer app is the storefront and the vendor portal is the back office, this is mission control.

### 🔧 Under the hood

`apps/web/src/app/admin` (Next.js).

### Tabs

| Tab | What it does |
|---|---|
| Vendors | Sortable table. Columns: name, city, Stripe status, tier, actions. Filter by status/tier/suspended. |
| Vendor detail | Full profile, Stripe account status, deal roster, audit trail. Suspend / unsuspend. |
| Deals | Pending review queue. Approve / reject / comment. |
| Money / Payouts | Payout list (filter pending/in-transit/paid/failed). Release transfer button. Retry failed payout. Reconcile. |
| **Refunds** | Dedicated refund ledger over the audit log: who issued it, when, amount of total, which order, **was the voucher already redeemed (⚠ flag)**, full/partial/blocked attempt, reason, Stripe refund id. Summary strip + outcome filter (All / Refunded / Blocked). |
| Fees | Global tier config (create, update, deactivate). Per-vendor override per row. |
| Audit | Every mutation. Filter by action / vendor / user / date. |
| Transactions | Browse + drill into individual transactions. |
| Customers | Consumer roster + detail. Per-txn inline refund. Refunded-txn badge cross-links → Refunds tab. Issue manual coupon = **stub**. |
| **Support** | Concierge tickets. Widened drawer with: chat (photo/video), **boss-view customer profile** (lifetime spend, refund %, auto-flags), **order-context history** (which order the ticket is about + all past orders), **inline refund/partial-refund per order**, and refund-badge cross-link → Refunds tab. Reply + push-on-reply, resolve/close. |

**Cross-tab links:** the "refunded $X ↗" badge anywhere (support drawer, customer drawer) jumps to the Refunds tab and flashes the matching record (targeted by transactionId). Customer names in the Refunds ledger jump to that customer's drawer.

---

## 9. Credit & loyalty system

### 💼 The pitch

A future loyalty layer: customers earn **credit** (from referrals, goodwill refunds, or gifts) that they spend on their next treatment — the hook that turns a one-time deal-hunter into a **repeat** customer, which is where marketplace economics actually win. **Not built yet** (Wallet shows $0); fully specced and ready when we want to pull the retention lever post-launch.

### 🔧 Under the hood

**Status: stubbed, not built.** Wallet tab shows balance of $0 with a "when referrals / refunds / gifts land" note.

### Spec (when built)

**Two buckets:**
- **Gloē pool** — funded by Gloē, usable at any vendor.
- **Vendor credit** — funded by a specific vendor, locked to them. Opt-in per vendor.

**Earning rules:**
- $2.50 for deals < $500, $10 for deals ≥ $500.
- Earned on **redemption** (not purchase) — prevents refund-farming.
- 12-month expiry.

**Spending rules:**
- Consumer toggles independently at checkout. Can use neither to stack for next time.
- On refund: credit clawed back from balance (idempotent).

**Data model:**
- Append-only `credit_ledger` (user_id, bucket, vendor_id?, cents, kind, created_at, expires_at).
- Balance = sum of ledger rows minus expired.

**UI surfaces:**
- Deal card: "Earn $2.50 in Gloē credit"
- Wallet tab: credit balance + history
- Checkout: toggles for each available credit

**Build order:** post-Stripe-Connect, post-refund-flow. Step 5 of 5 in the money roadmap.

---

## 10. What's shipped, what's pending

**Audited against code on 2026-06-01.** Use this as the live status board — update as features land. See the 🚨 must-have table below for the launch-blocker shortlist.

### Shipped (works end-to-end)

- Consumer app: Discover, Saved, Wallet, Profile, Deal detail, Voucher (QR). (Search screen is a **stub** — see gaps below.)
- Sign in / sign up via Clerk (incl. 2FA).
- Real GPS + location permission (contextual).
- Vendor signup, dashboard, post deal, scan + redeem, instant payout.
- Stripe Connect Express onboarding (vendor-side hosted flow).
- Money pipeline: PaymentIntent → Transfer on redemption (11 walls) → payout webhook mirror.
- Refunds (pre-redemption + post-redemption with transfer reversal).
- Apple Wallet pass generation (signed .pkpass).
- APNs push notification stack (ES256 JWT, device token registration, 410 cleanup).
- Admin: vendors, deals, payouts, fees (incl. per-vendor), audit, transactions, customers.
- **Refunds tab** (god mode) — dedicated forensic ledger over the audit log: actor, amount, order, redeemed-before-refund flag, full/partial/blocked, reason, Stripe id. Cross-linked from support + customer drawers. §8.
- **Search & discovery engine** — fuzzy (pg_trgm) + aesthetic synonym/slang-aware search, location-ranked, with autocomplete, recent/trending, smart no-dead-end empty state; vendor treatment auto-tagging (title→subtype detector); inventory-gated treatment drill-down pills; sort + treatment/rating filters. Full breakdown in **§6A**.
- **Support boss-view + order context + inline refunds** — support drawer shows a full customer profile (lifetime spend, refund %, auto-flags), the customer's order history (incl. which order the ticket is about), and refund/partial-refund actions per order without leaving the chat. §8.
- **Concierge support tickets** (consumer↔Gloē) — chat, photo/video attachments (camera + library), god-mode reply + push-on-reply. §6.
- **Account deletion** in-app (Apple 5.1.1(v)) — anonymize-and-deactivate. §6.
- **Out-of-area waitlist gate** — ComingSoon screen + demand capture + admin Waitlist tab. §6.
- **Image caching** (expo-image) across all remote photos + a press-in prefetch/preload layer. §6.
- **Vendor-only redemption** — consumer self-redeem removed (was a payout footgun). §6.
- Reconciliation query (manual trigger).
- Railway deploy (api + web). `.env.example` for contributors.
- Web SEO: favicon, OG card, PWA manifest, robots, sitemap.
- iOS app icon (gold G on dark brand) wired into Expo + Xcode. iPhone-only for v1 (iPad device-family off; iPad is a v2 roadmap item).

### 🚨 Launch must-haves NOT yet done (the real blocker list)

Ranked. These are what stand between "today" and "your wife's friend can install and buy." Everything else in this section is post-launch polish — see §14. **Audited against code 2026-06-01.**

| # | Blocker | Why it blocks launch | Effort | Status |
|---|---|---|---|---|
| 1 | **Sign in with Apple** | Hard App Store **rejection** (Guideline 4.8). We offer Google/Facebook/TikTok social login but NOT Apple — Apple requires an equivalent Apple option whenever third-party social login exists. `SocialAuthButtons.tsx` has no `apple` provider. | ~2h (Clerk supports it; add provider + button + entitlement) | ❌ Not built |
| 2 | **Dispute / chargeback webhook** | Money-loss + integrity. `charge.dispute.created` is unhandled, so a pre-redemption dispute won't freeze the claim or block the transfer — a customer can dispute AND redeem. This is wall #12. | ~half day | ❌ Not built |
| 3 | **Transactional receipts (Resend)** | Receipts are the #1 chargeback-preventer; a charge with no email receipt invites disputes. Nothing emails today. | ~half day (Resend + receipt on `payment_intent.succeeded`) | ❌ Not wired |
| 4 | **Apple Pay finish** | Code-complete (`merchantIdentifier` set), but needs Stripe Apple Pay cert + live-domain registration + a native device rebuild to actually charge. | ~1h once certs in hand | 🟡 Code-done, config pending |
| 5 | **ATT prompt** | Apple **rejection** (5.1.2) IF any cross-app analytics ship. `expo-tracking-transparency` not installed. If we launch with zero analytics SDKs we can defer; the moment Mixpanel/Sentry land, this is mandatory. | ~1h | ❌ Not installed (conditionally required) |
| 6 | **Universal Links / AASA** | Gift + deal share links (`/deal/*`, `/gift/*`) won't deep-link into the app without the `.well-known/apple-app-site-association` file served by web + `associatedDomains` in `app.json`. Not strictly a rejection, but share/gift flows are broken without it. | ~1h + rebuild | ❌ Not served |
| 7 | **ToS + Privacy Policy (hosted)** | App Store **requires** a Privacy Policy URL; "marketplace facilitator, not provider" clauses are legal protection for an aesthetic-services marketplace. No `/privacy` or `/terms` page exists. | ~half day (Termly) | ❌ Not hosted |
| 8 | **Landing page + support email** | App Store needs a Support URL; `gloe.app` should not be a dead root. `page.tsx` exists (55 lines) — verify it's a real landing, not a stub. `hello@gloe.app` forwarding must work. | ~half day | 🟡 Verify |

**Not blockers (explicitly OK to launch without):** robust search, deeper filters, credit/loyalty, Wallet live updates, OTA, map tab, OSRM, reconciliation cron. All parked in §14.

The **infra switches** (Stripe live keys, live webhook, Railway env, EAS build, TestFlight, submission) are mechanical and fully scripted in §11 — they're "do the runbook," not "figure out what to build." The table above is the *build* work that must precede the runbook.

### Pending / stubs / known gaps

- ~~**Robust search (DoorDash-style)**~~ — **DONE** (2026-06-01). Fuzzy + synonym-aware search, location-ranked, autocomplete, recent/trending, smart empty state, treatment auto-tagging, inventory-gated drill-down. Full system in **§6A**. Remaining tail:
  - **Search/click logging** — not wired. The data flywheel for real "trending" + learned synonyms + ML ranking later. Cheap to add; the deliberate "invest now, win later" piece.
  - **`FilterSheet` sort/rating UI** — the engine accepts `sort` (relevance/distance/price/rating/discount) + `minRating`, but the mobile FilterSheet doesn't expose controls for them yet (search screen + treatment pills do the heavy lifting). Add the controls to surface them.
  - **"Open now" filter** — deferred: `hours_summary` is freetext, not structured. Needs structured hours before it can be a filter that doesn't lie.
- **Apple Pay** — code-complete in Stripe PaymentSheet; needs Merchant ID + Stripe cert + native device rebuild. Tonight session.
- **Apple Wallet live updates** — pass generation ships, but status flips (e.g. "Redeemed") need APNs Pass Web Service spec wiring. Schema for `pass_registrations` is there. Not a launch blocker.
- ~~**Delete account in-app**~~ — **DONE** (`me.deleteAccount`, anonymize-and-deactivate; see §6).
- **ATT prompt** — required per Apple 5.1.2 if any cross-app analytics. Add `expo-tracking-transparency`.
- **Map tab** — not in nav. Future v1.1.
- **Credit & loyalty system** — stubbed at $0.
- **Sentry + Mixpanel** — not wired.
- **CI/CD** — no `.github/workflows/`. Manual Railway deploy.
- **OTA updates (expo-updates)** — not installed; no `eas.json`. Every mobile update is a full rebuild today. Wire OTA when cutting the first TestFlight build (see §11 Phase 5). Deferred on purpose while native code churns.
- **Supabase migrations in repo** — not visible. Schema managed directly. Risky — add migration tracking before next major schema change.
- **Coupon / manual credit issuance in admin** — UI stub.
- **OSRM self-hosted routing** — current drive-time is straight-line × tiered mph (±20%, $0). Deferred until margin demands it.
- **Reconciliation cron** — query exists, schedule not wired.
- **Dispute / chargeback webhook** — `charge.dispute.created` is NOT handled. A pre-redemption dispute won't freeze the claim or block the transfer today. Pre-launch blocker; plan in §4 "Disputes & chargebacks." Includes wall #12 (no open dispute).
- **Nightly DB backups** — Supabase free tier has daily; verify and document recovery.

---

## 11. Pre-launch runbook

When you say "ready to ship," walk this top to bottom. Every box matters.

### Phase 1 — Apple App Store hygiene (rejection blockers)

1. **Delete account** — add row in profile settings → Clerk `user.delete()` + tRPC mutation. Confirmation dialog. (Apple 5.1.1(v).)
2. **Sign in with Apple** — ⚠️ NOT BUILT. `SocialAuthButtons.tsx` offers Google/Facebook/TikTok but no Apple provider → guaranteed rejection (Apple 4.8). Enable `oauth_apple` in Clerk, add the Apple button at equal prominence, add the `com.apple.developer.applesignin` entitlement, rebuild. **Blocker #1 — do this first.**
3. **ATT prompt** — `expo-tracking-transparency`, request on first launch after sign-in, persist answer to Clerk userMetadata. (Apple 5.1.2.)
4. **Location asked in context** — move from cold launch to "Near me" filter tap. (Apple 5.1.1.)
5. **OG meta tags on `gloe.app/deal/[id]`** — title, og:title, og:description, og:image (deal hero), twitter:card. Validate at opengraph.xyz.
6. **App Review demo account** — `apple-review@gloe.app` with claimed deals + one redeemed voucher + test card. Provide in App Store Connect → App Review Info.
7. **Privacy nutrition label** — declare Clerk, Stripe, Google Maps, own DB. Undeclared = rejection.

### Phase 2 — Apple Developer Portal

8. **Pass Type ID cert** — exists. Production uses same cert.
9. **APNs Auth Key** — `.p8` in `apps/api/secrets/AuthKey_<KEYID>.p8`. Note Key ID + Team ID `MW2DS9PQD6`.
10. **Universal Links** — app id `com.gloe.app` → Associated Domains capability. In `app.json` ios.associatedDomains: `["applinks:gloe.app"]`. Serve `https://gloe.app/.well-known/apple-app-site-association` as plain JSON:
    ```json
    {"applinks":{"apps":[],"details":[{"appID":"MW2DS9PQD6.com.gloe.app","paths":["/deal/*","/gift/*","/vendor/*"]}]}}
    ```
    Validate at branch.io/resources/aasa-validator/. Requires native rebuild.
11. **Apple Pay Merchant ID** — `merchant.com.gloe.app` already linked. No production change.
12. **Push Notifications capability** — currently NOT enabled on the App ID. Causes `aps-environment` entitlement build errors. Enable in dev portal → Identifiers → com.gloe.app → check Push Notifications → Save.

### Phase 3 — Stripe production switches

13. Flip Stripe Dashboard to live mode (top-right toggle).
14. **Live API keys** — `sk_live_*` + `pk_live_*` → Railway env `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`. Update `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` in EAS build profile.
15. **Live webhook** — new endpoint in live mode → `https://<railway-domain>/webhooks/stripe`. Events: `account.updated`, `payout.created`, `payout.paid`, `payout.failed`, `payout.canceled`, `checkout.session.completed`, `payment_intent.succeeded`. Copy signing secret → Railway env `STRIPE_WEBHOOK_SECRET`.
16. **Stripe Connect — production onboarding** — dev `acct_*` are sandbox. Real vendors re-onboard via live Express URL.
17. **Apple Pay live domain** — Stripe Dashboard → Settings → Payment methods → Apple Pay → register `gloe.app`.

### Phase 4 — Railway env vars (full template)

```
# Required
NODE_ENV=production
PORT=4000
DATABASE_URL=<Supabase prod connection string>

# Clerk (LIVE)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Stripe (LIVE)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google Maps
GOOGLE_MAPS_API_KEY=...

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Public origin (used in gift URLs, OG-tag canonical)
PUBLIC_WEB_ORIGIN=https://gloe.app

# Apple Wallet — base64'd because Railway env is text-only
APPLE_TEAM_ID=MW2DS9PQD6
APPLE_PASS_TYPE_ID=pass.com.gloe.voucher
APPLE_PASS_SIGNER_KEY_PASSPHRASE=<passphrase>
APPLE_PASS_SIGNER_CERT_PEM_B64=<base64 of signerCert.pem>
APPLE_PASS_SIGNER_KEY_PEM_B64=<base64 of signerKey.pem>
APPLE_PASS_WWDR_PEM_B64=<base64 of wwdr.pem>

# APNs
APPLE_APNS_KEY_ID=<10-char Key ID>
APPLE_APNS_KEY_FILENAME=AuthKey_<KEYID>.p8
APPLE_APNS_KEY_PEM_B64=<base64 of .p8>
APPLE_BUNDLE_ID=com.gloe.app
```

Code pattern for env-or-file PEM loading (already in `walletPass.ts` / `apns.ts` or add):

```ts
function loadPem(envName: string, filename: string): Buffer {
  const b64 = process.env[`${envName}_B64`];
  if (b64) return Buffer.from(b64, 'base64');
  return readFileSync(join(SECRETS_DIR, filename));
}
```

### Phase 5 — Mobile build

18. `apps/mobile/.env`: `EXPO_PUBLIC_API_URL` → `https://api.gloe.app`. Use EAS Secrets for prod Clerk + Stripe publishable keys.
19. EAS `production` profile: release scheme + distribution=store + auto-bump build number.
20. `npx eas build --platform ios --profile production` (~15 min).
21. `npx eas submit --platform ios --profile production` (~30 min Apple processing).

#### OTA updates (expo-updates) — set up HERE, when cutting the first TestFlight build

**Deferred intentionally** (decided 2026-05-30). Not installed yet — `expo-updates` absent, no `eas.json`. Do NOT wire OTA mid-feature-sprint while native code is still churning (Apple Pay, Wallet, iPad/device-family edits) — you're rebuilding anyway, so OTA buys nothing and adds a sharp edge.

When you DO set it up (one-time, ~30 min, do it calmly):
- `npx expo install expo-updates`; add `eas.json` with `development` / `preview` / `production` profiles and matching update **channels**.
- **`runtimeVersion` policy:** set it to `appVersion` (or a fingerprint policy). This is the critical safety: an OTA update whose JS expects native code NOT in the installed build must be *not-delivered*, never delivered-and-crash. Mismatched runtimeVersion = update silently withheld (safe), not a launch crash.
- **Two update types — know which you have:**
  - **JS-only** (UI, copy, most bug fixes, the ComingSoon screen, logger tweaks): `eas update --branch <channel>` → testers get it on next open, **no Apple review, ~1 min**.
  - **Native** (new module, Info.plist/entitlements/capability, SDK bump, device-family/pbxproj change): requires `eas build` → `eas submit` → Apple processing (~30–45 min). OTA CANNOT ship these.
- **Discipline:** push to a `preview` channel first, never straight to `production`. A bad OTA hits everyone instantly. `eas update:rollback` exists; know it before you need it.
- Apple rule: OTA is for changes that don't materially alter the app's purpose. Fine for fixes/polish; a whole new feature should ride a reviewed build.

### Phase 6 — TestFlight

22. **Internal** — yourself + ~5 friends. Test happy path: signup → claim → pay → voucher → redeem (sim) → review. Gift link path. Wallet add.
23. **External** — 20–50 beta users (24h Apple review). Bug-fixes here are far cheaper than post-launch. Once OTA is live, JS-only fixes in this phase ship via `eas update` without a new build/review.

### Phase 7 — App Store submission

24. **App Information** — name "Gloē", subtitle (30 char), categories Lifestyle + Health & Fitness, Free, US only for v1.
25. **Screenshots** — 6.9", 6.5", 5.5" with device frames. Discover, Deal detail, Wallet, Voucher (QR + Wallet badge), Profile.
26. **Description + keywords** — 1700-char benefit-first description. Keywords: aesthetic, beauty deals, botox, filler, spa, medspa, injectables, microneedling, hydrafacial...
27. **Privacy Policy URL** — hosted on gloe.app.
28. **Support URL** — `mailto:hello@gloe.app` or Help page.
29. **Age rating** — 12+.
30. **In-app purchases** — none. App Review note: "Vouchers redeem for in-person aesthetic services at independent businesses. Stripe Connect handles all payments. Apple Pay is offered as a payment method only."
31. **Submit for review** (~24h SLA).

### Phase 8 — Pre-launch checklist (non-code)

- **Landing page at gloe.app** — single-pager (hero + 3-step + app badge + vendor CTA). Half a day.
- **Transactional email via Resend** — receipts (critical, prevents chargebacks), voucher expiry reminders, vendor welcome, gift-link confirmations.
- **Push notifications** — contextual asks (after first save or purchase, not cold). 60–80% opt-in vs. 20% cold.
- **ToS + Privacy via Termly** ($15–50/mo). Critical clauses: "Gloē is a marketplace facilitator, not a service provider," "vendors are independent licensed providers," "all services subject to consultation," refund window (3 days goodwill), arbitration, vendor indemnification.
- **Customer support email** — ImprovMX (free forwarding) → Google Workspace ($6/mo) at volume. `hello@gloe.app` everywhere.
- **First 5 real vendors** — walk-in pitch (30% conversion vs. 0.5% cold email). Take photos. Help word the deal. White-glove onboarding. Proof-point: send first customer yourself.
- **Analytics** — Mixpanel free tier (100k events/mo). Funnel: discover → detail → checkout → paid → redeemed.
- **Error monitoring** — Sentry free for solo devs. Mobile + API.

### Phase 9 — Day-of-launch monitoring

32. Stripe dashboard — first real transactions visible.
33. Railway logs — 500s in webhook handlers lose money.
34. Supabase advisors — perf or security warnings on real traffic.
35. Sentry — crashes.

### "Launched" definition

5+ live spas. TestFlight approved. Stripe live. Receipts firing. gloe.app shows landing. ToS + Privacy live. Support email works. Your wife's friend can install and buy.

---

## 12. Manual test scenarios

Critical-path tests. Run before signing the first real spa. ~90 minutes top to bottom.

### Prerequisites

- Clean dev DB
- Test vendor "Test Vendor Spa" with `stripe_account_status='active'`
- Stripe test mode + webhooks listening locally (`stripe listen --forward-to localhost:4000/webhooks/stripe`)
- Auto-balance top-up enabled on Stripe test platform

### Scenario 1 — Happy path

Customer buys $200 deal → Stripe charges platform balance → claim created `status='active'` → vendor scans QR (or dev-redeem) → `status='redeemed'` → auto-release fires Transfer to vendor's Connect ($160 at 20%) → Stripe runs payout.

**Good:** `transactions` shows `released`. `payouts` shows `paid`. Audit log has matching rows.

### Scenario 2 — Manual release

Same as 1 but with `auto_release_on_redemption=false`. Money sits in "Waiting to release" queue. Admin clicks Push → Transfer fires.

### Scenario 3 — Multi-quantity

Customer buys qty 3 of $80 facial. **One `transactions` row + three `claims` rows**, each independently redeemable. First redemption fires the full vendor payout (known gap — verify intent).

### Scenario 4 — Pre-onboarding vendor

Vendor with `stripe_account_status='pending'`. Customer pays → claim created → vendor tries to release → Transfer is REFUSED. `transactions.status='paid'` (money held). Vendor finishes Stripe → manual retry → Transfer succeeds.

### Scenario 5 — Per-vendor fee override

Admin sets 8% override (vs. global 20%). Subsequent bookings use 8%. Historical bookings unchanged (frozen via `platform_fee_snapshot`).

### Scenario 6 — Voucher expiry

Voucher unredeemed past `expires_at`. Cron flips to `expired`. No transfer fires. Money stays on Gloē balance.

### Scenarios 7a–7f — Refunds

7a. Full refund of unredeemed → PaymentIntent refunded, claim cancelled.
7b. Partial refund → claim stays active, transaction.status `partially_refunded`.
7c. Stack partials to full → cumulative refund equals charge.
7d. Refuse refund on redeemed claim → UI hides button + backend rejects.
7e. Refuse refund on insufficient balance.
7f. Idempotency on double-submit.

### Scenarios 8–9 — Payouts

8. Standard payout: Stripe runs daily ACH → `payout.paid` webhook → `payouts` row updated.
9. Failed payout: use Stripe test routing `110000000` → `payout.failed` → red banner in vendor Hub.

### Scenarios 10–13 — Instant payouts

10. Happy path: vendor opts in + has debit card → tap "Pay me now" for $176 → 3% fee → debit gets $170.72 in ~30 min.
11. Opted in, no debit card: orange callout, no button.
12. $0 available: no button offered.
13. Not opted in: server refuses.

### Scenarios 14–17 — Edges

14. Fee tier overlap: admin can't create overlapping ranges.
15. Historical immutability: editing a fee tier doesn't retroactively change past bookings.
16. Vendor suspension: deals drop to draft. Held payouts still pushable if Stripe active.
17. Reconciliation: manual DB vs. Stripe diff catches drift.

### Launch-day sign-off (the 4 must-pass)

| # | Test | What good looks like |
|---|---|---|
| 1 | Refunds | Full, partial, refused-on-redeemed all behave |
| 2 | Standard payout | `payout.paid` webhook fires, admin shows updated amounts |
| 3 | Failed payout | `payout.failed` fires, red banner appears |
| 4 | Vendor onboarding | Connect → webhook flips status → make test purchase + payout cycle |

All 4 green = ready to sign first real spa.

---

## 13. Operating the system day-to-day

### "Vendor says I haven't been paid"

1. Admin → Vendors → find them → check payouts tab.
2. Filter to last 7d. Status: pending? in_transit? paid? failed?
3. If failed → check failure_message → red banner already showed in their Hub.
4. If pending → standard ACH cadence (1–2 biz days). Wait.
5. If no payouts at all → check Stripe account status. `pending`? They haven't finished onboarding. Send them the link.

### "Customer says I was charged but no voucher"

1. Admin → Transactions → find by email or PaymentIntent ID.
2. Status `pending_payment`? Webhook didn't fire. Check Stripe Dashboard → Events. Replay it.
3. Status `paid` but no claim? `fulfillPurchase()` failed. Check Railway logs.
4. Issue refund (status will revert) or manually create claim with audit note.

### Reconciling Stripe vs. our books

1. Admin → Payouts → "Reconcile" button → runs `reconcileVendorTransfers()`.
2. Discrepancies surface in UI.
3. Common drift causes: missed webhook (replay), idempotency collision (manual investigation), manual Stripe Dashboard action (audit note).

### Releasing a held payout

1. Vendor on `auto_release_on_redemption=false` → claim redeemed → money waiting.
2. Admin → that claim's transaction → "Release transfer" button.
3. All 11 walls re-checked. Audit row written.

### Handling failed payout

1. `payout.failed` webhook → `payouts.status='failed'` + `failure_message` set.
2. Vendor Hub shows red banner.
3. Admin → "Retry failed payout" once vendor fixes bank info.

### Test-mode quirks

- Pending balance in test mode never settles → payouts will sit "pending" forever unless you top up the Stripe test balance.
- Bypass cards: `4000 0000 0000 0341` for instant fund, `4000 0000 0000 9995` for insufficient.
- Routing `110000000` to force payout failure.

---

## 14. Roadmap (v1 → v4)

### v1.0 — MVP San Diego (now)

- Consumer iOS app (**iPhone only** — `supportsTablet:false`; iPad support is a v2.0 item), vendor portal, admin, Stripe Connect, Apple Pay, Apple Wallet pass.
- 5 launch vendors, 25+ deals across 3–4 categories.
- gloe.app landing page.
- US only.

### v1.1 — Polish

- ~~**Robust DoorDash-style search**~~ — ✅ **shipped early** (2026-06-01). Fuzzy + synonym-aware, location-ranked, auto-tagging, inventory-gated drill-down. See §6A. Tail: search logging, FilterSheet sort/rating UI, "open now".
- Map tab in consumer app (deals plotted by location).
- Reviews (write side; read is shipped).
- Apple Wallet live status updates (Pass Web Service + APNs trigger).
- ~~Delete account UI~~ — ✅ shipped (§6).
- ATT prompt + contextual location ask.
- Sentry + Mixpanel.

### v1.2 — Engagement

- Push notifications on flash deals, saved-vendor activity, voucher expiry.
- Referrals (Gloē credit on signup).
- Credit / loyalty system live.

### v1.3 — Monetization (vendor-side optional)

- Promoted posts / sponsored placement.
- Vendor analytics dashboard.

### v2.0 — Scale

- Multi-city (LA, NYC, Austin, Miami).
- Android.
- **iPad — native tablet support.** v1 ships iPhone-only (`supportsTablet:false`, device family `1`). Real iPad support means adaptive layouts + landscape across Discover / Deal detail / Voucher / Map, not just scaled-up portrait. Pairs naturally with web consumer browse (shared responsive work).
- Web consumer browse.
- Apple Wallet App Clip (save-deal-from-link without install).

### v3.0 — Network effects

- Gloē Plus subscription (free shipping-equivalent: priority deals, exclusive %).
- Concierge (chat-based booking).
- Vendor-to-vendor referrals.

### v4.0 — Platform

- Public API / white-label.
- B2B partnerships (hotels, gyms, plastic surgery centers).
- In-home / mobile aesthetic deals.

---

## 15. Legal & compliance

- **Marketplace facilitator language** in ToS. Gloē is not a service provider.
- **Vendor indemnification** clause — they own clinical outcomes.
- **License verification** — manual today. Eventually automate via state board API where available.
- **Medical disclaimers** — results not guaranteed; consultation required; vendor attestation that customer is a candidate.
- **HIPAA** — Gloē is NOT a covered entity. Do not collect PHI. Keep claim metadata to vendor + product, never diagnosis or treatment specifics.
- **FTC fake review rules** — only verified buyers can review. Flag vendor for review manipulation.
- **State aesthetic advertising laws** — vary by state. Lawyer's job.
- **Insurance** — general + cyber + E&O. State money transmitter check (some states require licenses for marketplaces holding funds; Stripe Connect "destination charges" pattern usually avoids this — confirm with counsel).
- **Stripe Connect** handles KYC, 1099-K, payouts, refunds.

---

## 16. Infrastructure & costs

### 🚨 Region co-location (the #1 prod-perf rule)

Supabase is in **`aws-1-us-east-1`** (Virginia). **Railway MUST deploy in the same region (us-east).** A SoCal dev laptop → us-east DB pays ~83ms per query round-trip (measured), which makes things feel slow in dev — but that's a dev artifact: co-located in prod, each query is ~1–3ms. **Pick the Supabase region first, pin Railway to match — never split coasts.** The DB pool (`db/client.ts`) keeps connections warm 5 min (`idle_timeout: 300`) + a boot `SELECT 1`, so a paused tap doesn't re-pay the ~1s TLS handshake. For local dev speed, run a local Postgres (`supabase start`) to avoid the cross-country hop entirely. Stay on the transaction pooler (`:6543`, `prepare:false`).

### Year 1 (San Diego pilot)

- Railway API + web: ~$25/mo
- Supabase Pro: $25/mo
- Cloudflare DNS: free
- Resend (transactional email): free tier → $20/mo at scale
- Termly (ToS + Privacy): $15/mo
- Mixpanel: free tier
- Sentry: free for solo dev
- Stripe: 2.9% + 30¢ per charge (passthrough; not Gloē cost)
- Google Maps: pay-as-you-go, currently low usage
- Apple Developer: $99/yr

**Total infra: ~$100/mo. Marketing budget: $5–8K for the first 6 months.**

### Year 2 (5 cities, ~700 vendors)

- Railway: $200–500/mo (vertical scaling)
- Supabase: $599/mo (Team) or hand-roll to Neon/RDS
- Google Maps: ~$300/mo → switch to Starter plan at $100/mo when crossing 20k calls/mo. See `google-maps-pricing.md`.
- Self-host OSRM routing (~$15/mo) replaces Google Distance Matrix on margin pressure.
- Email scales linearly with vendor + claim count.

### Google Maps pricing crossover (as of 2026-05-24)

| Plan | $/mo | Monthly calls |
|---|---|---|
| Pay-as-you-go | varies | unlimited at ~$5/1k |
| Starter | $100 | 50k |
| Essentials | $275 | 100k |
| Pro | $1,200 | 250k |

Stay on pay-as-you-go today. Switch at $80/mo billing.

---

## 17. Out of scope (for now)

- In-app messaging (consumer ↔ vendor) — phone + email enough at v1.
- Loyalty points (separate from credit) — credit covers the use case.
- Social features (friends, follow) — not the wedge.
- AI recommendations — manual curation works at scale 1.
- Gloē Plus subscription — v3+.
- B2B partnerships — v4+.
- In-home / mobile service — v4+.
- Web consumer browse — v2.
- Translations — v2.
- Android — v2.

---

## 18. FAQ — common confusions

### How does Stripe know what Gloē takes?

It depends on the fee type.
- **Platform fee (currently 20% up to $500, flat $60 above — admin-set):** Stripe knows nothing. We compute it, transfer less. The customer is charged $200, we transfer $160, the $40 stays on Gloē's platform balance.
- **Instant payout fee (3%):** Stripe knows. Configured as a pricing scheme in the Stripe Dashboard, auto-deducted during every Connect instant payout under the platform.

### Why does the vendor's dashboard show $160, not $200?

They see what's transferred to *their* account. The $200 customer charge happened on Gloē's platform balance — vendor has no visibility into it. They see $160 arrive via Transfer (at the current 20% fee), then payout. The math (their gross vs. what they received) is shown in their Hub.

### If the money already left our hands on instant payout, how can we charge a 3% fee?

The 3% comes off the *vendor's* available balance during the instant payout itself, not from Gloē's balance. Stripe collects it as an application fee and deposits it into our platform balance.

### Can a misrouted Transfer ever send money to the wrong vendor?

No, because **routing is derived server-side**. The vendor ID on a claim is set at claim creation from the deal's vendor. `releaseTransferForClaim()` looks up `vendor.stripe_account_id` server-side, never trusts the caller. Even an authenticated admin can't redirect a transfer to a different account.

### Why are there two FKs on the claims ↔ transactions relationship?

`transactions.claim_id` is historical / informational. The authoritative direction is `claims.transaction_id`. A multi-quantity purchase produces one transaction + N claims, so the transaction-side claim_id is meaningless after qty>1 — kept for legacy.

### Pay Type ID vs. Bundle ID — what topic does APNs use?

APNs has two topics:
- **In-app pushes:** topic = bundle ID (`com.gloe.app`).
- **Wallet pass pushes:** topic = Pass Type ID (`pass.com.gloe.voucher`).

Each uses a different signing key but the same `.p8` works for in-app pushes today.

### Why don't we use Google Distance Matrix for drive times?

At $0.005 per origin × destination pair, a 50-card feed costs $0.25 per user per day even cached. That scales linearly with users and outruns platform fee margin fast.

DoorDash and Uber don't pay Google for routing — they self-host OSRM. We currently use a straight-line estimate × tiered-mph model (within ±20% of Google). When margin demands, we'll switch to self-hosted OSRM. See `osrm-self-hosted-routing-todo.md`.

### Why two iOS apps eventually (consumer + vendor)?

Different mental models (browse vs. operate), different login systems (Clerk consumer vs. vendor), different native capabilities (no QR camera in consumer), different App Store discovery, different release cadence (vendor can ship faster — no consumer review risk), different security review scope.

Today: vendor lives in `apps/web/src/app/vendor` (responsive web). Native vendor app is a deferred v1.3+ enhancement, not a launch blocker.

### Why one monorepo despite two-or-three frontends?

Code sharing (api-client, ui, brand) without npm publishing. One git history. One `npm install`. One CI pipeline (eventually).

---

*End of doc. When something material changes — a fee tier, a wall, a launch checklist item — update this file in the same PR as the code change. Memory files in `.claude/projects/-Users-admin-Desktop-GlowApp/memory/` track session-level context and shouldn't replace this doc.*
