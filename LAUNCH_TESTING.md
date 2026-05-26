# Launch Testing — Gloē

> The four tests between you and "payouts work, ship it."
>
> Read this top to bottom on launch day. Run each test. If any fail, stop and fix that one. Sign off at the bottom.

---

## Why this doc exists

Everything else is built. The code is real. What's between you and going live with real spas and real money is **proving the payment plumbing works end-to-end** — not in theory, not in a unit test, with actual dollars moving through actual Stripe accounts.

This doc is a runbook, not a spec. It tells you what to do, what good looks like, and what to do if something breaks. Engineering-grade detail lives in [TEST_SCENARIOS.md](./TEST_SCENARIOS.md). This doc is the version you walk through with coffee.

## How to read each test

Every test has the same five sections:

1. **Why this matters** — the business reason, in one paragraph
2. **What you do** — the steps, in plain English
3. **What good looks like** — three signals that the test passed
4. **If it fails** — what it means and who to escalate to (probably Claude)
5. **Where to look for evidence** — exact URLs / pages, so you can verify without my help

You should be able to run all four tests in one sitting, ~90 minutes total.

## Before you start

You need these to be true before opening this doc:

- [ ] Mac is on the same Wi-Fi as your iPhone
- [ ] API server running (`apps/api` → `npm run dev` shows "Gloe API listening on http://0.0.0.0:4000")
- [ ] Metro running (`apps/mobile` → `npx expo start`)
- [ ] Stripe CLI listening (`stripe listen --forward-to localhost:4000/webhooks/stripe`)
- [ ] You can open `/admin` in your browser and see the console
- [ ] Gloē app opens on your phone and shows the home screen

If any of those aren't true, sort that first — none of these tests work without the dev stack up.

---

## Test 1 — Customer gets refunded (full and partial)

### Why this matters

When a customer calls saying "I bought this, never used it, please refund me," you need to be able to do that **without** typing SQL or opening Stripe. Your admin tool needs to handle both full refunds (give back everything) and partial refunds (give back some). And it needs to refuse if the customer already used their voucher — otherwise you'd be refunding them for a service they actually got.

This test proves all three.

### What you do

**Setup:** make one fresh test purchase from your iPhone first.

1. Open Gloē on your phone, buy any deal from **Test Vendor Spa** (the only vendor wired to a real Stripe account). **Do NOT redeem the voucher** — leave it active.
2. In your browser, open `/admin` → click **Customers** → find your own row (look for "Ryan Moore") and click it.
3. You should see a list of transactions in the side drawer. The one you just bought will be at the top.

**Test the partial refund first** (so you can do a full refund on the same transaction later):

4. Click the **Refund** button on that transaction row.
5. The modal opens with the full amount pre-filled. **Change the amount to half** of the purchase price.
6. Type a reason like "test partial refund" and click Refund.

**Now test the full refund:**

7. Click **Refund** again on the same row. The modal should now show the remaining (half) balance.
8. Click **Max** to fill in the rest, type "test full refund" as the reason, click Refund.

**Now test the refusal:**

9. On the **same row**, the Refund button should now be **gone** (because the transaction is fully refunded).
10. Find an older transaction whose voucher status says "redeemed" — the Refund button should also be gone there.

### What good looks like

- ✅ The partial refund went through, the transaction row in the drawer now shows "Refunded $X" alongside the original amount, and the voucher status is still "active"
- ✅ The full refund went through, the voucher status flipped to "cancelled", and the Refund button disappeared from that row
- ✅ Refund button is hidden on any transaction with a redeemed voucher (you cannot refund a service that was delivered)

### If it fails

If a refund button is showing on a redeemed voucher → server-side check is broken, escalate.
If the refund returns an error → check Stripe Dashboard → Payments for the transaction; the PaymentIntent might be in a state that can't be refunded (already disputed, already fully refunded, etc.)
If the modal won't open → JS error, check browser console.

### Where to look for evidence

- **Customer drawer in your admin:** the refund amount appears under the transaction
- **Stripe Dashboard → Payments:** click the matching PaymentIntent — you'll see the refund event(s)
- **Stripe Dashboard → Refunds:** the refund objects live here with `gloe_reason` in metadata

---

## Test 2 — Vendor's money makes it from Stripe to their bank account

### Why this matters

Customer pays Gloe → vendor redeems voucher → Gloe sends vendor's share to their Stripe Connect account → Stripe automatically pays out the Connect balance to the vendor's actual bank (usually 2 business days). The last step is where your support burden lives. Vendors call about *bank deposits*, not about Stripe events. If the `payout.paid` webhook from Stripe doesn't update your DB correctly, you can't tell them what happened.

This test proves Stripe payouts land in your DB and the vendor sees them.

### What you do

1. Make sure Test Vendor Spa already has at least $160 sitting on their Connect account (run Test 1 first — that purchase will have already done this).
2. Open Stripe Dashboard → **Connect** → click into Test Vendor Spa's connected account.
3. Look at the **Balance** view for that connected account. Available balance should be `$160` (or whatever your test purchase amount was).
4. Click **Payouts** in the connected account's left nav → click **Create payout** → select "Pay the full available balance" → confirm.
5. Wait ~10 seconds (test mode is near-instant). The payout will progress: `pending → in_transit → paid`.
6. Open `/admin/vendor/v_311` in your admin console.

### What good looks like

- ✅ The Payouts card on the vendor detail page shows "Paid out: $160" (or whatever amount)
- ✅ The Pending / In Transit amount is back to $0
- ✅ The Failed payouts count is still 0

### If it fails

If the payout amount in `/admin` doesn't match Stripe's payout → the `payout.paid` webhook didn't fire or didn't reach our handler. Check the Stripe CLI window — you should see `payout.paid → 200 OK` echoed there. If not, the CLI listener is dead — restart it.

If the webhook hits but the DB doesn't update → check API server logs for an error in `payoutWebhooks.ts`.

### Where to look for evidence

- **Stripe Dashboard → Payouts** (within the connected account): the payout event with timestamps
- **/admin/vendor/v_311** → Payouts card: the totals match
- **Stripe CLI terminal window**: shows the webhook events streaming by

---

## Test 3 — A failed bank payout shows up as a red banner

### Why this matters

Real-world scenario: vendor types their bank info wrong, or their account gets frozen, or the bank rejects the deposit for some reason. Stripe sends a `payout.failed` event. Your job is to **notice and tell someone**. If a failed payout sits in your DB unnoticed for a week and the vendor calls upset, you have a bad day.

This test proves your failed-payout alerting works.

### What you do

1. In Stripe Dashboard, while inside Test Vendor Spa's connected account, go to **Settings** → External accounts.
2. Replace the existing test bank account with one that uses routing number `110000000` (this is Stripe's test "will fail on payout" routing number — see [Stripe docs](https://docs.stripe.com/connect/testing#payouts)).
3. Make sure there's a balance to pay out. If not, run a quick purchase + redeem again.
4. Create a payout (same flow as Test 2). Wait ~10 seconds.
5. The payout status should flip from `pending` → `failed`.
6. Open `/admin/vendor/v_311`.

### What good looks like

- ✅ The Payouts card shows **Failed payouts: 1** in red
- ✅ A failed-payout panel appears with the failure reason (something like "The bank account could not be located")
- ✅ Date of the failure is displayed

### If it fails

If the failed payout doesn't appear in /admin → the `payout.failed` webhook didn't process. Same debugging as Test 2: Stripe CLI shows the event, but your handler may have errored.

If the count is wrong (e.g. 2 failures but shows 1) → DB query for failed payouts might be filtering incorrectly.

### Where to look for evidence

- **Stripe Dashboard → Payouts**: the failed payout with its failure code
- **/admin/vendor/v_311** → Payouts card → Failed payouts section: the matching row
- **API server logs**: should see "payout.failed received" if the webhook arrived

**After this test:** put Test Vendor Spa's bank back to a working test bank (Stripe routing `110000000` stays "fail forever" until you change it).

---

## Test 4 — A real vendor can onboard from scratch

### Why this matters

Every spa you sign up has to go through Stripe Connect onboarding before they can receive money. This is the hardest user-facing flow in your whole product because it touches Stripe's interface (which you don't control). If it breaks, you can't ship — you can't take payments to a vendor that hasn't onboarded.

This test proves the onboarding flow works end-to-end for someone who's never seen it.

### What you do

1. In `/admin` → click **Vendors** → look for a spa that has no Stripe (anyone except Test Vendor Spa). Let's say **Glow Aesthetics La Jolla**.
2. Click into them → their vendor detail page.
3. There should be a yellow "Stripe NOT connected" tag at the top.
4. Click the **Connect Stripe** button (blue/brand-colored, top-right).
5. Within a second, you'll get either a copyable URL or get redirected to Stripe's hosted onboarding flow.
6. Walk through it as if you were that spa: fill in real test data — use Stripe's test SSN (`000-00-0000`), test bank routing (`110000000` for fail-on-payout testing later, or `011000015` for a normal success), test address.
7. When Stripe redirects you back, the vendor detail page should refresh and the yellow tag should now be green "Stripe connected".
8. Bonus: make a test purchase from that newly-onboarded vendor, redeem it, push the payout.

### What good looks like

- ✅ Stripe accepts your test data and finishes onboarding without errors
- ✅ Back in /admin, the vendor's status flips to `stripe_account_status = active`
- ✅ The "Connect Stripe" button is replaced with a "View on Stripe" or similar
- ✅ You can complete a real purchase + redemption + payout cycle for them after onboarding

### If it fails

Onboarding fails most often because:
- Test data is wrong shape (Stripe SSN must be `000-00-0000` exactly)
- Onboarding URL has the wrong return URL — should bring you back to `/admin/vendor/<id>`
- Webhook for `account.updated` didn't fire or didn't process → vendor stays "pending" even after they finish

Check Stripe CLI for the `account.updated` event when you complete onboarding. If you see it hit but the DB still says pending, it's a handler bug.

### Where to look for evidence

- **Stripe Dashboard → Connect → Connected accounts**: the new account appears
- **/admin/vendor/<their-id>**: status changes from `pending` to `active`
- **Stripe CLI terminal**: shows `account.updated` events

---

## If anything broke

Don't paper over it. The point of these tests is to find what's wrong **before** real money depends on it.

For each failure, capture:
- Which test, which step
- What you saw vs. what was expected
- Relevant DB state (open `/admin`, look at the affected vendor/transaction)
- Relevant Stripe event ID (from the Stripe CLI window or Stripe Dashboard → Events)

Hand that to Claude with "Test N step M failed, here's what I saw." Fix on the spot or file a ticket — don't ship without a fix.

---

## Sign-off

Once all four are green:

- [ ] Test 1 — Refunds (full + partial + redeemed-refusal) all behaved correctly
- [ ] Test 2 — Standard payout flowed Stripe → DB → admin UI
- [ ] Test 3 — Failed payout surfaced as red banner with reason
- [ ] Test 4 — A fresh vendor onboarded and received their first payout

When all four boxes are checked, **payouts are proper**. You're ready to sign your first real spa.

Date signed off: ___________
Initials: ___________
