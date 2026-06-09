# Sprint log — while you were in Mexico 🌴

Plain-English rundown of everything built unattended (started 2026-06-09). One section per
ticket: what it does, where it lives, how to try it, and what's easy to change. **Nothing was
pushed** — it's all local commits on `main`, waiting for your review. Push when happy:
`git push origin main` (that deploys via Railway).

## TL;DR

| Ticket | Outcome |
|---|---|
| GLO-19 License verification (Urgent, blocker) | **Built** — vendor submits license + doc, you review in god-mode; approval = going live |
| GLO-5 Vendor claim & invite (Urgent) | **Built** — "Invite owner" in admin; owner signs in and the spa links automatically |
| GLO-40 Payout + support-reply emails | **Built** — "You got paid 🎉" to spas; full reply text to customers |
| GLO-27 Editorial Discover sections | **Already shipped earlier** — audited every criterion, closed the stale ticket |
| GLO-6 For-Businesses on-ramp | **Already shipped earlier** — /business page + nav/footer links; closed |
| GLO-7 Desktop location picker | **Built + browser-verified** — desktop now opens the rich mobile picker |

**When you're back, in order:** (1) read this file, (2) skim the diff (`git log origin/main..HEAD`),
(3) run the GLO-19 DB test (`cd apps/api && npx tsx src/scripts/testLicenseFlow.ts`),
(4) send yourself a vendor invite from a scratch vendor, (5) push.

> One DB note: each ticket's schema changes were applied to Supabase as additive migrations
> (new columns/tables only — the deployed app ignores them until you push the code, so prod
> behavior is unchanged). Also ran a production `next build` (passed) and a multi-agent
> self-review of the whole diff before signing off — anything it found and I fixed is in the
> commits.

---

## GLO-19 — Provider license verification ✅ (launch blocker)

**What it is:** the real process behind "every spa is vetted & licensed."

**The vendor's experience** (web → `/vendor` → Settings):
- New card: **"Medical license & verification."** They enter license number, state, license
  type (MD/NP/RN/PA/aesthetician/etc.), and attach a **photo or PDF of the license**.
- After submitting they see "Under review." If you reject, they see your reason word-for-word
  and can fix + resubmit. Once approved they see a green ✓.
- The setup checklist's "Medical license & verification" step only turns green when **you**
  approve — not when they submit.

**Your experience** (admin god-mode):
- Vendors tab: the License column now shows **— / Review / Verified / Rejected**, and there's
  a **"License review" filter chip** = your review queue.
- Vendor detail page: new **"License & verification" card** (top of Risk & controls). Shows
  what they submitted + a **"View license document"** link, with **Approve** / **Reject…**
  (reject requires a reason). There's also a license tag up in the header chips.
- **Approving a brand-new spa is what takes them live** (pending_approval → active). That's
  intentional: verifying the license IS approving the spa. Stripe is still separately required
  before they can post deals.

**The rules we agreed on:**
- Existing live vendors are **grandfathered** — nothing went offline. They just show as
  unverified in your roster so you can chase them.
- Rejecting a license never takes a live vendor down (suspend stays its own deliberate act).
- License documents are **private** (PII) — there are no public URLs; your view-document link
  is freshly signed and expires after ~10 minutes.

**Easy to tweak:**
- The license-type dropdown options: `apps/web/src/app/vendor/LicenseCard.tsx` (`LICENSE_TYPES`).
- All vendor-facing copy: same file. Admin-side copy: `apps/web/src/app/admin/vendor/[id]/page.tsx`
  (`LicenseReviewCard`).

**Verification status:** API + web typecheck clean; the private-bucket storage flow (signed
upload → public access blocked → signed admin read) was **tested live and passed**. The full
DB walkthrough script is ready at `apps/api/src/scripts/testLicenseFlow.ts` — run
`npx tsx src/scripts/testLicenseFlow.ts` from `apps/api` when you're back (it seeds one fake
vendor, walks submit → reject → resubmit → approve, asserts everything, and deletes all of it;
I didn't run it because it writes test rows to the shared DB and you were away).

**Files:** migration `20260609230000_vendor_license_verification.sql` ·
`apps/api/src/domain/vendorLicense.ts` (new) · `db/storage.ts` (private bucket + signed reads) ·
`vendor.router.ts` + `admin.router.ts` (new procedures) · `vendorSignup.ts` (gate now reads
license_status) · `LicenseCard.tsx` (new) · `VendorDashboard.tsx` · `VendorsView.tsx` ·
admin `vendor/[id]/page.tsx` · GLOE.md §5/§7/§8/§13 · HOW-IT-WORKS.md §9/§10.

---

## GLO-5 — Vendor claim & invite flow ✅ (urgent)

**The problem it kills:** you pre-create a spa in admin, the real owner later signs up… and got a
**duplicate** vendor. Now the handover is one email.

**How it works now:**
1. **Add-spa has an "Owner email (optional)" field** — captured at create (stored lowercase on
   `vendors.email`).
2. On an **unclaimed** vendor's detail page there's a **"✉ Invite owner"** chip next to the
   "unclaimed" tag. Click → Clerk sends them a sign-up invitation that lands on `/vendor`. If no
   email is on file it prompts you for one. After sending, the chip shows "invited <date> · resend".
3. When the owner signs in at `/vendor`, the app **automatically claims** the listing: it matches
   their **verified** Clerk email against unclaimed vendors and links ownership. They land straight
   in their own dashboard — no signup form, no duplicate.
4. Anyone who *does* see the signup form gets a banner on top: "Was your spa set up for you? …
   claim your business" — the manual fallback for owners whose invite email got lost.

**Safety rails:** only **verified** emails can claim (nobody hijacks a business with an unverified
address); claiming is atomic (two racing sessions can't both win); invites to an email that already
has an account get a clear message ("they can just sign in — it links automatically"); claims and
invites both write audit rows.

**Easy to tweak:** banner copy in `apps/web/src/app/vendor/page.tsx`; invite button copy in admin
`vendor/[id]/page.tsx` (`InviteOwnerButton`).

**Verification status:** api + web typecheck clean. The Clerk invitation send needs a real email
to test end-to-end — try it on a scratch vendor with your own email when back. (The invitation
email itself is Clerk-branded until GLO-18 styles the Clerk email templates.)

**Files:** migration `20260609233000_vendor_claim_invite.sql` (adds `owner_invited_at`) ·
`apps/api/src/domain/vendorClaim.ts` (new) · `vendor.router.ts` (`claimByEmail`) ·
`admin.router.ts` (`inviteVendorOwner`, `createVendorOnBehalf` + ownerEmail) · admin add-spa page ·
admin `vendor/[id]/page.tsx` (`InviteOwnerButton`) · `apps/web/src/app/vendor/page.tsx`
(auto-claim + fallback) · GLOE.md §7/§8 · HOW-IT-WORKS.md §9.

---

## GLO-40 — Vendor payout + support-reply emails ✅

Two more branded emails on the existing Resend/React Email foundation:

1. **"You got paid 🎉" (to the spa).** Fires the instant a redemption triggers their Stripe
   transfer. Big centered amount, the deal title, and a "View in Stripe" button. Goes to the
   owner's account email (business email on file as fallback). Keyed to the transfer ID, so a
   retried transfer can never email twice. Nice side effect: it teaches vendors that
   *redemptions* are what pay them.
2. **Support reply (to the customer).** When you reply to a support ticket, the customer now
   gets the **full reply text in their inbox** (your call from before you left) with a pointer
   back to Profile → Support. It rides alongside the existing push, keyed per message. Since
   replying to any Gloē email reaches support@gloe.app, they can answer the email directly too.

**Easy to tweak:** wording/layout in `apps/api/src/emails/PayoutEmail.tsx` and
`SupportReplyEmail.tsx`. Preview both anytime without sending:
`cd apps/api && npx tsx src/scripts/renderEmailPreviews.ts` → writes HTML files to /tmp.

**Verification status:** typecheck clean; both templates render-tested with sample data
(assertions on amount/copy passed). Real sends will no-op locally until `RESEND_API_KEY` is in
the env (same as the other emails).

**Files:** `emails/PayoutEmail.tsx` + `emails/SupportReplyEmail.tsx` (new) ·
`transactionalEmails.ts` (`sendVendorPayoutEmail`, `sendSupportReplyEmail`) · `payouts.ts`
(fires after `transfer.created`) · `admin.ts` (`createAgentReply` fires email beside the push) ·
`scripts/renderEmailPreviews.ts` (new) · GLOE.md §4 email list · HOW-IT-WORKS.md §11/§15.

---

## GLO-27 — Editorial Discover sections — ALREADY DONE, closed ✅

Audited every acceptance criterion against the code: the whole feature shipped earlier
(tables + admin "Sections" tab editor + tagline rails + multi-category pooling + tagline-titled
"See all" + fallback). Your hunch was right. **No code changes; marked Done in Linear.** Only
known tail (pre-existing, noted in GLOE.md): web omits "View more" on multi-category sections.

---

## GLO-6 — "For Businesses" on-ramp — ALREADY DONE, closed ✅

Also already shipped by the web rebuild: full `/business` marketing page (pricing, FAQ, CTAs →
`/sign-up?redirect_url=/vendor`), linked from TopNav, the mobile drawer, the footer, and the
account page. **No code changes; marked Done in Linear.** If you'd rather the nav says
"List your spa" than "For Businesses", that's a one-liner — tell me.

---

## GLO-7 — Desktop location picker parity ✅

Desktop's location pill in the top nav used to open a cramped little dropdown (GPS + search
only). It now opens the **same rich picker mobile web has** — share-location prompt, popular
cities, address lookup — centered as a modal on desktop. One component now serves both
(`LocationPill` kept its pill look but just triggers the shared `LocationSheet`), so future
picker improvements automatically land everywhere.

**Verified live in the browser:** opened gloe home at 1440px, clicked the pill → centered modal
with popular cities; picked "San Diego, CA" → modal closed, pill updated, feed re-ranked.
Screenshot: `glo7-desktop-location-sheet.png` in the repo root (gitignored).

**Files:** `apps/web/src/components/consumer/LocationPill.tsx` (rewritten as trigger + shared
sheet; the old bespoke dropdown is gone) · `apps/web/WEB.md`.

---

## Self-review pass (multi-agent) — found 8, fixed 8 ✅

Before signing off I ran four independent review agents over the whole sprint diff, verified
their findings, and fixed everything real (final commit):

1. **Resubmit after rejection dead-ended** — the license form let you resubmit with the doc
   already on file but then demanded a new upload. Now a resubmit without a new file keeps the
   previous document (server-side), and the form says so.
2. **A verified vendor could demote themselves** — calling submit again would have dropped them
   to "pending review" and revoked posting *and* voucher scanning until you re-approved.
   Submitting is now blocked once verified ("contact support to update it").
3. **Approve/Reject had no guard** — a stale admin tab could approve a vendor with *nothing*
   submitted (going live with zero license on file) or reject an already-verified one. Both now
   require an actual pending submission.
4. **"Open gates" off-switch delisted verified vendors** — toggling the bypass off always reset
   status to pending-approval, which would have unlisted a spa you'd license-approved. Now it
   leaves license-verified vendors active.
5. **Invite-owner could overwrite the stored email even when the call failed** (already-claimed
   vendor) — validation now happens before anything is written.
6. **Clerk "already has an account" detection was a loose text match** that could misreport
   unrelated errors — now matches Clerk's error codes.
7. **Two email sends could crash on a module-load failure** in the money/support paths — both
   are now fully fire-and-forget with error logging.
8. **The admin "view license document" link could rot** (10-min signed URL baked into a cached
   page) and a storage stall could hang the vendor page — the URL is now signed fresh at click
   time, with a 5s timeout on the storage call.

**Known limitations I did NOT change (flagging, not hiding):**
- The whole data model is one-vendor-per-owner. If you ever pre-create TWO locations with the
  same owner email, they can only claim the first — multi-location ownership is an
  architecture decision for another day.
- Claim-by-email means a typo'd owner email at add-spa could let the wrong (verified) inbox
  claim that spa. The claim writes an audit row and shows "claimed" in admin, but double-check
  emails you type.
- Setting `license_number`/`verified_at` by hand in SQL no longer satisfies the license gate —
  use the admin review UI (or "Open gates") instead.
