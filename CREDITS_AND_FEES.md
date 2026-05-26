# Gloē — Fees & Credit Loyalty System

> Status: **SPEC / not built yet.** Credits ride on top of the Stripe Connect
> checkout + payout flow, which does not exist yet. Build order: **payments
> first, then this.** This doc locks the *structure*; the exact numbers live in
> config (`platform_fees` table) and stay tunable without code changes.
>
> **For the operational money pipeline (charge → transfer → payout → instant
> payout), see [MONEY_FLOW.md](./MONEY_FLOW.md).** This doc is the *policy*
> spec; that one is the *plumbing*.

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
- **Fee: Gloē charges the vendor 3%** of the instant payout amount.
  (Configured as the platform's default instant-payout application-fee
  scheme in the Stripe Dashboard on 2026-05-23. Was 2.5% in the original
  draft; bumped to 3% on save — slightly above market (Square/Toast at
  ~1.5-1.75%) but defensible by the "we pay fast" positioning.)
  - Stripe's actual instant-payout cost on USD payouts is **1% flat** (no
    minimum fee). Verified against Stripe Docs 2026-05-22 — "Stripe charges
    marketplaces and platforms a 1% fee for all Instant Payouts."
  - Stripe's $0.50 USD floor is a minimum *payout amount*, not a minimum
    *fee*. Don't conflate them.
  - Net: **Gloē keeps 2%** on every instant payout (3% − 1.0%).
- The scheme is *default* — it applies to every Connect account that doesn't
  have a customized scheme. If we later want to discount instant payouts for
  anchor vendors ("Badia gets 1% instant"), we set them a custom scheme on
  the Stripe side. No code change needed.
- Eligibility is gated by Stripe (account standing) — not guaranteed day one.
- **Build phase:** payout phase (with checkout), not onboarding — nothing to pay
  out until money flows. Track instant-payout fees charged vs. Stripe cost in the
  admin dashboard so the ~1.5% margin is visible.

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

---

## 6b. Money flow — charge, transfer, payout, refund

This section captures the **operational money decisions** that sit underneath
credits but are independent of them. We're locking these one at a time; each
sub-section is dated when it's confirmed.

### § Payout timing — *paid on redemption, not on purchase* (locked 2026-05-22)

**Decision:** A vendor is paid when (and only when) a `claims` row flips to
`status = 'redeemed'`. Until then, the customer's money sits on the Gloē
Stripe platform balance — it's contingent, not vendor money.

**Why:**
- The service hasn't been delivered until the vendor scans the QR. Paying
  earlier means clawing money back from the vendor's bank if the customer
  no-shows, cancels, or disputes — exactly the operation that gets Connect
  platforms suspended.
- Holding funds until redemption lets Gloē refund cleanly (refund the
  PaymentIntent, no transfer reversal needed) for the common case of a
  pre-redemption cancel.
- Matches what the codebase already does: `apps/api/src/domain/checkout.ts`
  creates a PaymentIntent with **no** `transfer_data` / `on_behalf_of` — funds
  stay on the platform. The missing piece is the transfer-on-redemption step.

**Two-step Stripe flow (terms matter — they're different events):**

1. **Charge.** Customer pays Gloē. PaymentIntent succeeds. Money on platform
   balance. Already built.
2. **Transfer** (we trigger, on redemption). `stripe.transfers.create({
   amount: vendor_payout_cents, destination: vendor.stripe_account_id,
   transfer_group: claim.id })`. Money moves: platform balance →
   vendor's connected-account balance. **Not yet in their bank.**
3. **Payout** (Stripe automates, per vendor's Express payout schedule, default
   daily). Money moves: connected-account balance → vendor's bank. We don't
   trigger this — Stripe does — we just *observe* it via the
   `payout.created` / `payout.paid` / `payout.failed` webhooks and mirror to
   our `payouts` table.

So "vendor got paid" colloquially = step 3, but the action we own is step 2.

**Implication for refunds:**
- **Pre-redemption refund** = no transfer happened yet → just refund the
  PaymentIntent. Cheap and clean.
- **Post-redemption refund** = transfer already happened → need a `Transfer
  Reversal` (clawback from vendor's connected account) **before** refunding
  the PaymentIntent. This is the messy case and informs why post-redemption
  refunds should be vendor-initiated (they're explicitly consenting to the
  clawback) — to be confirmed in the refund policy sub-section.

**How to apply during build:**
- The redemption endpoint (when it stops being a dev stub) must do *three*
  things atomically-ish: flip claim status → create Stripe Transfer → log to
  our DB (transactions, payouts metadata). If the Transfer fails (vendor's
  Connect account disabled, etc.), the redemption must NOT silently succeed —
  surface it as an error the vendor can see.
- Never set `transfer_data` on the PaymentIntent at charge time. We are
  explicitly using separate-charge-and-transfer, not destination charges.

### § Release mode — *auto with 24h hold, god-mode override always available* (locked 2026-05-22)

**Decision:** Transfers fire automatically on a delayed schedule, **not** at
the moment the QR is scanned. God mode can always release earlier or block a
release.

**The flow:**
1. Vendor scans QR → `claim.status = 'redeemed'`, `redeemed_at = now`.
   No Stripe Transfer yet. A row is written to a `pending_payouts` view (or
   a `payouts.status = 'held'` row) so the money is visibly *queued*.
2. A cron job runs continuously (every 5–15 min) and picks up redemptions
   whose `redeemed_at` is older than the **hold window** and have no
   matching transfer yet. For each, it runs all the [walls](#walls) below,
   creates the Stripe Transfer, and flips the `payouts` row to `pending` /
   then `paid` when Stripe confirms via webhook.
3. **Default hold window: 24 hours.** Tunable per-vendor or globally in
   admin (column on `vendors` or a setting in `platform_fees`-style config
   table). New vendors get the default; trusted vendors can be set to 0
   (immediate) once we've seen them operate cleanly.
4. **God-mode controls** in the Money tab:
   - **Release now** on any held row — bypasses the wait.
   - **Hold indefinitely** — pauses a release pending investigation
     (suspected fraud, customer complaint, vendor account issues).
   - **Cancel release** — for the refund/reversal case (covered in the
     refund sub-section).

**Why this mode (not full-auto or full-manual):**
- Full-auto on scan = no time to catch a buggy or compromised redemption
  endpoint before money leaves the platform.
- Full-manual approval queue = doesn't scale past ~50 redemptions/day and
  becomes your full-time job. Wrong answer for a marketplace.
- **24h auto with override** gives a real dispute window (customer can
  message "they marked me redeemed but I never went" in time), zero ops
  burden in the happy path, and a manual brake for anything that looks
  off. This is what mature marketplaces actually do (most quietly).

**Launch posture:** for the **first ~50 live redemptions**, set the
default hold to *manual review* — every transfer requires a god-mode click.
Once we've watched the system run cleanly, flip the default to 24h auto.
This is a setting change, not a code change.

### <a id="walls"></a>§ Walls — making sure money goes to the right vendor (locked 2026-05-22)

A misrouted Transfer is a real-money mistake, not a UI bug. Every release
runs these checks server-side before Stripe is called. **Any failure =
refuse and surface in god mode.** No silent skips.

**Authorization wall (at scan time):**
- The authenticated user calling the redemption endpoint must be the
  `vendors.owner_user_id` (or future `vendor_staff`) of the vendor that
  owns the deal. Mismatch = 403. Stops "vendor A scans vendor B's QR."

**Routing walls (at transfer time):**
- The destination connected-account ID is **derived server-side** from
  `claim → deal → vendor → stripe_account_id`. Never accepted from the
  request payload, URL, or header.
- `vendor.stripe_account_status === 'active'` (not pending, not rejected,
  not disabled). Else: hold and alert.
- `claim.status === 'redeemed'` and no existing `payouts` row for this
  claim. Prevents double-transfer.
- `transactions.status === 'paid'` for the parent purchase. We don't pay
  out money we haven't received.
- `vendor_payout_cents > 0`. Sanity.
- Stripe **idempotency key** = `transfer_for_claim_${claim.id}`. A retry
  or double-trigger can't create two transfers — Stripe enforces it.

**Persistence wall:**
- Every Transfer writes a `payouts` row with `claim_id`, `transaction_id`,
  `vendor_id`, `stripe_transfer_id`, `amount_cents`, `status`, timestamps.
  This is the audit trail. Loss-of-truth is recoverable from Stripe + this
  table, not from code state.

**Reconciliation wall (nightly job):**
- For each connected account, fetch Stripe's transfer list for the last 48h
  and diff against our `payouts` table. Any drift (transfer in Stripe with
  no row in our DB, or vice versa) → alert in god mode. Doesn't prevent
  mistakes; catches them within a day.

**Sanity-cap wall (launch only):**
- Any single Transfer over **$1,000** auto-routes to manual review,
  bypassing the 24h auto-release. Cheap insurance against a runaway bug
  during early operation. Remove the cap (or raise it) once we've watched
  the system run.

**Failure handling:**
- Transfer call to Stripe fails (account disabled, KYC lapsed, debit
  blocked): the redemption stays redeemed (the customer was served), but
  the `payouts` row goes to `status = 'failed'` with the Stripe error
  message. Vendor sees it in their dashboard, god mode sees it in the
  failed-payouts queue. They fix Stripe onboarding, we re-trigger the
  transfer (one button in god mode, also runs every wall above).

### § Vendors tab — Salesforce-style table (locked 2026-05-22)

**Decision:** Replace the current stacked-card layout in `apps/web/src/app/admin/AdminDashboard.tsx` `VendorsView` with a dense, inline, sortable **table** — like Salesforce / Stripe Dashboard's list view. Click a row to expand inline (or push to vendor detail); click a column header to sort.

**Why:**
- The current row layout is friendly but doesn't scale past ~10 vendors.
  At 100+ you can't scan or compare. Tables let you compare vendors at a
  glance — which is the entire point of god mode.
- The data the row already encodes (city, deals, buys, gross, Stripe status,
  license, owner) is column-shaped, not card-shaped. Force it into the
  shape it wants.
- Money tab and this tab share a vendor-row mental model; once one is a
  table, the other should be too.

**Columns (left to right):**

| Col | Source | Notes |
|---|---|---|
| Business name | `vendors.business_name` | Click → vendor detail page |
| City | `vendors.city` | Sortable |
| Deals | count(`deals` where vendor_id) | |
| Buys | count(paid `transactions`) | |
| Gross | sum(`transactions.consumer_paid_cents`) | Sortable |
| Held | sum of `payouts` in held state (redeemed but pre-release) | **New** — connects to release mode above |
| Pending payout | Stripe connected-account `available[0].amount` for vendor | **New** — calls Stripe per row, cache 60s |
| Stripe | `vendors.stripe_account_status` tag | active / pending / rejected |
| License | bool tag | |
| Owner | claimed / unclaimed tag | |
| **Fee %** | `platform_fees.percent_bps` for this vendor's override row, else "—" (global tiers apply) | **Inline editable.** See "Per-vendor fee override" below. |
| Actions | `Open gates`, `Release held`, `Hold all` | god-mode buttons |

**Per-vendor fee override (the inline % column):**

- Each row's `Fee %` cell is **inline editable**. Typing a number (e.g.
  `8.5`) and tabbing out writes a vendor-scoped row to `platform_fees`
  with `vendor_id` set + `percent_bps = 850`. Clearing the cell deletes
  that override and the vendor falls back to the global tiers.
- The override applies to **all of that vendor's deals at all prices** —
  one flat % per vendor, no tiering. (If we later need tiered overrides
  per-vendor, the schema already supports it; we'll cross that bridge
  when there.)
- **Why per-vendor, not global, from this UI:** the global tiers
  (10% / 12% / flat $60) are launch policy and should change rarely and
  deliberately, not from an inline cell that's one mis-click away from
  rewriting everyone's fees. Per-vendor overrides are exactly what the
  marketplace needs to onboard anchor vendors at custom rates ("Badia gets
  8% in year one") without touching policy for everyone.
- Edits are audit-logged (who/when/old%/new%) and surfaced in the vendor
  detail page so we can see fee history. Past `transactions` keep their
  `platform_fee_snapshot` — fee edits never retroactively change historical
  bookings.
- **UI affordance:** show the cell as `12%` (italic, gray) when the row
  is using global tiers; show `8.5%` (bold) when there's an active
  override. Hover shows a tooltip with the effective tier or the override
  date.

**Interaction:**
- **Sort:** click any sortable header → toggles asc/desc. Default sort:
  Gross desc.
- **Filter strip above table:** quick chips for `unclaimed`, `no Stripe`,
  `held > 0`, `failed payouts`. Each chip just narrows the rows.
- **Inline expand:** click a row → expands to a sub-row showing the last
  5 transactions for that vendor + a "View vendor →" link. Click again
  to collapse.
- **Density:** ~32–36px row height. Monospace for numeric columns. Right-
  align money columns. The vibe should be "I am looking at a real system,"
  not "I am looking at a marketing page."

**Don't:**
- Don't put every action in a kebab menu. The 1–2 most-used god actions
  (release held, open gates) belong inline. Everything else lives on the
  vendor detail page.
- Don't drop the "+ Add a spa" button — keep it in the page header.

## 7. Build order (do NOT build out of sequence)

> **State as of 2026-05-22** (after codebase audit). Status reflects what's
> actually in the repo, not what the earlier draft assumed. Credits = step 5;
> we are between steps 2 and 3.

### Step 1 — ✅ Stripe Connect onboarding (DONE)
Vendor connects bank via hosted Express onboarding;
`vendors.stripe_account_status` syncs via `account.updated` webhook.
- Code: `apps/api/src/domain/vendorStripe.ts` (`startVendorOnboarding`,
  `syncVendorStripeStatus`), webhook wired in `apps/api/src/index.ts`.

### Step 2 — ⚠️ Stripe Connect checkout + payout (HALF DONE)

**Done:**
- Consumer checkout: `apps/api/src/domain/checkout.ts` →
  PaymentIntent created, `transactions` row written `status='pending_payment'`,
  fee snapshotted into `transactions.platform_fee_snapshot`.
- `payment_intent.succeeded` webhook → `fulfillPurchase()` → `transactions.status='paid'`
  + `claims` row(s) created `status='active'` with QR payload.
- Model: **platform holds funds** (no `transfer_data` / `on_behalf_of` at
  charge time) — vendor is paid on redemption, not on charge.

**Still to build (blocks credits):**
1. **Vendor payout on redemption.** When `claims.status` flips to `'redeemed'`,
   create a Stripe `Transfer` to `vendors.stripe_account_id` for
   `transactions.vendor_payout_cents` and write a row to `payouts`. Today the
   `payouts` table exists and the admin reads it, but **nothing writes to it.**
2. **`payout.failed` webhook handler.** Set `payouts.status='failed'` +
   `failure_message`. Admin UI is already wired to render these.
3. **Refund / cancellation flow.** `ClaimStatus` enum already has `'cancelled'`
   but nothing ever sets it. Need:
   - Pre-redemption refund (void or refund the PaymentIntent, mark claim
     `'cancelled'`, mark transaction `'refunded'`).
   - Vendor-initiated "comp / refund" button (post-redemption goodwill).
   - **Credit clawback rule:** if a redeemed claim is later refunded, write an
     `adjust` row to `credit_ledger` that nets out the earned credit. Prevents
     refund-farming.
4. **Instant payouts** (§ 1b). Vendor opt-in, 2.5% fee, ~1% margin over Stripe.

### Step 3 — ⚠️ QR redemption (DEV STUB ONLY)

**Done:**
- `claims.status` machine, `redeemed_at`, `qr_payload`, `human_code` columns.
- `apps/api/src/domain/claims.ts` → `devMarkRedeemed()` flips a claim by id.
  Comment in code: *"until the vendor app exists."*

**Still to build:**
1. **Vendor-side scanner.** Either a vendor mobile screen or a vendor-portal
   web page that scans the QR (or accepts the `human_code`) and POSTs to a
   real, auth'd endpoint — not the dev stub.
2. **Auth'd redemption endpoint** that verifies the scanning user belongs to
   the vendor that owns the deal before flipping status.

### Step 4 — ❌ Fee table refresh (TINY, DO FIRST)

`platform_fees` rows are stale (current DB: 8/9/11/13%). Replace with the spec
table above (10% / 12% / flat $60). One migration, no code changes — fee
selection logic already reads the active row by price + date.

### Step 5 — ❌ Credits (BUILD AFTER 2 + 3)

Once redemption is real and refunds exist, build:
1. `credit_ledger` table + migration (schema in § 3).
2. New columns on `transactions` (4 cents columns, § 3) + `deals.vendor_credit_cents`.
3. **Earn hook** — on real `claims.status = 'redeemed'` flip, insert `earn` rows
   (platform pool + vendor) with `expires_at = now + 12mo`.
4. **`checkout.creditPreview`** tRPC procedure — returns available Gloē pool +
   per-vendor credit applicable to a given deal/quantity.
5. **Checkout apply path** — two independent toggles, write `redeem` ledger
   rows, populate `platform_credit_applied_cents` / `vendor_credit_applied_cents`,
   adjust the PaymentIntent amount.
6. **Expiry sweep** — daily job that writes `expire` rows for ledger entries
   past `expires_at`.
7. **Mobile Wallet tab** — replace `messages` (currently mock-only) with
   `wallet` (Vouchers + Credits sub-tabs).
8. **Deal card credit chips** — `deals.list` / `deals.byId` return
   `platformCreditCents` (computed) + `vendorCreditCents`.
9. **Admin reporting** — outstanding liability, redemption rate, per-vendor
   issued/redeemed/outstanding.
10. **Refund clawback** wired in (see step 2.3 above).

### Step 6 — ❌ ToS + privacy policy (BEFORE REAL MONEY)

Lawyer-drafted, especially the medical-services disclaimer and the dispute
policy (Gloē facilitates, doesn't arbitrate clinical outcomes).
