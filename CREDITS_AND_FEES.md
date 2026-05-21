# Gloē — Fees & Credit Loyalty System

> Status: **SPEC / not built yet.** Credits ride on top of the Stripe Connect
> checkout + payout flow, which does not exist yet. Build order: **payments
> first, then this.** This doc locks the *structure*; the exact numbers live in
> config (`platform_fees` table) and stay tunable without code changes.

---

## 1. Platform fee structure

Three tiers, keyed to the deal price the consumer pays. The top tier is a **flat
cap** — a deliberate sales weapon ("we never take more than $60, even on your
$800 packages"). Numbers are intentionally fair at launch to win vendor yes's
(cold-start matters more than per-booking revenue right now); they can be raised
later for *new* vendors while grandfathering early adopters.

| Deal price (consumer pays) | Platform fee |
|---|---|
| Under $100 | **10%** |
| $100 – $499.99 | **12%** |
| $500+ | **flat $60** (cap) |

- Lives in `public.platform_fees` (already a config table: `min_cents`,
  `max_cents`, `percent_bps`, `flat_cents`, `min_fee_cents`, `active`, date
  ranges, optional per-`vendor_id` override).
- A booking snapshots the fee row used into `transactions.platform_fee_snapshot`
  so historical bookings stay correct even if fees change later.
- **Current DB rows are stale** (8/9/11/13%) — update `platform_fees` to the
  table above when building.

**Examples**
- $80 facial → fee $8 (10%) → vendor gets $72
- $200 Botox → fee $24 (12%) → vendor gets $176
- $800 filler package → fee $60 (flat) → vendor gets $740 (effective 7.5%)

---

## 1b. Instant payouts (vendor perk + small profit line)

Standard payouts land in the vendor's bank in ~2 business days (free, default).
**Instant Payout** pushes money to the vendor's **debit card** in ~30 minutes
(incl. weekends) — a real selling point vs. Groupon's slow pay.

- **Vendor opts in** per payout (or sets it as their default). Requires a debit
  card on the connected account (Express supports adding one).
- **Fee: Gloē charges the vendor 2.5%** of the instant payout amount.
  - Stripe's instant-payout cost is ~1.5% (min ~$0.50) → **Gloē keeps ~1%.**
  - So instant payouts are a small **profit** line, not a pass-through cost.
- Eligibility is gated by Stripe (account standing) — not guaranteed day one.
- **Build phase:** payout phase (with checkout), not onboarding — nothing to pay
  out until money flows. Track instant-payout fees charged vs. Stripe cost in the
  admin dashboard so the ~1% margin is visible.

## 2. Credit loyalty loop (the retention weapon)

**The idea:** every completed booking earns the consumer a **vendor-specific**
credit toward their *next* visit with that same vendor. Credit lives in the app,
so the next booking happens through Gloē too. Vendor retains their client, Gloē
retains the user, and redemption generates another booking fee.

### Two independent credit buckets

Tracked **separately** so we always know what Gloē owes vs. what the vendor owes
(critical for accounting + Stripe reconciliation).

| Bucket | Funded by | Default amount | Comes out of |
|---|---|---|---|
| **Platform credit (Gloē)** | Gloē | $2.50 (deals < $500) · $10 (deals ≥ $500) | Our platform-fee revenue |
| **Vendor credit** | Vendor (opt-in) | Whatever the vendor sets | Vendor's payout |


**Scope (decided):**
- **Platform credit is ONE pool, usable at ANY vendor.** All her $2.50/$10
  earnings pool into a single Gloē balance she can spend on any deal. This is
  the strongest "stay inside Gloē" pull. (`credit_ledger.vendor_id` is **null**
  for platform rows.)
- **Vendor credit is per-vendor, locked.** Earned at Badia → spendable at Badia
  only. (`credit_ledger.vendor_id` set.)

- Both amounts shown on **every deal card** before booking — and the **scope of
  each must be labeled**, never blended into one total (or she'll assume it's all
  vendor-locked):
  > 💎 **$10 Gloē credit** — use at *any* spa on Gloē
  > 🏪 **$5 Badia credit** — use at Badia only
  Showing the Gloē credit as "use anywhere" makes it feel more valuable AND
  reinforces staying inside Gloē. The card returns both numbers split, each with
  its scope; the front end never shows a single merged "$15".

### Earning — fires on REDEMPTION, not purchase (per voucher)

Credit is allocated when a `claims` row flips to `status = 'redeemed'`
(`redeemed_at` set via the QR scan at the appointment) — **not** when she pays.

> **Why:** prevents buy-then-refund credit farming. She only earns it once she
> actually shows up.

**Quantity = credit per voucher.** Buying quantity N creates N separate
vouchers; credit is earned **per redeemed voucher**. So buy 2 → redeem 2 →
earn the credit **twice** (2 × $2.50 Gloē, + 2 × vendor credit if offered).
Buy 2, redeem 1 → earn once now, the rest only if/when the 2nd voucher is
redeemed. Falls out naturally from per-voucher redemption — no quantity math.

### Spending — the consumer CHOOSES at checkout

At checkout we show her available, applicable, unexpired credit as **two
independent options she controls** — she is never force-applied:

- **Gloē pool** (usable here) — toggle on/off
- **[This vendor] credit** (locked to them) — toggle on/off
- She can use **one, both, or neither (stack for next time)**.
- A running total shows: *"Gloē $5.00 + Badia $5.00 = $10.00 available · applying
  $10.00 → you pay $X"*.

When applied, the split is recorded per booking:
- `platform_credit_applied_cents` — **our cost** (comes off our fee).
- `vendor_credit_applied_cents` — **vendor's cost** (comes off their payout).
  Each bucket funded by whoever issued it. No fixed waterfall — she picks which
  bucket(s) to apply.

### Expiry

Credits expire **12 months** after they're earned. Limits long-term liability,
still generous. Expiry writes a ledger entry (see below) so balance stays
accurate and the liability comes off the books.

---

## 3. Data model (fits the existing schema)

Money flow today: `claims` (the voucher: `status`, `redeemed_at`) →
`transactions` (the money: `consumer_paid_cents`, `platform_fee_cents`,
`vendor_payout_cents`, `status`). Credits attach to both.

### New table: `credit_ledger` (append-only)

Every credit movement is a row. **Balance is derived by summing the ledger** —
never stored as a mutable column (avoids corruption, gives a full audit trail
for reconciliation + outstanding-liability reporting).

```
credit_ledger
  id                uuid pk
  user_id           uuid  -> users.id      (whose wallet)
  vendor_id         uuid  -> vendors.id    NULL for platform pool, set for vendor credit
  source            text  -- 'platform' | 'vendor'
  kind              text  -- 'earn' | 'redeem' | 'expire' | 'adjust'
  amount_cents      int   -- +earn, -redeem, -expire (signed)
  claim_id          uuid  -> claims.id        (the booking that earned it; null for expire)
  transaction_id    uuid  -> transactions.id  (the booking it was earned/spent on)
  expires_at        timestamptz  -- only on 'earn' rows; drives the expiry sweep
  created_at        timestamptz
```

Balances (derived, never stored):
- **Gloē pool** = `SUM(amount_cents) WHERE source='platform' AND user_id=? AND not expired`
- **Per-vendor** = `SUM(...) WHERE source='vendor' AND user_id=? GROUP BY vendor_id`

The Credits tab reads exactly these two queries.

### New columns on `transactions`

```
platform_credit_earned_cents   int   default 0   -- $2.50 / $10 we issued on this booking
vendor_credit_earned_cents     int   default 0   -- vendor's opt-in amount on this booking
platform_credit_applied_cents  int   default 0   -- our credit she SPENT on this booking
vendor_credit_applied_cents    int   default 0   -- vendor credit she SPENT on this booking
```

So per booking we see both what it *generated* and what it *consumed*, split by
who funds it. `consumer_paid_cents` is what she actually charged after credit;
the credit applied is reconciled against our fee / the vendor payout accordingly.

### New columns on `deals` (vendor opt-in credit)

```
vendor_credit_cents   int   default 0   -- extra credit this vendor adds per booking (0 = none)
```
(Platform credit is computed from deal price at booking time — not stored on the deal.)

---

## 3b. Front-end surfaces (what the consumer sees)

**Deal card (Discover + detail):** shows the earnable credit split, e.g.
*"Earn $2.50 Gloē + $5 Badia"*. → `deals.list` / `deals.byId` return
`platformCreditCents` (computed from price) and `vendorCreditCents`
(`deals.vendor_credit_cents`) so the card renders the breakdown with no client math.

**Tab change:** replace the **Messages** tab with **"Wallet"** (Vouchers / Credits),
two sub-tabs:
- **Vouchers** — deals she's bought = active `claims` with their QR codes to redeem.
- **Credits** — her wallet:
  - **Gloē** balance (one number, the pool).
  - **Per-vendor** list (Badia $5, MiBotox $10…). Tap a vendor → that vendor's
    listings (route to deal list filtered by `vendor_id`) — drives her back to browse.

**Checkout choice (the retention hook):** before paying, show the two credit
options as independent toggles + a running total, and let her **use one, both,
or neither (stack for next time)**. Back end exposes a `checkout.creditPreview`
that returns: Gloē pool applicable, this-vendor credit applicable, and the max
that can apply to this deal price.

## 4. Lifecycle (end to end)

1. **Browse** — deal page shows total earnable credit (platform computed + vendor opt-in).
2. **Buy** — `transaction` created; credit is *recorded as pending* but **not yet in the wallet**.
3. **Redeem at appointment** — QR scan flips `claim.status = 'redeemed'` →
   ledger gets `earn` rows (platform + vendor), `expires_at = now + 12mo`.
4. **Next booking with that vendor** — checkout offers available credit;
   applied amounts deducted, ledger gets `redeem` rows, transaction columns set.
5. **Unused after 12mo** — expiry job writes `expire` rows; balance drops off.

---

## 5. Admin / accounting (god-mode dashboard)

The admin console must surface, from the ledger:
- **Total platform credit issued** (our cumulative cost)
- **Total vendor credit issued** (per vendor)
- **Total redeemed** vs **outstanding liability** (unredeemed, unexpired)
- Per-vendor: credit issued, redeemed, outstanding
- **True net per booking** = `platform_fee_cents − platform_credit_earned_cents`
  (+ the second-booking value when credit drives a return visit — track redemption rate)

> **Honest note:** credits are a **liability and a bet**, not free marketing.
> Net "≈$23.50/booking" assumes the credit drives a *net-new* booking. Some
> credits redeem on a visit she'd have made anyway; some never redeem. Track
> **redemption rate** and **credit-driven repeat-booking rate** obsessively once
> live — those two numbers tell you if the loop actually pays for itself.

---

## 6. Terms & liability (PRODUCT rules — legal doc is a separate pre-launch task)

> Gloē is a **marketplace platform** connecting consumers with independent
> businesses. It does **not** provide medical/aesthetic services and is not the
> provider of record. These are the *product behaviors* the credit system must
> enforce; the actual enforceable Terms of Service must be **drafted/reviewed by
> a lawyer before launch** — especially given the medical/aesthetic space and
> the fact that Gloē holds funds via Stripe Connect (consumer-protection law may
> still impose obligations regardless of disclaimers).

Rules to bake into the system:
- **Credits have no cash value** and are non-transferable; they expire **12 months**
  after earning.
- **Vendor credit** is an incentive offered by and redeemable **only with that
  vendor**. If a vendor **leaves the platform or goes out of business, their
  vendor credit becomes unredeemable** — Gloē is not liable to reimburse it.
  (Surface this clearly in the Credits tab + at earning time.)
- **Gloē (platform) credit** is always redeemable **platform-wide** at any active
  vendor — so it never becomes stranded by a single vendor leaving. (This is the
  customer-friendly answer to "what happens to my credit if my spa closes.")
- Gloē is **not liable** for a vendor's service quality, conduct, business
  continuity, or for treatments performed — vendors are independent licensed
  providers. (The deal fine-print disclaimer already states a version of this.)
- Refund / dispute handling for a paid-but-unhonored booking is governed by the
  payments flow + ToS, **not** the credit system — flag for the Stripe work.

## 7. Build order (do NOT build out of sequence)

1. ✅ **Stripe Connect onboarding** (Express, hosted) — DONE. Vendor connects
   their bank; `vendors.stripe_account_status` syncs via `account.updated` webhook.
2. **Stripe Connect checkout + payout flow** (prerequisite — no credits without it).
   - Includes: charge buyer → hold on platform → fee split → transfer to vendor.
   - **`payout.failed` webhook** → write `payouts.status='failed'` + `failure_message`.
     The admin vendor-detail page already renders failed payouts + reasons — just
     needs this handler to populate them.
   - **Instant payouts** (§1b): vendor opt-in, charge 2.5%, ~1% margin over Stripe.
3. **QR redemption** (`claim.status -> redeemed`) — the earn trigger.
4. Then: `credit_ledger` + transaction/deal columns → earn on redemption →
   display on deal page → apply at checkout → expiry sweep → admin reporting.
5. **Terms of Service + privacy policy** — lawyer-reviewed — before taking real money.
