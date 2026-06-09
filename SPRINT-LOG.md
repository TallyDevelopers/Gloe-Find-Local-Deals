# Sprint log — while you were in Mexico 🌴

Plain-English rundown of everything built unattended (started 2026-06-09). One section per
ticket: what it does, where it lives, how to try it, and what's easy to change. **Nothing was
pushed** — it's all local commits on `main`, waiting for your review. Push when happy:
`git push origin main` (that deploys via Railway).

> One DB note: each ticket's schema changes were applied to Supabase as additive migrations
> (new columns/tables only — the deployed app ignores them until you push the code, so prod
> behavior is unchanged).

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
