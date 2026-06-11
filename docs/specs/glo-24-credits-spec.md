# GLO-24 — Credits Platform Build Spec (locked 2026-06-10)

Single dollar wallet balance per user. Earned via admin-authored rules, auto-applied at checkout.
Full product spec + decision table lives in Linear GLO-24; this file is the ENGINEERING contract all
build agents follow. Where this file is explicit, do not improvise.

## Non-negotiables (Ryan)
1. **Credits are PLATFORM-funded.** Vendor payout math NEVER changes: `vendor_payout_cents` stays
   `consumer_paid_cents − platform_fee_cents` computed on the FULL order value. Credits reduce only
   the customer's cash charge. The platform's effective margin on a txn = `platform_fee_cents − credits_applied_cents`.
2. **Dollars, not points.** All amounts integer cents.
3. **Every amount/knob is a `credit_rules` row** (the `platform_fees` pattern) — god-mode editable, no deploys.
4. **Launch posture:** ACTIVE sources = referral give/get ($20/$20, $50 referee first-order floor),
   admin manual grants, push-credit campaigns, refund-return. BUILT BUT INACTIVE rule rows = purchase
   tiers ($100–250→$10, $250–500→$20, $500+→$25) and signup bonus. Engine supports all; seeds set `active=false` for the dormant ones.

## Money semantics (LOCKED — do not deviate)
- `transactions.consumer_paid_cents` KEEPS its current meaning: full order value (price × qty).
  Fee snapshot, vendor payout, and all existing walls stay untouched.
- NEW `transactions.credits_applied_cents int NOT NULL DEFAULT 0` with CHECK `credits_applied_cents <= consumer_paid_cents`.
  Cash charged to Stripe = `consumer_paid_cents − credits_applied_cents`.
- NEW `transactions.credits_refunded_cents int NOT NULL DEFAULT 0` with CHECK `<= credits_applied_cents`.
  Existing `refunded_cents` continues to mean CASH refunded via Stripe; CHECK must become
  `refunded_cents <= (consumer_paid_cents - credits_applied_cents)`.
- **Stripe $0.50 floor:** if `0 < cash < 50`, reduce credits applied so cash = exactly 50¢.
  Zero cash (balance covers everything) is fine — that's the zero-dollar path.
- **Zero-dollar orders skip Stripe entirely:** no PaymentIntent; insert txn `status='paid'`,
  `paid_at=now()`, `stripe_payment_intent_id NULL`; run the fulfillment core inline (refactor
  `fulfillPurchase` so the webhook path and the inline path share one core). Receipt email still fires,
  showing the cash/credit split.
- **Auto-apply, toggle off:** checkout defaults to applying the full available balance (capped at order
  total / floor rule). Client sends `applyCredits: boolean` (default true) + server computes amounts —
  the client NEVER sends a credit amount, only the toggle. Server re-reads balance inside the
  transaction (FOR UPDATE) to prevent double-spend across concurrent checkouts.
- Credits can NOT be applied to gift-link purchases (`createGiftLink`) — cash only.

## Ledger (lot-based, append-only)
Table `credit_lots`: id, user_id, kind ('referral_give'|'referral_get'|'purchase_reward'|'signup_bonus'|
'promo'|'admin_grant'|'refund_return'), amount_cents (>0), remaining_cents, expires_at (nullable),
rule_id FK nullable, campaign_id FK nullable, transaction_id FK nullable (earning txn),
referral_id nullable, note text, created_at. `remaining_cents` is the ONLY mutable column (drawdown).
Table `credit_entries`: id, user_id, kind ('redemption'|'expiry'|'clawback'|'forfeiture'), amount_cents (<0),
transaction_id nullable, lot_id FK (which lot it hit), created_at, meta jsonb. Append-only.
- Balance = SUM(credit_lots.remaining_cents WHERE remaining >= 0) — compute server-side only.
- Redemption consumes lots FIFO by `expires_at NULLS LAST, created_at` under `SELECT … FOR UPDATE`.
- Clawback targets the specific earning lot; `remaining_cents` MAY go negative (nets future earns).
  UI displays max(0, balance).
- Idempotency: unique partial index on lots `(kind, transaction_id)` where transaction_id is not null,
  and on `(kind, referral_id)`, and `(campaign_id, user_id)` — webhook retries must not double-grant.
- One door: `grantCredit()` in `domain/credits.ts` — nothing else inserts lots. Every grant/entry also
  calls `writeAudit()` and (where user-visible) `sendNotification()` via the registry.

## credit_rules (mirror platform_fees idioms: soft-delete via active flag, never DELETE)
id, rule_type ('purchase_tier'|'referral'|'signup_bonus'), min_purchase_cents, max_purchase_cents,
credit_cents, percent_bps (nullable; cents XOR bps), give_cents/get_cents (referral),
min_first_purchase_cents (referral floor, seed 5000), expires_after_days int NOT NULL DEFAULT 90,
monthly_user_cap_cents (seed 10000, applies to referral+signup kinds only), monthly_referral_payout_cap
(seed 10), starts_at, ends_at, active, created_at, updated_at.
Seeds: referral rule ACTIVE ($20/$20, floor $50); three purchase tiers INACTIVE; signup bonus INACTIVE.

## Campaigns
Table `credit_campaigns`: id, name, amount_cents, expires_after_days, audience ('everyone'|
'lapsed_60d'|'signed_up_never_purchased'), message_title, message_body, status ('draft'|'sent'),
created_by, sent_at, granted_count, granted_cents. Admin endpoint executes: resolve audience →
grantCredit per user (idempotent on campaign_id+user_id) → sendNotification('credit_granted')
+ branded email (new template) per user. Fire-and-forget loop with progress persisted.

## Referrals
- `users.referral_code` (unique, 6-char A-Z2-9 no vowels/0/1/I/O), `users.referred_by` (FK users.id),
  set at JIT insert (context/auth.ts) when a valid code accompanies signup, or via
  `referral.submitCode` within 7 days of signup if no purchases yet. No self-referral.
- Referee's $20: granted AT ATTRIBUTION as a lot with `min_first_purchase_cents` lock (only redeemable
  on a first purchase whose pre-credit total ≥ floor). Wallet shows it with the condition.
- Referrer's $20: granted when referee's FIRST purchase fulfills (in fulfillment core). Guards, in order:
  floor met (pre-credit total), fingerprint guard (charge.payment_method_details.card.fingerprint —
  store NEW `transactions.card_fingerprint` from the webhook's expanded PaymentIntent; if it matches any
  of the referrer's stored fingerprints → VOID referrer payout, audit it, referee keeps theirs),
  monthly caps from the rule. Both sides claw back if that purchase is refunded/disputed.
- Deleted-account guard: NEW table `deleted_account_email_hashes(email_hash text pk, deleted_at)`;
  on account deletion store sha256(lower(email) + SALT from env CREDITS_EMAIL_HASH_SALT). At
  attribution, a matching hash → user is NOT "genuinely new": no referee lot, no referrer payout, no signup bonus.
- Web landing: `/r/[code]` on (consumer) → stores code (cookie/param into Clerk signup) → after signup
  attribution runs. Mobile: code entry field in AuthGateSheet sign-up form + share sheet
  `https://gloe.app/r/CODE`.

## Lifecycle hooks (all in apps/api)
- `refundTransaction` / `forceRefundRedeemed`: split-tender — Stripe refund covers only the cash share
  (≤ cash paid); credit share returns via `refund_return` lot with expiry = max(remaining window, 30d).
  Then clawback: reverse any lots EARNED from this txn (incl. both referral sides if it was the
  qualifying purchase). One domain function `unwindCreditsForTransaction(sql, txId, mode)` used by both.
- Dispute webhook: on `charge.dispute.created` ALSO freeze the user's ledger (NEW `users.credit_frozen_at`;
  redemption refuses while frozen); on closed-won unfreeze; on closed-lost clawback earned lots (same unwind fn).
- Account deletion (`account.ts`): forfeiture entry zeroing all positive lots + email-hash row; deletion
  confirmation responses must include current balance so clients can warn ("You'll forfeit $X").
- Expiry: extend the existing daily/cron pattern (expiry reminders) — expire overdue lot remainders via
  'expiry' entries; nudges via registry at 7d and 1d before (`credit_expiry_reminder`, dedup per lot+window).
  Voucher expiry (claims) does NOT return credits.

## Surfaces
- **tRPC**: `credits.router.ts` (balance {availableCents, lockedCents, soonestExpiry}, history),
  `referral.router.ts` (getCode, status {invited, qualified, earnedCents}, submitCode). Admin:
  rules CRUD (mirror fee-tier endpoints incl. audit), grantCredit, listLedger (per user), campaigns
  CRUD+send, programStats (issued/redeemed/clawed/expired/forfeited/outstanding liability),
  and the transaction detail payload gains credits fields.
- **Mobile** (`apps/mobile`): wallet.tsx CreditSection (real balance + history sheet + invite promo card),
  checkout.tsx auto-apply credits line with toggle (inline in price breakdown, "−$X credits" + new total),
  profile.tsx "Give $20, get $20" row → referral share screen (code, share sheet, status list),
  AuthGateSheet referral-code field on sign-up. Use design tokens (@gloe/ui), brand palette for credit
  states (NOT semantic.success green).
- **Web (consumer)**: wallet page credit balance card + history, PurchasePanel/useBuy credits toggle
  passing `applyCredits` to createEmbeddedCheckout (server computes; embedded session amount = cash;
  zero-dollar path returns a direct-success marker instead of a clientSecret — handle in UI),
  `/account` or wallet referral card, `/r/[code]` landing.
- **God mode** (`apps/web/.../admin/console`): new Credits view (TABS/NAV registration per existing
  pattern): rules editor (FeeTiersEditor as model), campaigns (create/send/list w/ cost),
  user ledger lookup + manual grant/revoke, program dashboard incl. **platform Stripe balance vs
  outstanding liability** (stripe.balance.retrieve), credit line in TransactionsView drawer
  (fee → credit cost −$X → net).
- **Emails**: ReceiptEmail gains cash/credit split lines; NEW CreditGrantedEmail (campaign/admin grant,
  amount + expiry + CTA; distinct preheader per the preheader rule); referral-complete notification via
  registry (push) — email optional.
- New notification_types rows (migration seed): credit_granted, referral_attributed, referral_complete,
  credit_expiry_reminder. All enabled, sensible templates.

## Hard rules for every agent
- Read the recon digest first: /Users/admin/.claude/projects/-Users-admin-Desktop-GlowApp/e701e9ed-2e59-460d-bc4a-8ae0990f7513/tool-results/bn44ssjrg.txt (file:line integration points + gotchas per subsystem).
- Amounts in CENTS end to end. postgres library idioms (sql.begin, sql.json, typed rows, prepare:false).
  No type generator — hand-typed row interfaces like fees.ts.
- Idempotency + audit on every money mutation. Fire-and-forget for emails/pushes (never block/throw).
- DO NOT: git commit/push, run `next build`, start dev servers, or apply migrations to the remote DB
  (write .sql files only — they get applied at release). Typecheck with the package's own tsc script.
- Existing tests must keep passing; new domain tests follow the seed pattern (randomUUID tag + cleanup in finally).
- Match surrounding code style; comments only where the code can't say it.
