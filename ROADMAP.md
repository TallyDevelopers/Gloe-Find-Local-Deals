# Gloe — Roadmap & Gap Analysis

> Living document. What's built, what's missing, what's next.
> Last updated: 2026-05-19

---

## Where we are right now

✅ **Done end-to-end:**
- Turborepo monorepo with locked-in **multi-app architecture** (see §"Apps in this monorepo" in product spec):
  - `apps/mobile` — Gloe (consumer iOS app) — built
  - `apps/api` — Hono+tRPC API server — built
  - `apps/vendor` — Gloe for Business (vendor iOS app) — **not yet scaffolded**
  - `apps/admin` — Gloe Admin (web ops tool) — **not yet scaffolded**
  - `apps/web` — gloe.app marketing site — **not yet scaffolded**
- Shared packages: `@gloe/ui`, `@gloe/auth`, `@gloe/location`, `@gloe/api-client` — used by every app once built
- Native iOS build (`expo run:ios`) — no longer in Expo Go
- Custom design system (warm ivory + champagne + dusty rose, Fraunces + Inter)
- Discover feed (2-column grid + Featured carousel)
- Deal Detail screen with swipeable hero, variant picker, sticky CTA
- "Inside [vendor]" customer videos section (auto-hides when empty)
- Saved tab with "Saved / Your deals" segmented control
- Messages tab (mock threads)
- Profile tab with Your Deals link
- AuthGate bottom sheet (gates anonymous users at action time, not entry)
- ClaimConfirmSheet + QR code generation (`/my-deal/[id]`)
- Supabase Postgres + PostGIS + 16 tables + RLS policies + triggers
- Hono + tRPC API server connecting Postgres → Clerk JWT verification
- API-backed providers (Saved, Claimed) replacing in-memory mocks
- 8 vendors, 12 deals, 25 variants, real distance queries (PostGIS-powered)

🟡 **In progress:**
- Clerk sign-in still blocked by instance-level 2FA policy (email_code forced)

⛔ **Mock / placeholder (not real):**
- Photos (Unsplash stock — some broken IDs, ~60-70% render)
- Reviews (read-only; can't write one yet)
- Messages (mock threads; no compose/send)
- Sponsored placement (DB flag only, no vendor billing)
- Vendor profile screen (stub)
- Share button (logs to console)
- "Get directions" link (does nothing)
- Distance calculations use a hardcoded "downtown SD" coord (no real GPS)

---

## Tier 1 — Blocking. Must fix before anything else is meaningful.

These are things the app fundamentally cannot work without.

| # | Item | Why it's blocking | Effort |
|---|---|---|---|
| 1 | **Resolve Clerk sign-in** | We literally cannot test signed-in flows until 2FA-forcing config in the Clerk dashboard is resolved | 30 min |
| 2 | **Real GPS + location selector** | Every distance is hardcoded to downtown SD coords. No city picker, no "use my location" prompt. | 1 patch |
| 3 | **`apps/vendor/` — separate iOS app for vendors** | Locked architectural decision: vendors get their own App Store app ("Gloe for Business"), not a tab in the consumer app. Same monorepo, shares all packages + API. Without it: no vendor sign-up, no posting, no QR scanning, no marketplace. | 2–3 patches |
| 4 | **`apps/admin/` — internal web tool** | No way to approve vendors, moderate deals, ban users, or moderate reviews. Running a marketplace from raw SQL queries doesn't scale past 5 vendors. Lives at `admin.gloe.app`. | 2–3 patches |
| 5 | **Stripe Connect — transactional payments** | LOCKED MODEL: consumers pay full deal price at claim time via Apple Pay/card. Gloe collects, holds funds, pays vendor out on redemption minus a tiered platform fee. NO subscription. Vendor = Stripe Connected Account with KYC. This is THE revenue model. | 2–3 patches |

---

## Tier 2 — Major UX gaps consumers will notice immediately

Things that, if a real user opened the app today, they'd visibly miss.

| # | Item | What's missing | Effort |
|---|---|---|---|
| 6 | **Search** | No search bar, no results screen, no filter pills. "Botox under $200 within 5 miles" is impossible. | 1 patch |
| 7 | **Reviews flow** | Users can read reviews but can't write one after redeeming. The DB trigger that enforces "redeemed claims only" is ready — just need the UI. | 0.5 patch |
| 8 | **Share button** | Currently logs to console. Should open native share sheet with a deep link + attribution token. | 0.5 patch |
| 9 | **Real maps** | `react-native-maps` is installed but no screen renders one. "Where" section on Deal Detail is plain text. | 0.5 patch |
| 10 | **Messages** | Tab shows mock threads; no thread detail screen, no compose box, no real send. | 1 patch |
| 11 | **Push notifications** | Zero infrastructure. Flash deals can't notify anyone. | 1 patch |
| 12 | **Forgot password** | Link exists, goes nowhere. | 0.25 patch |
| 13 | **Edit profile** | Profile shows your info but you can't change name, photo, location. | 0.5 patch |
| 14 | **Vendor profile screen** | Tapping vendor name says "Coming soon" instead of showing their full menu. | 0.5 patch |
| 15 | **Social logins** | Clerk supports Google/Apple/TikTok. Buttons not wired up. | 0.5 patch |

---

## Tier 3 — Real-world stuff needed before launch

What we'll discover we're missing once we start trying to actually onboard vendors and run ads.

| # | Item | Notes | Effort |
|---|---|---|---|
| 16 | **Sponsored deal management** | Vendors can't pay for sponsored placement. The chip just shows up wherever I flagged it in the DB. Once Stripe Connect is in, this becomes an additive revenue line (vendors pay extra on top of base transaction fee). | Part of Stripe Connect work |
| 17 | **Promoted post billing / ad builder** | "Vendor self-serve ad builder" mentioned in spec § 4.3. Major future revenue line. | 1 patch |
| 18 | **Push blast composer** | Vendors can pay to push a flash deal to opted-in locals. Specced as v1.2 in spec. | 1 patch |
| 19 | **Before/after photo uploads** | With required consent attestation. Specced; not built. | 0.5 patch |
| 20 | **In-app booking** | We generate a QR but customers still have to call the vendor. Could integrate with Vagaro/Boulevard/Mindbody APIs. | 2+ patches |
| 21 | **Real app icon + splash** | Currently Expo defaults. Need brand-on Gloe icon. | designer ask |
| 22 | **Analytics (PostHog)** | No event tracking. We're blind to what users do. | 0.25 patch |
| 23 | **Error monitoring (Sentry)** | Crashes happen silently in production. | 0.25 patch |
| 24 | **Tests** | Zero tests. ~6,000 lines of code shipped without coverage. At minimum need: domain logic unit tests, API integration tests, smoke E2E for sign-in + claim flow. | ongoing |
| 25 | **Android build** | iOS-only is fine for v1 but Android needs its own native build + Play Store submission. | 1 patch + Play Store $25 |
| 26 | **Legal documents** | Terms of service, privacy policy, vendor agreement, malpractice attestation. **Required for App Store submission.** Talk to a lawyer. | lawyer ask |
| 27 | **App Store assets** | Marketing screenshots, app description, privacy nutrition label, age rating. Required for submission. | 0.5 patch + designer |
| 28 | **Staging environment** | One Supabase project today. Need dev/staging/prod separation before launch so we don't blow up real data while iterating. | 0.5 patch |
| 29 | **CI/CD** | No automated build, test runs, or deploy pipeline. Everything is manual. | 0.5 patch |
| 30 | **Database backup strategy** | Supabase free tier doesn't auto-backup. Need a manual nightly `pg_dump` to S3 or similar before launch. | 0.25 patch |

---

## Tier 4 — Polish, growth features, nice-to-haves

| # | Item | Notes |
|---|---|---|
| 31 | Customer video upload UI | Vendors upload their own videos for the "Inside [vendor]" section |
| 32 | City expansion tooling | Admin can add LA, Vegas, Miami, NYC — defines geofence, launches feed |
| 33 | Referral program | Consumer A invites consumer B → both get bonus redemptions |
| 34 | Gloe Plus consumer subscription | $9.99/mo for more redemptions, early access to flash drops |
| 35 | Dark mode | Tokens support it but no toggle |
| 36 | Accessibility audit | VoiceOver labels, dynamic type, color contrast (Apple may reject app without this) |
| 37 | Localization | Spanish-language support for SD market |
| 38 | "Gloe Concierge" | Chat with a human/AI for personalized recommendations (v3 feature in spec) |
| 39 | Vendor-to-vendor referrals | One med spa refers another, both get billing credit |
| 40 | API for booking-platform integrations | Vagaro / Boulevard / Mindbody hooks |
| 41 | White-label option | For franchise med spa chains |

---

## Recommended next-10-patches order

This is the order I'd build if it were up to me. Reasoning: nothing on the consumer side matters until vendors can post real deals + we can take their money.

| # | Patch | Why this order |
|---|---|---|
| 1 | Unblock Clerk sign-in | Can't test anything signed-in. Today. |
| 2 | `apps/vendor/` scaffold + sign-up + post-a-deal + QR scanner | Locked: separate iOS app, same monorepo, shares all packages + API. Supply side > consumer side. Without vendors, no marketplace. |
| 3 | `apps/admin/` scaffold + vendor approval + deal moderation | Web app at admin.gloe.app. Needed the moment we have >5 vendors. |
| 4 | Stripe Connect — pay-per-transaction | Consumer pays at claim, Gloe holds funds, vendor paid out on redemption minus tiered fee. THE revenue model. Includes vendor KYC, payout tracking, refund flow. |
| 5 | Real GPS + location selector + real maps | All three at once. Same native deps, similar surface area. |
| 6 | Search + filters | Power-user discovery. Built on top of real location. |
| 7 | Vendor profile screen | Tap vendor name → see full menu grouped by category. Critical for cross-deal discovery. |
| 8 | Reviews flow | Post-redemption write-a-review. DB enforcement already exists. |
| 9 | Real share sheet + deep links + referral attribution | Word-of-mouth growth lever. |
| 10 | Push notifications | Flash deals, vendor blasts. Vendor monetization tier. |

After these 10, we have something close to launchable.

---

## Stretch decisions you'll need to make before launch

These aren't "patches" — they're decisions only you can make. Listed so we don't forget.

- **App name** — "Gloe" is the placeholder we've been building with. Final name → domain → bundle ID → Apple Dev account → Stripe account → trademark.
- **Final pricing model** — flat $99/mo? Per-post? Promoted posts auction? Decision deadline: month 9 of pilot (per spec §7).
- **Pilot city** — San Diego is the obvious one. Confirmed?
- **Vendor recruitment plan** — who walks into the first 30 med spas, when, what brochure they carry.
- **Marketing budget allocation** — you committed $5–8K initial test spend. Where does it go? (Instagram ads, TikTok ads, influencer partnerships, in-spa flyers?)
- **Legal entity** — LLC needed for App Store account, Stripe, vendor contracts. CA or DE? Tax structure?
- **Insurance** — Marketplace platforms typically need general + cyber liability. Talk to a broker.
- **Pre-launch waitlist landing page** — capture vendor + consumer interest before App Store launch.

---

## How we're spending time vs how we should be

**What we've done well:**
- Architecture is clean. Provider/adapter pattern means swapping Clerk or Stripe is one-file work.
- Database schema is solid. PostGIS proven working. RLS in place. Triggers enforce business rules.
- Design system is consistent. Tokens-only, no magic numbers.
- TypeScript end-to-end via tRPC — full autocomplete from screen → API → DB.

**What we've done badly:**
- Spent too long on polish (variant pickers, video carousels, video aspect ratios, naming "claims" vs "deals") before validating with real vendor outreach
- Picked photos casually → broken images
- Fought Clerk's default config instead of just disabling MFA at the start
- Haven't pushed any code to GitHub. **No git history exists yet.** If this Mac dies, the project dies with it.

**What we should do every patch from here on:**
- Commit to git after every working state
- Push to GitHub
- Write at least one test for the new code
- Update this ROADMAP.md

---

## Today's blockers (in order)

1. **Clerk 2FA forcing email_code on every sign-in.** The instance policy is configured to require email verification at sign-in step. Toggle in dashboard: Configure → User & authentication → **User & authentication** (top-level, not "Multi-factor") → Email address card → look for "Used for verification at sign-in" or similar → off.
2. **Confirm sign-in works via API.** I'll re-test with curl the moment you toggle.
3. **Test the live app end-to-end.** Heart a deal → reload → heart persists. Claim a deal → real QR → "Simulate redemption" works.
