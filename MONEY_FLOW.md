# Gloē — Money Flow

> How a dollar moves from a customer's card to a vendor's bank, and where Gloē takes its cut.
>
> **Status:** Reflects the codebase as of 2026-05-23 (Stripe Connect Express, separate charge & transfer model, instant payouts enabled with a 3% application fee).
>
> Cross-references: [`CREDITS_AND_FEES.md`](./CREDITS_AND_FEES.md) §6b (operational decisions), §1 (platform fee tiers), §1b (instant payouts).

---

## TL;DR — the four stages

```
[1] CHARGE         [2] TRANSFER         [3] PAYOUT (standard)    or    [3'] PAYOUT (instant)
─────────────      ──────────────       ──────────────────────         ──────────────────────
customer's         Gloē platform        Stripe (automatic, 1–2          Stripe (manual, ~30 min,
card               balance              business days, free)             vendor pays 3% fee)
   │                   │                       │                              │
   ▼                   ▼                       ▼                              ▼
$200 lands on      $176 moves to        $176 lands in vendor's        $171.40 lands on vendor's
Gloē's platform    vendor's Connect     bank, free                    debit card · $4.40 fee
balance.           balance when QR is                                  routed back to Gloē ($1.76
$24 stays on       redeemed. $24 stays                                 Stripe takes, Gloē keeps
Gloē's balance.    on Gloē's balance.                                  $2.64 net).
```

Two truths to anchor on:

1. **We use the "separate charge and transfer" Connect pattern.** That means Gloē holds the customer's money on its platform balance until the voucher is redeemed. We *transfer* only what the vendor is owed; Gloē's fee is whatever we choose not to transfer. **Stripe has no concept of "Gloē's platform fee" — it just sees a charge, then a smaller transfer.** Our DB is the source of truth for fee math.
2. **Stripe knows about the instant-payout fee, and only that one.** Because the money has already left our control by the time a vendor instant-pays-out, we use Stripe's application-fee mechanism (configured as a 3% default scheme in the Stripe Dashboard). Stripe deducts it during the payout call and routes it back to Gloē's platform balance.

---

## Stage 1 — Charge: customer pays Gloē

**What the customer sees:** Standard Apple Pay / card sheet on the mobile app. They pay $200 (the deal price + qty).

**What happens in code:**

1. Mobile client calls `checkout.createPurchase` ([apps/api/src/domain/checkout.ts](apps/api/src/domain/checkout.ts)).
2. We look up the price + active `platform_fees` row and **snapshot** the fee into a new `transactions` row:
   ```
   consumer_paid_cents = 20000   // $200, what the customer pays Stripe
   platform_fee_cents  =  2400   // $24, our cut (12% tier or per-vendor override)
   vendor_payout_cents = 17600   // $176, what we'll transfer on redemption
   platform_fee_snapshot = {...} // JSON of the fee row used — frozen for audit
   status              = 'pending_payment'
   ```
3. We create a Stripe PaymentIntent for the **full $200** — *no* `transfer_data`, *no* `on_behalf_of`. That means the money goes to **Gloē's platform balance**, not the vendor's Connect account.
4. Client confirms the PaymentIntent → Stripe charges the card → webhook `payment_intent.succeeded` fires.
5. Webhook handler ([apps/api/src/index.ts](apps/api/src/index.ts)) calls `fulfillPurchase()` which:
   - Flips `transactions.status` → `'paid'`, sets `paid_at`
   - Creates one or more `claims` rows (one per quantity), each with `status='active'`, a QR payload, and a `transaction_id` back-reference
   - Bumps `deal_variants.spots_claimed`

**Where the money lives now:** Gloē's platform balance. The vendor has nothing.

**Why we hold it:** so we can refund cleanly without clawing back from the vendor if the customer cancels before redemption.

**Where Gloē's fee math lives:** the `transactions` row. Stripe is unaware.

---

## Stage 2 — Transfer: Gloē pays the vendor (on redemption)

**What the customer sees:** They walk into the spa, show the QR. Vendor scans (or, today, dev redeem hits the endpoint).

**What happens in code:**

1. `claims.devMarkRedeemed()` (will be replaced by a real vendor-side scan) flips `claims.status` → `'redeemed'`, sets `redeemed_at`.
2. If the vendor has `vendors.auto_release_on_redemption = true` (god-mode toggle), the redemption handler immediately calls `releaseTransferForClaim()` in [apps/api/src/domain/payouts.ts](apps/api/src/domain/payouts.ts).
3. `releaseTransferForClaim` runs every wall before calling Stripe (see [CREDITS_AND_FEES.md §6b walls](./CREDITS_AND_FEES.md#walls)):
   - Server-side lookup of destination via `claim → deal → vendor → stripe_account_id`. **Never trusted from caller input.**
   - Claim status must be `'redeemed'`, transaction must be `'paid'`, no existing `stripe_transfer_id`
   - Vendor's `stripe_account_status` must be `'active'`
   - Per-attempt Stripe idempotency key
4. Stripe Transfer call:
   ```
   stripe.transfers.create({
     amount: 17600,                          // $176, what we pre-decided
     destination: vendor.stripe_account_id,  // server-derived
     transfer_group: claim.id,
   })
   ```
5. On success: write `transactions.stripe_transfer_id` and flip status → `'released'`. Set `released_at`.

**Where the money lives now:** $176 on the vendor's Connect balance (a Stripe-managed account *for that vendor*). $24 stays on Gloē's platform balance. The vendor's bank has nothing yet.

**That $24 IS Gloē's fee.** It's not labeled "fee" anywhere on Stripe — it's just money we chose not to send. The fee is *implicit in the math*.

**If auto-release is off:** the redemption still flips the claim status, but no Transfer fires. The money sits in our held queue and shows up in god mode's vendor detail page as "Waiting to release." An admin clicks **Push** → same code path fires.

---

## Stage 3 — Payout (standard): Stripe pays the vendor's bank

This stage is **automatic** and Stripe-driven. We don't trigger it.

**What happens:**

1. Every connected account has a `payout_schedule` (set during onboarding, default `daily`).
2. Stripe sweeps the vendor's Connect balance into a bank deposit on that schedule.
3. Webhook `payout.created` fires → we mirror it to `public.payouts` with `status='pending'`.
4. 1–2 business days later, Stripe completes the ACH → webhook `payout.paid` fires → we update `payouts.status='paid'`, `arrived_at=now()`.
5. If the deposit fails (wrong routing number, closed account) → webhook `payout.failed` fires → we update `payouts.status='failed'` and store `failure_message`. This is what the **red "Failed payouts" banner** on the vendor Hub reads from.

**Code:** [apps/api/src/domain/payoutWebhooks.ts](apps/api/src/domain/payoutWebhooks.ts), wired in `apps/api/src/index.ts`.

**Cost to Gloē / vendor:** $0. Standard payouts are free.

---

## Stage 3' — Payout (instant): vendor wants the money now

**What the vendor sees:** A "Pay me now" button on their Hub Money card when they have a Connect balance and they've opted in (Settings → "Enable instant payouts (3% fee)"). Tapping it opens a confirmation breakdown:

```
Payout amount   $176.00
Fee (3%)         −$5.28
You receive     $170.72  ← lands on debit card in ~30 min
```

**What happens in code:**

1. `vendor.requestInstantPayout` tRPC ([apps/api/src/router/vendor.router.ts](apps/api/src/router/vendor.router.ts)) calls `triggerInstantPayout()` in [apps/api/src/domain/payouts.ts](apps/api/src/domain/payouts.ts).
2. Walls run: vendor must be opted in, Stripe account `'active'`, debit card on file, amount ≤ available balance.
3. Stripe call:
   ```
   stripe.payouts.create(
     { amount: 17600, method: 'instant' },
     { stripeAccount: vendor.stripe_account_id }
   )
   ```
4. We write a `payouts` row with `status='pending'`. Webhook flips it to `paid` (~30 min) or `failed`.

**Where the fee comes from — the part everyone gets confused about:**

We **do not** pass `application_fee_amount` in the payout call. We don't have to. We configured a **default pricing scheme of 3%** in the Stripe Dashboard:

> Stripe Dashboard → Settings → Connect → Pricing schemes → Instant payouts

This tells Stripe: "for every Connect Instant Payout under this platform, auto-apply a 3% application fee." So Stripe:

1. Calculates 3% of the payout ($5.28 on $176)
2. Routes that $5.28 back to Gloē's platform balance
3. Deducts its own **1% cost** from the application fee ($1.76)
4. **Gloē net keeps $3.52 (2%)** — slightly better than the original 1.5% the spec assumed at 2.5%
5. Sends the remainder ($170.72) to the vendor's debit card

**Confirming this without diving into Stripe:** look at `transactions` and `payouts` rows in our DB — the application fee won't be there, because *Stripe is the one collecting it*. To see it, check the Stripe Dashboard → Connect → Applications → fees collected, or via `stripe.applicationFees.list()`.

---

## How Stripe Connect "knows" what Gloē takes

This is the part the question keeps surfacing. Two completely different mechanisms for two completely different fees:

### Fee #1: Platform fee on bookings (10% / 12% / flat $60 cap)
- **Stripe does NOT know.** We compute it in our DB at checkout time from `platform_fees` and snapshot it onto the `transactions` row.
- We collect it by **transferring less than we charged** in Stage 2. The difference ($24 on the $200 example) sits on Gloē's platform balance.
- If we later need to refund pre-redemption, we just `refund` the PaymentIntent. The vendor was never paid; we never charged a "fee" Stripe knows about. Clean.

### Fee #2: Instant-payout fee (3%)
- **Stripe DOES know.** We configured 3% as the default pricing scheme in the Stripe Dashboard.
- Stripe automatically applies it during *every* Instant Payout call from *any* connected account under our platform.
- We never deduct it ourselves. Stripe routes it to Gloē's platform balance automatically.

### Why the asymmetry?
Because the fees happen at different points in the money flow:
- **Booking fee** = at the **charge** step → we never let the money out → simple "transfer less than we charged" math.
- **Instant payout fee** = at the **payout** step → the money is already on the vendor's Connect balance → we'd have to claw it back, which is exactly what `application_fee_amount` on the payout call does for us automatically.

---

## State machine: how to read a single booking's history

A `transactions` row walks through:

```
pending_payment   → customer started checkout, PaymentIntent created
       │
       ▼   (payment_intent.succeeded webhook)
paid              → customer's money is on Gloē's balance; claim issued
       │
       ▼   (auto-release or manual Push after QR redemption)
released          → vendor's share has been transferred to their Connect balance
       │
       ├──► (if customer disputes / vendor comps post-redemption)
       │    refunded               → full money returned
       │    partially_refunded     → some returned
       │
       ▼
(stays released forever — Stripe's standard / instant payout takes over)
```

Independent of the `transactions` lifecycle, the `claims` row walks:

```
active → redeemed   (QR scan)
       → expired    (passed expires_at without redemption)
       → cancelled  (refund + voucher voided)
```

And the `payouts` row (managed by Stripe webhooks):

```
pending → paid     (standard ACH, instant payout — both succeed)
        → failed   (bank rejected; vendor must fix in Stripe dashboard)
        → cancelled
```

---

## Where the numbers come from in the UIs

| UI tile (Vendor Hub) | Source | Notes |
|---|---|---|
| **In your Stripe account** | `stripe.balance.retrieve({ stripeAccount })` → `available[0].amount` | Live Stripe call, not our DB. Reflects what Stripe will pay them on the next standard payout. |
| **Queued for transfer** | DB: `claims` redeemed + `transactions.paid` + no `stripe_transfer_id` | Money still on Gloē's balance, claim redeemed, transfer not yet fired (auto off, or release failed). |
| **Paid out · last 7d** | DB: `payouts` with `status IN ('paid','arrived')` and `created_at >= now() - 7d` | Populated by `payout.paid` webhook. |
| **Failed payouts banner** | DB: `payouts` with `status='failed'` | Populated by `payout.failed` webhook. |
| **Sold today** | DB: `transactions` with `status IN ('paid','released','partially_refunded')` and `paid_at::date = current_date` | Counts the moment the customer pays, not when they redeem. |

| UI tile (God mode vendor detail) | Source | Notes |
|---|---|---|
| **They've earned / Gross / My income** | DB: aggregates over `transactions` for that vendor | All-time. Filtered to `status IN ('paid','released','partially_refunded')` — released ones still count. |
| **On their Stripe account (LIVE)** | `stripe.balance.retrieve({ stripeAccount })` | Same source as the vendor's own view. Ensures god mode + vendor can't drift. |
| **Paid out / Pending / Failed** | DB: `payouts` aggregated by status | Mirrors what Stripe webhooks have told us. |
| **Waiting to release** | DB: redeemed claims + paid transactions + no `stripe_transfer_id` | Same query as vendor's "Queued for transfer." |

---

## What we can refund, when, and how

Refunds are still **un-built** (this is a known gap, tracked in [`CREDITS_AND_FEES.md` §7](./CREDITS_AND_FEES.md) build order). The mechanics will be:

| Scenario | Mechanism | Cost |
|---|---|---|
| Customer cancels **before redemption** | `stripe.refunds.create({ payment_intent })` on the original charge. Voucher → `'cancelled'`. **No vendor involvement** — they were never paid. | Stripe keeps the ~30¢ processing fee. Gloē eats it. |
| Vendor comps customer **after redemption** | First `stripe.transfers.createReversal()` (clawback from vendor's Connect balance), then `stripe.refunds.create()`. Voucher stays `'redeemed'`, transaction → `'refunded'`. | Vendor's payout is reduced. Gloē keeps the platform fee unless explicitly waived. |
| Vendor refuses to honor a redeemed voucher (no-show, vendor-side fault) | Same as above but Gloē-initiated. Need ToS clarity here. | TBD. |
| Customer disputes via card chargeback | Stripe handles. We get `charge.dispute.created`. Need to build response flow. | $15 dispute fee + whatever Stripe rules. |

**Why post-redemption refunds need vendor consent in the UX:** the `transfers.createReversal` is a clawback from money the vendor already has on their Connect account. Doing it unilaterally is the kind of thing that gets marketplaces sued. Vendor-initiated → they're consenting to give the money back.

---

## The Stripe dashboard mental model

For founder/engineering reference — what to check where:

### Platform dashboard ([dashboard.stripe.com](https://dashboard.stripe.com))
- **Payments:** every customer charge (PaymentIntent). Stage 1.
- **Connect → Transfers:** every Transfer we initiated. Stage 2.
- **Connect → Applications:** application fees Stripe collected for us (instant-payout fees).
- **Balance:** Gloē's platform balance. Customer money pre-transfer + fees we kept + recouped instant-payout fees.
- **Settings → Connect → Pricing schemes:** the 3% Instant Payout scheme is here. Editable.

### Connected-account dashboard (per vendor)
- Express Dashboard URL: generated by `accounts.createLoginLink(accountId)`. We expose this to vendors as "Open Stripe dashboard" in their Settings.
- Shows: their Connect balance, their bank/debit-card info, their payouts, their tax docs.
- Does NOT show: Gloē's platform fee on their bookings (because Stripe doesn't know about it).

### Stripe API surface we use ([apps/api/src/domain/stripe.ts](apps/api/src/domain/stripe.ts))
- `accounts.create` — vendor Connect onboarding
- `accountLinks.create` — hosted onboarding URL
- `accounts.createLoginLink` — Express dashboard URL
- `accounts.retrieve` — pull status (capabilities, payouts_enabled)
- `accounts.listExternalAccounts` — check for debit card (instant-payout eligibility)
- `paymentIntents.create` — Stage 1 charge
- `transfers.create` — Stage 2 release on redemption
- `transfers.createReversal` — refund clawback (not yet built)
- `payouts.create({ method: 'instant' })` — Stage 3' instant payout
- `balance.retrieve` — vendor's available Connect balance
- `webhooks.constructEvent` — verify incoming webhooks

---

## The webhooks we listen for

[apps/api/src/index.ts](apps/api/src/index.ts) → `POST /webhooks/stripe`

| Event | Handler | Effect |
|---|---|---|
| `account.updated` | `syncVendorStripeStatus` | Updates `vendors.stripe_account_status` based on `payouts_enabled`. |
| `payment_intent.succeeded` | `fulfillPurchase` | Flips `transactions.status='paid'`, creates `claims` rows, bumps `spots_claimed`. |
| `payout.created` | `handleStripePayoutWebhook` | Inserts `payouts` row with `status='pending'`. |
| `payout.paid` | same | Updates row to `status='paid'`, sets `arrived_at`. |
| `payout.failed` | same | Updates row to `status='failed'`, stores `failure_message`. Triggers vendor-facing red banner. |
| `payout.canceled` | same | Updates row to `status='cancelled'`. |

**Webhooks we should listen for but don't yet:**
- `charge.refunded` — to mirror refund state into `transactions`. Comes with the refunds build.
- `charge.dispute.created` / `.closed` — chargeback workflow. Future.
- `transfer.reversed` — for refund clawback observability. Comes with the refunds build.

---

## Common confusions, resolved

**Q: How does Stripe Connect know how much we take from each booking?**
A: It doesn't, for the platform fee. We compute the fee in our DB at checkout and only *transfer the smaller, post-fee amount* to the vendor. Stripe just sees a charge and a smaller transfer. (It does know about the 3% instant-payout fee, because we configured that as a dashboard pricing scheme.)

**Q: Why does the vendor's Stripe dashboard show $176 and not $200?**
A: The vendor only ever sees what's transferred to them. They have no visibility into the $200 customer charge — that's between Gloē and the customer. From the vendor's perspective: a customer came in with a voucher, and Gloē sent them $176.

**Q: If the money already left our hands, can we charge a 3% fee on instant payouts?**
A: Yes. The mechanism is **application_fee_amount on the payout call** (auto-applied by the Stripe Dashboard pricing scheme). Stripe collects it *during* the same payout API call, before the rest hits the debit card. The "money has already left our hands" intuition is right for the Transfer in Stage 2 but wrong for the Payout in Stage 3'.

**Q: Can a misrouted Transfer ever send money to the wrong vendor?**
A: Not from our code. The destination Stripe account is derived server-side via 4 primary-key joins: `claimId → deals.vendor_id → vendors.stripe_account_id`. The caller cannot influence the destination. The only way money goes to the wrong place is if `vendors.stripe_account_id` itself is wrong — which means a vendor onboarded with the wrong Stripe account, which is on them (KYC + bank info goes through Stripe directly, not through us).

**Q: Why are there two FKs (`claims.transaction_id` AND `transactions.claim_id`)?**
A: Historical drift. Only `claims.transaction_id` is populated by `fulfillPurchase`. The other column exists in the schema and is unused. **All queries must JOIN via `transactions.id = claims.transaction_id`.** The other direction silently returns 0 rows. (This was a real bug, fixed 2026-05-23.)

---

## Operating the system day-to-day

| Situation | Where to look |
|---|---|
| A vendor says "I haven't been paid" | God mode → their vendor detail → "On their Stripe account (LIVE)" + "Paid out" + "Failed payouts." Compare to what they're seeing in their Express dashboard. |
| A customer says "I was charged but no voucher" | Check `transactions.status` for their PaymentIntent. If `pending_payment` → webhook didn't fire (rare, retry). If `paid` → check `claims` for the row. |
| Reconciling Stripe's books vs ours | Per-vendor: god mode shows our DB state next to Stripe's live balance. Discrepancy = something is wrong; investigate before doing anything else. (Nightly reconciliation job is in the spec, not yet built.) |
| Releasing held money for a vendor | God mode → their vendor detail → Release controls → either flip "Auto-release on redemption" on (default) or click "Push" per held row. |
| A vendor's payout failed | Red banner in their Hub + god mode's "Failed payouts" tile. Direct them to fix bank info in their Stripe Express dashboard. |
| Test-mode money looks stuck "pending" | Test-mode payments take ~2 days to move from `pending` to `available` Stripe balance. Use test card `4000000000000077` ("bypass pending") to top up the platform's available balance immediately. |
