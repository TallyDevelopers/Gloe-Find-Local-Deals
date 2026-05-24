# Gloē — Payment Processing Test Scenarios

> Manual end-to-end test plan for the money pipeline. Run these against a clean DB before any "we're going live" claim.
>
> See [MONEY_FLOW.md](./MONEY_FLOW.md) for how the system works, and [CREDITS_AND_FEES.md](./CREDITS_AND_FEES.md) for the policy spec.

---

## Prerequisites

Before running scenarios:

- [ ] **Clean DB.** Run a wipe (`DELETE FROM payouts; DELETE FROM claims; DELETE FROM transactions; UPDATE deal_variants SET spots_claimed=0;`). Confirm $0 everywhere via `/admin`.
- [ ] **Stripe in test mode.** All STRIPE_* env vars point to test keys. Confirm with `dashboard.stripe.com/test`.
- [ ] **Stripe webhooks listening locally.** `stripe listen --api-key $STRIPE_SECRET_KEY --forward-to localhost:4000/webhooks/stripe`. Re-paste the signing secret into `apps/api/.env` (`STRIPE_WEBHOOK_SECRET`) and restart the API.
- [ ] **Test Vendor Spa active.** `acct_1TZciSPaVOuerUKV`, `stripe_account_status = 'active'`. Has at least one active deal posted.
- [ ] **Auto-release toggle** state noted (default ON). Per-scenario instructions below assume default unless stated.
- [ ] **Instant-payout pricing scheme** confirmed in Stripe Dashboard at 3%.
- [ ] **Two browser sessions ready:** Chrome logged in as `husseinmsaab@gmail.com` (god mode); incognito or Safari logged in as `vendor@gloe.app`.
- [ ] **Customer device:** the mobile app on simulator or device, signed in as a non-admin user.

**Top up the platform's test-mode available balance** so transfers can fire (test-mode card payments sit in *pending* for ~2 days):

```js
// One-off snippet — run from apps/api/
stripe.charges.create({ amount: 200000, currency: 'usd', source: 'tok_bypassPending' });
```

Or `curl` equivalent. Run once at the start of a test session.

---

## How to read each scenario

Every scenario has the same shape:

- **Goal:** what we're verifying.
- **Setup:** any state we need beyond the prerequisites.
- **Steps:** numbered actions.
- **Expected:** what should be true after each step / at the end. **Checklists are pass/fail.**
- **Where to look:** the DB tables, Stripe dashboards, and UIs where evidence lives.

If a scenario fails, capture: which step failed, what you saw, the state of the relevant DB rows, and the relevant Stripe event ID. Don't paper over — fix the underlying bug.

---

## 1. Happy path — purchase → redeem → auto-transfer → standard payout

**Goal:** Verify the full standard flow end-to-end with auto-release ON. This is *the* core scenario; everything else is variations.

**Setup:**
- Test Vendor Spa has `auto_release_on_redemption = true` (default).
- Platform fee for $200 deal = 12% per the active tier (= $24 fee, $176 to vendor).

**Steps:**

1. Customer opens the mobile app, browses, finds the Test Vendor Spa $200 Botox deal, taps Buy.
2. Customer completes Apple Pay / test card checkout.
3. Customer's voucher appears under "Claimed."
4. Vendor scans the QR (or for now: dev-redeem endpoint hits the same flow).

**Expected after step 2 (purchase succeeds):**
- [ ] Customer sees voucher in their app, status `active`.
- [ ] Gloē platform Stripe balance: +$200 (pending, becomes available ~2 days).
- [ ] DB: `transactions` row, `status='paid'`, `consumer_paid_cents=20000`, `platform_fee_cents=2400`, `vendor_payout_cents=17600`, `stripe_transfer_id` NULL.
- [ ] DB: `claims` row, `status='active'`, `transaction_id` set, QR + human code generated.
- [ ] God mode `/admin`: Overview count went up by 1, gross +$200, income +$24.
- [ ] God mode vendor detail: Gross +$200, They've earned +$176, My income +$24. Waiting to release = 0 (still active).
- [ ] Vendor Hub: Today shows "$200 sold · 1 sale", "1 active voucher" with the right expiry.

**Expected after step 4 (redemption with auto on):**
- [ ] DB: `claims.status='redeemed'`, `redeemed_at` populated.
- [ ] DB: `transactions.status='released'`, `stripe_transfer_id` set, `released_at` populated.
- [ ] Stripe Transfer fired to `acct_1TZciSPaVOuerUKV` for $176. Visible in Stripe Dashboard → Connect → Transfers.
- [ ] Vendor's Connect available balance: +$176 (live read in both god mode "ON THEIR STRIPE ACCOUNT (LIVE)" tile AND the vendor's own Hub "In your Stripe account" tile).
- [ ] Vendor Hub: 1 redeemed today, 0 active, voucher hops to Redeemed tab.
- [ ] God mode "Waiting to release" stays 0 (auto fired).
- [ ] No `payouts` row yet — that comes when Stripe initiates the standard daily ACH.

**Where to look:**
- DB: `SELECT id, status, stripe_transfer_id, released_at FROM transactions WHERE vendor_id=?`
- Stripe: dashboard.stripe.com/test/payments + /connect/transfers + connected acct dashboard
- UI: `/admin/vendor/[id]` + vendor portal `/vendor` Hub

---

## 2. Manual release — auto-release OFF + Push button

**Goal:** Verify that with auto-release OFF, money sits queued until god mode clicks Push.

**Setup:**
- God mode: flip Test Vendor Spa's "Auto-release on redemption" toggle to OFF.

**Steps:**

1. Customer purchases another $200 voucher.
2. Customer redeems.
3. **Observe:** no Transfer happens immediately.
4. God mode: click **Push** on the held row.

**Expected after step 2 (redemption, no auto):**
- [ ] DB: `claims.status='redeemed'`.
- [ ] DB: `transactions.status='paid'` (NOT released).
- [ ] `transactions.stripe_transfer_id` NULL.
- [ ] Vendor Hub Money card: "Queued for transfer: $176.00 · 1 voucher".
- [ ] God mode vendor detail Release controls: "Waiting to release · 1 · $176" with a Push button.

**Expected after step 4 (Push):**
- [ ] Transfer fires (same end-state as Scenario 1 step 4).
- [ ] Held queue clears to 0.

**Failure mode to verify (optional):**
- Flip "Auto" OFF, redeem, then BEFORE clicking Push, suspend the vendor.
- Pushing should refuse with "Stripe account status is suspended" (wall test).

---

## 3. Customer purchases multiple vouchers in one order (quantity > 1)

**Goal:** Verify multi-quantity correctly creates multiple claims, each is independently redeemable, and each fires its own Transfer.

**Setup:**
- Auto-release ON.

**Steps:**

1. Customer buys quantity = 3 of the $80 facial deal.
2. Customer redeems voucher #1.
3. Customer redeems voucher #2.
4. Customer lets voucher #3 sit unredeemed (will hit Scenario 6 later).

**Expected after step 1:**
- [ ] **One** `transactions` row, `consumer_paid_cents=24000` (3 × $80).
- [ ] Platform fee = 10% on the combined $240, so $24 fee, $216 vendor payout. (Tier match should be the $100–$499 tier since $240 falls in there — actually wait, $240 is in the 12% tier.) **Verify:** which tier did `computeFee` pick? Check `transactions.platform_fee_snapshot`.
- [ ] **Three** `claims` rows, each `status='active'`, each pointing at the same `transaction_id`.
- [ ] `deal_variants.spots_claimed += 3`.

**Expected after step 2 (first redemption):**
- [ ] Voucher #1 status → redeemed.
- [ ] **Transfer fires for the FULL vendor_payout_cents** ($216, the whole thing).
- [ ] `transactions.status='released'`.
- [ ] Vouchers #2 and #3 still active.

**⚠️ KNOWN GAP TO VERIFY:** the current Transfer logic releases the full transaction amount on the FIRST redemption. If the vendor has not redeemed all 3 vouchers but the money is already on their Connect account, that's *probably* what we want (one purchase = one money movement). Confirm this matches expectation, or split logic so each voucher releases its share.

**Action if this is wrong:** decide and document — either split transfers per-voucher (more correct but more complex) or document explicitly that "any single redemption releases the entire transaction's payout."

---

## 4. Customer redeems before vendor's Stripe is fully connected

**Goal:** Verify the walls in `releaseTransferForClaim` protect against money flowing to a half-onboarded vendor.

**Setup:**
- Pick a vendor whose `stripe_account_status='pending'` (e.g. Pacific Beach Aesthetics).
- Admin: post a deal for them using "Open gates" (admin_bypass) so they can have an active deal without Stripe.
- Auto-release ON.

**Steps:**

1. Customer buys the deal.
2. Customer redeems.

**Expected:**
- [ ] Redemption succeeds — `claims.status='redeemed'`.
- [ ] **Transfer is REFUSED.** `transactions.status` stays `paid` (not released), no `stripe_transfer_id`.
- [ ] Released function threw `TransferRefusedError` with message including "vendor stripe_account_status is pending, expected active". Should be in API logs.
- [ ] Money sits in the held queue on god mode for this vendor (vendor detail "Waiting to release").
- [ ] Customer is unaffected — they got their service redeemed.
- [ ] When vendor finishes Stripe onboarding (`account.updated` webhook → status becomes `active`), god mode can Push the held payout.

---

## 5. Per-vendor fee override

**Goal:** Verify that adding a per-vendor tier overrides the global one for that vendor only.

**Setup:**
- Pick Test Vendor Spa.
- God mode → vendor detail page → at the bottom, Fee tiers editor.
- Add an override tier: min $0, max blank (∞), 8%. Save.

**Steps:**

1. From a *different* user account, buy a $200 deal from a *different* vendor (still on global tiers).
2. From your customer account, buy a $200 deal from Test Vendor Spa (8% override).

**Expected:**
- [ ] Different vendor's transaction: `platform_fee_cents=2400` (12% global).
- [ ] Test Vendor Spa's transaction: `platform_fee_cents=1600` (8% override).
- [ ] Test Vendor Spa's `transactions.platform_fee_snapshot` JSON shows the override tier was used (its label, percent_bps=800).
- [ ] Other vendors' fees are completely unaffected.

**Cleanup:** deactivate the override at the end, otherwise it persists across all subsequent tests.

---

## 6. Voucher expires unredeemed

**Goal:** Verify expired vouchers don't accidentally transfer money to vendors.

**Setup:**
- Manually edit a `claims` row's `expires_at` to 1 minute in the future. (Or: post a deal with `code_validity_days=1` and wait.)

**Steps:**

1. Customer purchases.
2. Wait until the voucher expires (without redeeming).
3. Vendor's sweep job (`sweepExpired` mutation runs on dashboard load) flips it to `'expired'`.

**Expected:**
- [ ] `claims.status='expired'`.
- [ ] `transactions.status='paid'` (NOT released).
- [ ] **No Transfer fires.** Money stays on Gloē's platform balance.
- [ ] Vendor Hub: voucher appears under Past tab, marked "Expired".
- [ ] Voucher does NOT appear in "Waiting to release" — it's not redeemed, so it never queued.

**Open policy question (NOT YET BUILT):**
- Should we auto-refund the customer for expired vouchers?
- Should we keep the money (forfeit policy, common in deal-marketplace TOS)?
- Should we convert to a Gloē credit?

This is in [CREDITS_AND_FEES.md §6](./CREDITS_AND_FEES.md) as an open question. Document the call before launch.

---

## 7. Refund flow (NOT YET BUILT — placeholder)

**Goal:** When built, verify refunds work correctly at every stage of the lifecycle.

**Sub-scenarios to test once built:**

### 7a. Pre-redemption customer-initiated refund
- Customer buys, then cancels before redeeming.
- Expected: refund the PaymentIntent. Voucher → `'cancelled'`. Transaction → `'refunded'`. No vendor involvement (they were never paid).
- Stripe keeps the ~30¢ processing fee; Gloē eats it (policy decision in §6b).

### 7b. Pre-redemption vendor-initiated cancel
- Vendor decides to comp customer for whatever reason before they show up.
- Same flow as 7a but initiated by vendor.

### 7c. Post-redemption refund (vendor comp after service)
- Customer was served. Vendor decides to give a partial or full refund as goodwill.
- Expected: `transfers.createReversal` to claw back from vendor's Connect balance, then `refunds.create` on the PaymentIntent. `claims.status` stays `'redeemed'` (service happened), `transactions.status` → `'refunded'` or `'partially_refunded'`.
- **Vendor consent required** — they're authorizing the clawback.

### 7d. Post-redemption refund WHEN money is already paid out to bank
- Service done, Transfer fired, Stripe automatic payout already deposited to vendor's bank.
- Stripe's `createReversal` can still pull money back — but if the Connect balance is insufficient, the vendor's bank account gets debited. They must have negative balance handling. **Risk to test in production-like conditions.**

### 7e. Customer dispute / chargeback
- Customer disputes the charge with their bank (real-world: claim fraud or "not as described").
- Stripe sends `charge.dispute.created`. We need to respond.
- **Policy:** what's our default response? Submit evidence (the voucher was redeemed) or auto-refund?

**None of 7a–7e is built yet.** This section is a forward-looking checklist for when we get there.

---

## 8. Standard payout (Stripe → vendor bank)

**Goal:** Verify that the `payout.*` webhooks update our `payouts` table correctly, so the vendor's "Paid out · last 7d" tile populates.

**Setup:**
- Test Vendor Spa has at least one completed Transfer (Scenario 1 ran).
- Vendor's available balance > $0 on their Connect account.

**Steps:**

1. In Stripe Dashboard → Connect → connected account → trigger a manual payout for the available balance. (In test mode, automatic payouts don't fire unless you toggle them on, so manual is easier.)
2. Watch the API logs for `payout.created`.
3. Wait for `payout.paid` (test mode: usually instant).

**Expected:**
- [ ] After `payout.created`: DB `payouts` row with `status='pending'`, `amount_cents` matching the payout, `vendor_id` correctly resolved from `stripe_account_id`.
- [ ] After `payout.paid`: same row updates to `status='paid'`, `arrived_at` populated.
- [ ] Vendor Hub: "Paid out · last 7d" tile shows the amount.
- [ ] God mode vendor detail Payouts card: "Paid out" shows the amount.
- [ ] Vendor's Connect available balance drops by the payout amount.

---

## 9. Failed payout (bank issue)

**Goal:** Verify the failed-payout banner / red alerts work for the "vendor entered wrong bank info" case.

**Setup:**
- Add a test bank account to Test Vendor Spa using Stripe's "fail on payout" routing number (`110000000` in test mode, look up exact one in [Stripe docs](https://docs.stripe.com/connect/testing#payouts)).
- Or use the test card token that triggers a failed payout.

**Steps:**

1. Trigger a payout from Stripe Dashboard.
2. Wait for `payout.failed` webhook.

**Expected:**
- [ ] `payouts.status='failed'`, `failure_message` populated.
- [ ] Vendor Hub: red banner appears at the top of Money card — "X payouts failed to reach your bank · Open Stripe".
- [ ] God mode: "Failed payouts" count goes up, the failed-payouts list shows the failure message + date.
- [ ] Clicking "Open Stripe" from either side opens the Express dashboard for the vendor.

---

## 10. Instant payout — happy path

**Goal:** Verify the 3% instant-payout fee works correctly and Gloē keeps the 2% net.

**Setup:**
- Test Vendor Spa has $176 available on their Connect account (run Scenario 1 first to get money there).
- Vendor adds a debit card to their Stripe Express dashboard (test card: `4000056655665556`).
- Vendor toggles Settings → "Enable instant payouts" → ON.

**Steps:**

1. Vendor opens Hub → Money card.
2. **Expected: "Pay yourself now — $176.00 available · 3% fee" appears.**
3. Vendor taps "Pay me now" → confirmation breakdown shows:
   ```
   Payout amount   $176.00
   Fee (3%)         −$5.28
   You receive     $170.72
   ```
4. Vendor taps "Confirm payout."
5. Wait ~30 sec → `payout.paid` webhook.

**Expected:**
- [ ] `stripe.payouts.create({ method: 'instant' }, { stripeAccount })` succeeds.
- [ ] DB: new `payouts` row, `status='pending'`, then `'paid'` after webhook.
- [ ] Vendor's Connect balance drops by full $176.
- [ ] Vendor's debit card receives $170.72.
- [ ] **Gloē's platform balance gets +$3.52** (the 2% net of 3% fee, minus Stripe's 1% cost).
- [ ] Stripe Dashboard → Connect → Applications: shows the $5.28 application fee collected (then $1.76 fee charged by Stripe = $3.52 net to Gloē).
- [ ] Vendor Hub "Paid out · last 7d" updates to $170.72.

**Verification math:**
- $176 × 3% = $5.28 application fee
- Stripe 1% cost = $1.76
- Net to Gloē = $3.52 (2% effective)

---

## 11. Instant payout — vendor not eligible (no debit card)

**Goal:** Verify graceful UX when the vendor opts in but has no debit card on file.

**Setup:**
- Use a vendor that has no debit card on their Connect account (default state for fresh Test Vendor Spa).

**Steps:**

1. Vendor goes to Settings → toggles "Enable instant payouts" ON.

**Expected:**
- [ ] Toggle saves (DB: `vendors.instant_payout_enabled = true`).
- [ ] An orange callout appears below the toggle: "One more step — Add a debit card in your Stripe dashboard to enable Instant Payouts."
- [ ] "Open Stripe" button opens Express dashboard.
- [ ] Hub Money card does NOT show "Pay yourself now" inline strip yet (because `eligible=false`).
- [ ] After vendor adds a debit card on Stripe and the page reloads, the orange callout disappears AND (if there's an available balance) "Pay yourself now" appears.

---

## 12. Instant payout — vendor tries with $0 available

**Goal:** Verify the UI doesn't offer instant payout when there's nothing to pay out.

**Setup:**
- Test Vendor Spa with $0 available balance, instant payouts opted in, debit card on file.

**Steps:**

1. Vendor opens Hub Money card.

**Expected:**
- [ ] No "Pay yourself now" strip appears.
- [ ] No "Pay me now" button is reachable from the UI.

---

## 13. Instant payout — server refuses if not opted in (security wall)

**Goal:** Verify the backend wall protects against a malicious client bypassing the Settings toggle.

**Setup:**
- A vendor with `instant_payout_enabled=false` (default).
- Mock or forge a call to the `vendor.requestInstantPayout` tRPC procedure.

**Steps:**

1. Send a direct request to the endpoint with a valid auth token but `instant_payout_enabled=false`.

**Expected:**
- [ ] Endpoint returns 400 with message "Instant payouts are off for this vendor."
- [ ] No Stripe payout call is made.
- [ ] No `payouts` row written.

---

## 14. Fee tier overlap protection

**Goal:** Verify the tier editor refuses overlapping ranges.

**Setup:**
- `/admin/fees` page.

**Steps:**

1. Note the active global tiers (e.g. `$0-$100 = 10%`, `$100-$500 = 12%`, `$500+ = flat $60`).
2. Click "+ Add tier", try to add `min $50, max $200, 11%`. Save.

**Expected:**
- [ ] Server refuses with `CONFLICT` and a message naming the conflicting tier (one of the existing ranges it overlaps).
- [ ] No row is written.

**Variants to test:**
- Overlapping at the bottom edge (`min $0, max $100`).
- Overlapping at the top edge (`min $500+`).
- Identical range to an existing active tier.
- Range that contains another (e.g. `min $0, max $1000`).
- Editing an existing tier so its NEW range overlaps another active tier (same protection should apply, excluding the tier being edited).

---

## 15. Fee tier edit doesn't break historical bookings

**Goal:** Verify that editing a tier doesn't retroactively change what past customers were charged.

**Steps:**

1. Note `transactions.platform_fee_snapshot` for an existing paid booking.
2. Edit the tier that snapshot references — change 12% to 14%.
3. Check the original transaction again.

**Expected:**
- [ ] `transactions.platform_fee_snapshot` is unchanged.
- [ ] `transactions.platform_fee_cents` is unchanged (it was frozen at booking time).
- [ ] A *new* booking that matches this tier uses the 14% rate.

This is what `platform_fee_snapshot` exists for. If it doesn't hold, the snapshot logic in checkout.ts has a regression.

---

## 16. Suspending a vendor mid-flight

**Goal:** Verify that suspending a vendor doesn't trap money or break customers.

**Setup:**
- Vendor with at least one redeemed-but-not-released claim (auto OFF, or use a real failure case).

**Steps:**

1. God mode → vendor detail → click Suspend.
2. Try to fire a Transfer (push held payout, or trigger a fresh redemption).

**Expected:**
- [ ] All vendor's live deals drop to `'draft'` (kill switch behavior).
- [ ] **Held payouts are still pushable** (the suspension is on listing, not on money owed). Wall check confirms `stripe_account_status === 'active'` — if suspension drops it to anything else, transfers refuse and surface in god mode.
- [ ] Customers with already-purchased vouchers can still see + redeem them — the vendor is suspended from posting new deals, not from honoring existing ones. Verify this matches your policy.

**Policy question worth answering before launch:**
- What does "suspended" mean: just no-new-deals, or also voids existing vouchers? Currently it's just no-new-deals. Document explicitly.

---

## 17. Reconciliation: DB vs Stripe at end of session

**Goal:** Catch any silent drift between our books and Stripe's books.

**Steps after running scenarios 1–16:**

1. For each vendor that had activity, compute:
   - **DB**: SUM(`transactions.vendor_payout_cents`) WHERE `status='released'`
   - **Stripe**: total of all transfers to that vendor's `stripe_account_id` (minus reversals)
2. Compare.

**Expected:**
- [ ] DB total == Stripe total for every vendor.
- [ ] If different: a transfer was created without writing the DB row (or vice versa). **This is a bug, find it.**

This is the manual version of the nightly reconciliation job specced in [CREDITS_AND_FEES.md §6b](./CREDITS_AND_FEES.md#walls). The job isn't built yet — until it is, run this check manually after every meaningful test session.

---

## Known unbuilt scenarios (DO NOT test until built)

The following are spec'd or implied but not implemented yet. Don't run them — they'll fail or do nothing:

- Refund/cancellation flows (Scenario 7 sub-scenarios) — there's no `refunds.create` or `transfers.createReversal` code yet.
- Nightly reconciliation job — manual diff only for now.
- Credit loyalty system — credits earned on redemption, applied at checkout. Build is post-payments per §7 build order.
- $1k single-transfer sanity cap (launch-only insurance) — specced but not coded.
- Per-vendor hold-window settings (e.g. "Badia's new accounts get a 48h hold") — specced but not coded.
- Service-dispute handling — explicitly out of scope (we're rails, not arbiters) but the ToS clause doesn't exist yet.

---

## After every test session

1. **Capture the failures.** What broke, what step, what state, what Stripe event ID.
2. **File or fix.** Either turn each into a ticket or fix on the spot if it's small.
3. **Reset.** Run the wipe at the top of this doc before the next session.
4. **Update this doc.** If a scenario uncovered a new edge case or a step needs sharpening, add it now.

The point of this doc is not to be exhaustive on day one; it's to be **the running record of what we test and what we trust.**
