# Gloe — Product Spec & Roadmap

> Placeholder name: **Gloe**. Local deal discovery for aesthetics (Botox, filler, lasers, etc.). Vendors post deals; consumers find and redeem them by proximity. Flat-fee SaaS — not a revenue-share marketplace.

---

## 1. Product Vision

**One sentence:** The first place a woman opens when she's thinking about getting Botox, filler, or any aesthetic treatment — to find the best deal near her, today.

**Why it wins:**
- Groupon takes 30–50% per deal and vendors hate it. Gloe charges a flat fee (pricing TBD — see §7) and the vendor keeps 100% of treatment revenue.
- RealSelf killed their iOS app (2025) — the space is open.
- Korean comp UNNI has 5.8M users. Demand is globally validated; US has no equivalent.
- Instagram can't answer "who near me is running a Botox special this week" for a stranger. Gloe can.

**North Star Metric:** Monthly redemptions per active consumer. (Not downloads, not signups — redemptions. That's the only number that proves the loop closes.)

---

## 2. Core User Experience Principles

1. **60-second posting** — A front-desk receptionist must be able to post a deal in under a minute. No copywriting required. Pick service → photo → price → expiration → post.
2. **3-tap discovery** — Open app → see deals near me → tap to redeem. No onboarding wizard, no quiz, no "build your profile."
3. **Trust by default** — Every vendor visibly verified (license #, business address). One bad actor poisons the whole platform.
4. **Urgency-driven** — Deals expire. Limited redemptions ("first 20 only"). FOMO is the engagement engine.
5. **iOS-first polish** — Native feel, haptics, smooth animations, SF Symbols where appropriate. Web is functional, not the showcase.

---

## 3. Tech Stack

### Architecture in one sentence

Expo iOS app + Next.js web app + a **dedicated TypeScript API server** that owns all business logic, talking to a **Postgres database**, with every third-party service (auth, payments, push, storage, search) sitting behind a thin adapter we can swap without touching the domain.

### Locked decisions (non-negotiable)

| Layer | Tech | Why locked |
|---|---|---|
| Database | **Postgres** | PostGIS for proximity, JSONB for modular fields, FTS for early search, mature transactions for billing/redemption, RLS if we need it. Nothing else makes sense. |
| API layer | **Dedicated TypeScript API server (NestJS or Hono)** | The API owns the domain logic. Not buried in mobile/web clients, not buried in Postgres functions. This is what lets us swap auth, payment, push providers without rewrites. |
| Mobile | **Expo (React Native)** | Near-native iOS performance, EAS Build for App Store, OTA updates for non-binary changes, easy Android later. |
| Web | **Next.js (App Router)** | Best-in-class SEO for "Botox deals San Diego" search traffic, server components, simple deploys. |
| Shared UI | **Tamagui in a Turborepo** | Write `<DealCard />` once, renders native on iOS and as HTML on web. Turborepo gives us `apps/mobile`, `apps/web`, `apps/api`, `apps/admin`, `packages/ui`, `packages/domain`. |
| Payments | **Stripe** | The default. Subscription state is reconciled in *our* database from Stripe webhooks — Stripe is the source of truth for charges, our DB is the source of truth for entitlements. |
| Error tracking | **Sentry** | Day 1. Cheap, standard, non-controversial. |
| CI/CD | **GitHub Actions** | Deploy on every merge to staging; manual promote to prod. |
| Monorepo | **Turborepo + pnpm** | One repo, many apps, shared packages, fast incremental builds. |

### Decisions deliberately deferred (pick when we wire them up)

We're not committing to these yet because the right answer depends on a real decision we haven't made (cost, scale, team), and changing them later is cheap if the adapter pattern is in place.

| Layer | Candidates | When to decide |
|---|---|---|
| Postgres host | Supabase Postgres, Neon, RDS, Fly Postgres | When we provision infra. Probably Supabase Postgres for the managed convenience, but we treat it as "just Postgres" — no Supabase-specific features in the domain layer. |
| Auth | Clerk, better-auth, Supabase Auth, Auth0 | When we wire signup. Whichever we pick goes behind an `AuthProvider` adapter so swapping is mechanical. |
| File storage + CDN | Cloudflare R2 + Images, S3 + CloudFront, Supabase Storage | When we wire photo upload. Goes behind a `StorageProvider` adapter. |
| Search | Postgres FTS → Typesense/Meilisearch later | Postgres FTS until we have 5K+ deals. Migrate to Typesense when ranking/typo-tolerance becomes a felt pain. |
| Job queue | Inngest, Trigger.dev, BullMQ + Redis | When we have a real cron/background-job need (subscription renewals, code expiration cleanup, push blast fan-out). Goes behind a `JobQueue` adapter. |
| Push notifications | Expo Push (v1), OneSignal / Customer.io (scale) | Expo Push for the first few thousand users. Adapter pattern from day 1. |
| Maps | Apple MapKit, Mapbox, Google Maps | When we build the map tab. MapKit on iOS, Mapbox on web is the likely answer. |
| Product analytics | PostHog, Amplitude, Mixpanel | When we have users to analyze. Default: PostHog. |
| Logs / metrics | Axiom, Datadog, Grafana Cloud, self-hosted | When debugging blind starts hurting. Sentry covers errors in the meantime. |

### Architecture diagram (text version)

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Expo iOS App   │   │  Next.js Web    │   │  Admin Web App  │
│   (consumer)    │   │  (consumer +    │   │  (Ryan + mods)  │
│                 │   │   vendor dash)  │   │                 │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         │       HTTPS / REST or tRPC                │
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  API Server         │
                    │  (NestJS or Hono)   │
                    │                     │
                    │  ┌──────────────┐   │
                    │  │ Domain Layer │   │  ← pure business logic
                    │  └──────┬───────┘   │     (deal lifecycle,
                    │         │           │      redemption rules,
                    │  ┌──────▼───────┐   │      pricing, etc.)
                    │  │  Adapters    │   │
                    │  └──┬──┬──┬──┬──┘   │
                    └─────┼──┼──┼──┼──────┘
                          │  │  │  │
              ┌───────────┘  │  │  └──────────┐
              │              │  │             │
         ┌────▼─────┐  ┌─────▼──▼────┐   ┌────▼─────┐
         │ Postgres │  │  Stripe     │   │  Push    │
         │ (managed)│  │  Clerk/etc  │   │  Storage │
         └──────────┘  └─────────────┘   └──────────┘
```

The API server is the only thing that talks to the database and to third-party services. Clients never talk to Stripe, Postgres, or Clerk directly. That's the rule.

### Hosting plan

| Asset | Host |
|---|---|
| Marketing site, consumer web, vendor dashboard, admin web | Vercel (Next.js native) |
| API server | Fly.io or Railway (Docker-based, multi-region, easy) — *not* Vercel functions for the main API |
| iOS app | App Store (via EAS Build) |
| Postgres | Managed host TBD (Supabase Postgres, Neon, etc.) |
| File storage / CDN | Cloudflare R2 + Images (probable) |
| Domain + DNS | Cloudflare |

### Why a dedicated API server instead of Supabase-as-backend

Supabase is great as managed Postgres + auth helpers + storage. It is *not* great as the place where your billing state machine, subscription reconciliation, redemption-code generation, vendor approval workflow, push blast fan-out, and Stripe webhook handlers live. Edge functions are limited (Deno runtime, 50s timeout, cold starts, hard to debug), and treating the database as the backend means business logic ends up in SQL or in client code — both bad places.

A dedicated TypeScript API:

- Owns all writes and most reads
- Owns webhook handlers (Stripe, push delivery receipts, etc.)
- Owns background jobs and crons
- Owns third-party adapter implementations
- Is the single source of truth for "is this allowed" (RLS as a safety net, not a primary mechanism)
- Can be deployed/scaled independently of the database

This is the architectural decision Ryan locked. We don't undo it.

### What about v0 / Vercel?

v0.dev is Vercel's AI UI generator — it outputs React/Next.js components. It's a tool we *use* (to scaffold component designs faster), not a thing we *host on*. Vercel hosts the Next.js sites. The mobile app ships through the App Store. The API server runs on Fly.io or Railway. There's no "host the app on v0" — that's not what it is.

### Alternative stacks considered & rejected

- **Swift native + separate React web** — Two codebases, drift, slow. Rejected.
- **Flutter** — Cross-platform but iOS feel is "close, not native." Web support is weak. Rejected.
- **React Native CLI (no Expo)** — Loses OTA updates and EAS conveniences for no real gain at our scale. Rejected.
- **Supabase-as-backend (no API server)** — Hits a ceiling exactly when we need it most. **Rejected per Ryan's call.**
- **Serverless API on Vercel functions** — Cold starts, vendor lock-in, awkward for long-running webhooks and queues. Rejected in favor of a containerized API on Fly.io / Railway.

---

## 4. Screens & UX Flows

### 4.1 Consumer App (iOS + Web)

#### Onboarding (max 3 screens)
1. **Splash + value prop** — "Find Botox & filler deals near you" + Continue button
2. **Location** — Three options:
   - **Use my current location** (asks for OS permission)
   - **Search a location** (e.g., "San Diego, CA" or a ZIP) — for users who deny GPS or want to browse another city
   - **Skip** — Defaults to the user's last city or a popular city; they can change later
3. **Notification permission** — Optional but pitched: "Get notified when flash deals drop near you"

No email signup wall. Browse anonymously. Account only required at redemption.

#### Location handling
- Persists chosen location in user profile (`last_known_location` + `selected_city`)
- Location can be changed any time from Profile → Settings or via a header pill on Discover
- Distance recalculated on every feed load
- Consumer can have a different "browse city" vs "current location" — useful for trip planning ("I'm going to Vegas next week, what's available?")

#### Main tabs (bottom nav)
- **Discover** (home) — Vertical feed of deals sorted by distance, with filters at top: service category, max distance, price range
- **Map** — Apple Maps view with pins; tap pin → deal preview card
- **Saved** — Bookmarked deals + active coupons
- **Profile** — Account, redemption history, monthly limit counter, settings

#### Deal Card (the most-viewed component)
```
┌─────────────────────────────────┐
│  [Hero image]                   │
│                                 │
│  💉 Botox - 20 units            │
│  $200 off  ($350 → $150)        │
│                                 │
│  ⭐ Glow Med Spa  ·  1.2 mi     │
│  ⏰ Expires Sun  ·  🔥 14 left  │
│                                 │
│  [   Get This Deal   ]          │
└─────────────────────────────────┘
```

#### Deal Detail Screen
- Photo carousel (hero + additional + before/after section, clearly labeled)
- Full service description with unit/brand details ("20 units of Dysport — usually $14/unit, today $10/unit")
- Provider info (who's performing it, credentials)
- Vendor card: photo, rating, distance, "View profile"
- Fine print: expiration, redemption limits, restrictions
- **Action row** (sticky at bottom on mobile):
  - **Redeem** (primary) — generates unique coupon code + adds to "Saved → Active coupons"
  - **Save** (bookmark) — store for later, no redemption used
  - **Share** — opens native share sheet (iMessage, Instagram DM, TikTok, copy link, SMS). Generates a unique share link with attribution token so we can track "consumer A invited consumer B who redeemed" (feeds future referral program).
  - **Directions** — opens Apple/Google Maps to vendor address
  - **Call** — taps to call the vendor directly (some users want to ask questions first)
  - **Report** — flag inappropriate content or pricing
- **More like this** at the bottom — similar deals nearby (same category, different vendors)

#### Redemption Flow
- User taps Redeem → confirmation modal ("Use 1 of your 5 monthly redemptions?")
- Confirm → unique 6-digit code generated, timer starts (e.g., 7-day expiration on the code itself)
- Show code at vendor; vendor enters code in their dashboard to mark redeemed
- User gets push notification to leave review 24h after redemption

### 4.2 Vendor Web Dashboard (web-first; mobile responsive)

Vendors live on desktop. They have receptionists with computers. Don't force them into a phone app.

#### Vendor signup flow (one-time, ~5 minutes)

This is gated by admin approval before the vendor can post. See §4.4 for the approval side.

1. **Account creation** — Email, password, business name, primary contact name + phone
2. **Business details** — Address (geocoded), website, Instagram handle, hours of operation
3. **License & verification** — State, license number(s), upload of state medical/aesthetic license, malpractice insurance attestation
4. **Service menu** — Which categories does this practice offer? (Botox, filler, lasers, microneedling, etc.) Multi-select. This filters what they can post deals on.
5. **Practice photos** — Logo, hero image, treatment room photos (min 1, max 10)
6. **Provider profiles** — Who actually performs treatments? Name, title (NP, RN, MD, PA), bio, photo. Multiple providers per vendor allowed.
7. **Plan selection** — Pick a plan (year 1 is free regardless of which). Stripe card on file but not charged until trial ends.
8. **Submit for review** — Status goes to `pending_approval`. Admin reviews license + business legitimacy.

#### Vendor screens (post-approval)

1. **Dashboard** — This month's stats: deal views, redemption code generations, actual redemptions (vendor-confirmed), top-performing deals, upcoming expirations
2. **Post a Deal** — full flow detailed in §4.3 below
3. **Active Deals** — List view: status (active / pending review / expired / sold out / paused), redemptions, days remaining. Edit, pause, duplicate, or end early.
4. **Drafts** — Saved-but-not-submitted deals
5. **Redemptions** — Enter customer code → verify → mark redeemed. Log of recent redemptions with timestamps. Export to CSV.
6. **Reviews** — Read reviews left by redeemers, flag for moderation, respond publicly
7. **Push Notification Blasts** (premium feature, gated by plan) — Compose message, audience size preview, send
8. **Promoted Posts** (v1.3+) — Pick an active deal, choose boost duration/budget, see projected impressions
9. **Billing** — Current plan, year-1-free countdown, posting allowance used vs. remaining, invoice history, payment method
10. **Settings**
    - Business profile (hours, photos, providers, services)
    - Team (add receptionists with their own login, role-based permissions)
    - Notifications (email/SMS for new redemptions)
11. **Help & Support** — Docs, contact, scheduled onboarding call link

### 4.3 The Deal Posting Flow (the most important vendor screen)

Posting must be fast for a simple deal but flexible enough to capture the complexity of aesthetic services (units, brands, redemption caps, etc.). The flow is a step-by-step wizard with smart defaults.

#### Step 1: What's this for?

- **Service category** dropdown (see full taxonomy in §4.3.1 below)
- **Service subtype** — dynamic based on category. For brand-driven services (Botox, filler) this is the specific product.
- **Pricing model** — auto-determined by category but vendor can override:
  - **Per unit** (Botox-family neuromodulators) — number of units × price/unit
  - **Per syringe** (most fillers) — number of syringes × price/syringe
  - **Per session** (most facials, lasers, body treatments)
  - **Per area** (laser hair removal, sometimes filler by area like "lips" or "cheeks")
  - **Per package** (multi-session series like microneedling 3-pack)

#### Step 2: Pricing details

If **unit-based** (e.g., Botox):
- Number of units in this deal (e.g., 20 units)
- Vendor's usual price per unit (e.g., $14/unit)
- Deal price per unit (e.g., $10/unit)
- Auto-calculated: total deal price, % off, $ saved

If **flat-price** (e.g., microneedling session):
- Service description ("60-min microneedling with PRP")
- Usual price
- Deal price
- Auto-calculated: % off, $ saved

#### Step 3: Photos & before/afters
- **Hero image** (required) — used in the feed
- **Additional photos** (optional, up to 6) — treatment room, products used, etc.
- **Before/after photos** (optional but encouraged) — special carousel section on the deal detail screen. Must include consent attestation: "I have the patient's written consent to use these images."
- Photos go through automated NSFW/inappropriate-content check + admin spot-checks

#### Step 4: Redemption rules
- **Total redemptions allowed** — Unlimited / Cap at N (default cap suggestion based on vendor's posting history)
- **Per-customer limit** — Default 1 redemption per customer per deal
- **Code expiration after generation** — How long after a consumer "claims" the deal do they have to use it? Default 7 days, vendor adjustable (1–30 days).
- **Deal listing duration** — How long the deal stays live on the platform. Default 14 days. Max 90 days. (Forces vendors to refresh and post new deals, which keeps the feed lively.)

#### Step 5: Fine print
- **Restrictions** — Free-text + common toggles: "New customers only," "Cannot combine with other offers," "Requires consultation," "Tax & gratuity not included," etc.
- **Booking requirement** — Must redeem within X days of consultation? Same-day OK? Etc.

#### Step 6: Review & submit
- Preview card (what consumers will see)
- Vendor confirms accuracy and consent (legal checkbox)
- Submit → status `pending_review` → admin auto-approves trusted vendors or queues for manual review
- Once approved → status `active` and goes live

#### Smart defaults to keep it fast
- Vendor's previous deals show up as "Duplicate previous deal" shortcuts
- Common service templates pre-fill description fields
- The flow can be completed in 60 seconds for a simple repeat post; takes 3–5 minutes for a brand new deal with before/afters

### 4.3.1 Full Service Taxonomy

This lives in the database (`service_categories` + `service_subtypes`) so admin can edit without code changes. Brand subtypes matter because consumers shop by brand ("I want Dysport, not Botox") and pricing differs significantly between brands.

Inspired by what real practices like Badia (San Diego) actually offer — they go way beyond Botox/filler into wellness, IV therapy, peptides, etc.

#### Neuromodulators (priced per unit)
- Botox
- Dysport (units convert ~2.5× to Botox)
- Xeomin
- Jeuveau ("Newtox")
- Daxxify (longer-lasting)

**Posting fields:** units, price per unit, treatment areas (forehead, glabella, crow's feet, jawline/masseter, lip flip, neck bands, hyperhidrosis)

#### Dermal Fillers (priced per syringe, sometimes per area)
- **Juvederm family** — Ultra, Ultra Plus, Voluma, Volbella, Vollure, Volux, Skinvive
- **Restylane family** — Restylane, Lyft, Kysse, Refyne, Defyne, Silk, Eyelight, Contour
- **RHA family** — RHA 2, 3, 4, Redensity
- **Versa**
- **Radiesse** (calcium hydroxylapatite, also a biostimulator)
- **Sculptra** (poly-L-lactic acid biostimulator, priced per vial, multi-session)
- **Bellafill** (semi-permanent)

**Posting fields:** product, syringes/vials, treatment area (lips, cheeks, chin, jawline, tear trough, nasolabial folds, marionette lines, hands, temples, butt/hip — yes, that's a thing)

#### Other Injectables
- Kybella (submental fat reduction)
- PRP / PRF injections
- B12, vitamin, MIC injections
- Skinvive / hydrating biostimulators

#### Skin Treatments (per session or per package)
- **Facials** — classic, hydrafacial, dermaplaning, custom medical-grade
- **Chemical peels** — light (glycolic, lactic), medium (TCA), deep (phenol)
- **Microneedling** — standard, with PRP, with radiofrequency (Morpheus8, Vivace, Genius RF, Secret RF)
- **Laser resurfacing** — fractional CO2, erbium, non-ablative (Clear + Brilliant, Fraxel)
- **IPL / BBL** (sun damage, redness, pigmentation)
- **Laser genesis / vascular lasers**

#### Body & Fat Reduction (per session or per area)
- CoolSculpting
- Emsculpt / Emsculpt Neo
- truSculpt
- Liposuction (surgical — different category)
- Laser hair removal (priced per area: underarms, full legs, brazilian, full body, etc.)
- Cellulite treatment (QWO, Avéli, Emtone)
- Body skin tightening (Morpheus8 Body, Sofwave, Ultherapy)

#### Wellness & IV (per session or per package)
- IV hydration / Myers cocktail
- NAD+ infusions (longevity)
- Glutathione drips
- Vitamin C / immunity drips
- "Hangover" / recovery drips
- IV + facial combos (Badia's signature)
- Peptide therapy (semaglutide, tirzepatide, BPC-157, ipamorelin, etc.)
- Hormone optimization / TRT / HRT consultations
- Weight loss programs (semaglutide/tirzepatide — huge growth area)

#### Hair & Brows
- PRP for hair restoration
- Microneedling for scalp
- Brow lamination, tinting, microblading, ombre powder brows
- Lash extensions, lash lifts, lash tints

#### Cosmetic Dentistry (some med spas partner with dentists; expand here later)
- Teeth whitening
- Veneers (consults)
- Invisalign (consults)

#### Other / Misc
- Sclerotherapy (spider vein treatment)
- Mole / skin tag removal
- Earlobe repair
- Vaginal rejuvenation (MonaLisa Touch, ThermiVa, O-Shot)
- PRP for sexual wellness (O-Shot, P-Shot)
- Plasma pen / fibroblast

**Important:** Some practices offer **packages and memberships** (e.g., "$2,100 for 3 PRP facials" at Badia). The posting flow must support multi-session deals as a first-class concept, not bolted on:
- Number of sessions included
- Total package price
- Per-session value
- Package expiration (how long they have to use all sessions)

#### Consumer-side implications
- **Filters in the consumer feed** must match this taxonomy — category, subtype/brand, price range, treatment area, package vs single
- "I want Dysport on my forehead under $200 within 5 miles" should be a possible search
- This is a big differentiator vs. Groupon, which lumps everything as "spa deal"

### 4.4 Admin Back End (internal Gloe ops tool)

This is the system *you* use to run the business. Web-only, role-gated, lives at `admin.gloe.app`. Two roles initially: `owner` (Ryan) and `moderator` (eventual hires).

#### Admin sections

1. **Vendor approval queue**
   - Pending vendor signups awaiting review
   - License verification: cross-check license # against state board database (manual at first, eventually automated)
   - Approve / reject / request more info
   - One-click approval for clear-cut cases; flagged items get manual review
   - SLA target: vendor approved within 24 hours

2. **Deal moderation queue**
   - Every new deal flows through here (auto-approved for trusted vendors after their first 5 successful posts)
   - Image review (NSFW, inappropriate before/afters, watermarked stock photos)
   - Pricing sanity check (flag deals that look too good to be true / fraudulent)
   - Compliance check (no medical claims like "permanent results," "FDA approved for X")
   - Approve / reject with reason / request edits

3. **Vendor management**
   - Search/filter all vendors
   - View individual vendor: status, plan, posting history, redemption volume, complaints
   - Adjust posting limits / overrides (e.g., "this vendor gets 10 free posts/month instead of 3")
   - Suspend / unsuspend / ban
   - Manual billing adjustments (credits, refunds, plan changes)
   - Notes field (CRM-style — track conversations, special arrangements)

4. **Consumer management**
   - Search users by email/phone
   - View redemption history
   - Issue manual coupons (partnerships, influencer codes, refunds-as-credit)
   - Adjust monthly redemption limit (VIP override)
   - Suspend / ban (fake account, abuse)

5. **Content moderation**
   - Reported reviews / deals / users queue
   - Bulk actions

6. **Plans & posting limits**
   - Configurable plan definitions: plan name, monthly fee, included posts, post overage rate, push blast quota, promoted post discounts
   - Lets you A/B test pricing without code deploys

7. **Promoted posts management** (v1.3+)
   - Pricing rules
   - Featured slot inventory
   - Performance dashboard for boosted deals
   - Refund / credit logic when boosted deals underperform

8. **Platform analytics**
   - DAU/MAU, downloads, sessions
   - Redemption funnel (view → claim → redeem → review)
   - Vendor cohort retention
   - Revenue by line (subscriptions, promoted posts, push blasts)
   - Geographic heatmaps (where to expand next)

9. **City expansion tooling**
   - Add new city: defines geofence, launches feed
   - City-specific config (default radius, featured vendors, launch promo)
   - Pre-launch waitlist management

10. **Communications**
    - Email vendor blast (announcements, policy changes)
    - Email consumer blast (new feature, weekly deals digest)
    - In-app announcement banners
    - Templates + scheduled sends

11. **Audit log**
    - Every admin action logged with user + timestamp
    - Critical for trust + legal defensibility

#### Why this matters

You can't run a marketplace from the Supabase dashboard. Looking up a vendor record in raw SQL is fine on day 1 with 5 vendors. With 200 vendors you'll be in the admin tool 4 hours a day. Treat the admin tool as a first-class product, not an afterthought.

#### Build order for admin
- **v1 (launch):** vendor approval, deal moderation, vendor management, audit log
- **v1.1:** consumer management, content moderation, plans config
- **v1.2:** platform analytics, communications
- **v2:** city expansion tooling, promoted posts management

---

## 5. Architecture Principles — Build for Modularity

**Reality check:** You will change a lot of decisions over the next 12 months. The pricing model, the posting flow, the service taxonomy, the redemption mechanic — all of it will evolve. The architecture has to absorb that change without rewrites.

### Rules we follow from day 1

1. **Config in the database, not in code.**
   Service categories, subtypes, plans, posting limits, redemption rules — all live in DB tables (`service_categories`, `service_subtypes`, `plans`). When you decide to add "PRP hair restoration" as a category, you add a row, not a code deploy. The admin tool edits these tables.

2. **Feature flags everywhere.**
   Every non-trivial feature is gated by a flag (LaunchDarkly, GrowthBook, or a simple `feature_flags` table in Postgres served by the API). Promoted posts, push blasts, before/after photos, sharing, in-app booking — all flippable per-user, per-vendor, or globally without a deploy.

3. **Schema designed for additive change.**
   - `restrictions jsonb` instead of 15 boolean columns — add a new restriction type without a migration.
   - `metadata jsonb` on most tables for future fields we haven't thought of.
   - Avoid enums in Postgres — use `text` columns with an app-level constant list. Adding "rejected" to deal status shouldn't need a migration.

4. **Hexagonal/clean architecture in the API server.**
   - **Domain layer** — pure business logic (deal lifecycle, redemption rules, pricing calculations, subscription state). No framework or vendor dependencies. Trivially unit-testable.
   - **Adapter layer** — wraps Postgres, Stripe, auth provider, push provider, storage, etc. If we swap Clerk for better-auth, only the `AuthProvider` adapter changes.
   - **HTTP layer** — REST/tRPC handlers that call into the domain. Thin.
   - **Clients** (mobile, web, admin) — consume the API via typed SDK. They never touch the database, Stripe, or any third-party service directly.
   This sounds like over-engineering for an MVP. It's not. Swapping a payment provider 9 months in is a 3-day job, not a 3-week job, if it's built this way.

5. **Plug-in style for monetization.**
   The billing system reads from the `plans` table. Adding a new revenue line (e.g., promoted posts) doesn't require restructuring billing — it's a new line item that plugs into the same invoice pipeline.

6. **Service taxonomy is hierarchical and editable.**
   Category → Subtype → Deal. Admin can add/rename/deactivate any node without breaking existing deals (soft-delete via `active` flag; existing deals keep their reference).

7. **Versioned everything.**
   - API routes versioned (`/api/v1/...`) so we can ship breaking changes without breaking the mobile app for users who haven't updated.
   - Deal records keep history (a `deal_versions` table or revision logs) so we can show "deal was edited" and prevent bait-and-switch.

8. **Modular UI components.**
   `<DealCard variant="feed" />`, `<DealCard variant="map" />`, `<DealCard variant="share-preview" />` — same component, different presentations. When the design changes, change it once.

9. **Migration discipline.**
   Every schema change is a numbered migration file checked into git (Prisma Migrate, Drizzle, or plain SQL — pick when we start, but commit to one). No editing tables in any dashboard. This is what lets staging and production stay in sync.

10. **Test the seams.**
    Unit tests on the domain layer. Integration tests on the adapters. End-to-end tests only on the critical paths (signup, post deal, redeem). Don't aim for 90% coverage — aim for "the parts that would be expensive to break are covered."

### What "modular" looks like in practice

If a year from now you want to:
- Add a new service category ("Hair restoration") → admin adds a row, takes 30 seconds
- Change pricing from flat-fee to per-post → edit a row in `plans`, no deploy needed
- A/B test a new redemption mechanic (QR code vs 6-digit) → feature flag, half of users get the new flow
- Launch in Vegas → admin tool: add city, define geofence, done
- Swap Stripe for another payment processor → replace the payment adapter, ~2-3 days of work
- Add "in-app booking" → new module, hooks into existing deal/redemption flow, doesn't touch other domains

That's the bar.

---

## 6. Database Schema (Supabase / Postgres)

```sql
-- Core tables

users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  phone text,
  created_at timestamptz,
  location geography(POINT),  -- last known, for "near me"
  redemptions_this_month int DEFAULT 0,
  redemption_reset_at timestamptz
)

vendors (
  id uuid PRIMARY KEY,
  business_name text NOT NULL,
  owner_user_id uuid REFERENCES users(id),
  address text,
  location geography(POINT) NOT NULL,  -- PostGIS for distance
  license_number text,
  license_state text,
  verified_at timestamptz,
  subscription_tier text,  -- 'free_trial' | 'basic' | 'pro' | 'elite'
  trial_ends_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz
)

-- Service taxonomy (admin-managed, NOT hardcoded — see modularity note)
service_categories (
  id uuid PRIMARY KEY,
  slug text UNIQUE,           -- 'botox', 'filler', 'laser', etc.
  display_name text,
  icon text,
  is_unit_based boolean,      -- true for Botox/filler, false for facials
  display_order int,
  active boolean DEFAULT true
)

service_subtypes (
  id uuid PRIMARY KEY,
  category_id uuid REFERENCES service_categories(id),
  slug text,                  -- 'dysport', 'juvederm', 'restylane', etc.
  display_name text,
  unit_label text,            -- 'units', 'syringes', 'sessions', etc.
  active boolean DEFAULT true
)

vendor_services (
  vendor_id uuid REFERENCES vendors(id),
  category_id uuid REFERENCES service_categories(id),
  PRIMARY KEY (vendor_id, category_id)
)

providers (
  id uuid PRIMARY KEY,
  vendor_id uuid REFERENCES vendors(id),
  name text,
  title text,                 -- 'MD', 'NP', 'RN', 'PA'
  bio text,
  photo_url text,
  license_number text
)

deals (
  id uuid PRIMARY KEY,
  vendor_id uuid REFERENCES vendors(id),
  category_id uuid REFERENCES service_categories(id),
  subtype_id uuid REFERENCES service_subtypes(id),
  title text,
  description text,
  hero_image_url text,
  -- Pricing: unit-based or flat
  is_unit_based boolean,
  unit_count int,             -- e.g., 20 (units of Botox)
  unit_label text,            -- 'units', 'syringes' (denormalized from subtype for display)
  original_price_cents int,   -- always represents total (per-unit * count or flat)
  deal_price_cents int,
  -- Redemption rules
  quantity_total int,         -- null = unlimited
  quantity_redeemed int DEFAULT 0,
  per_customer_limit int DEFAULT 1,
  code_validity_days int DEFAULT 7,
  -- Lifecycle
  starts_at timestamptz,
  expires_at timestamptz,
  status text,                -- 'draft' | 'pending_review' | 'active' | 'expired' | 'sold_out' | 'paused' | 'rejected'
  rejection_reason text,
  -- Restrictions
  restrictions jsonb,         -- flexible: {new_customers_only: true, requires_consultation: false, ...}
  fine_print text,
  -- Audit
  approved_by uuid REFERENCES admin_users(id),
  approved_at timestamptz,
  created_at timestamptz
)

deal_photos (
  id uuid PRIMARY KEY,
  deal_id uuid REFERENCES deals(id),
  url text,
  photo_type text,            -- 'hero' | 'additional' | 'before_after'
  display_order int,
  consent_attested boolean DEFAULT false  -- required true for before_after
)

redemptions (
  id uuid PRIMARY KEY,
  deal_id uuid REFERENCES deals(id),
  user_id uuid REFERENCES users(id),
  vendor_id uuid REFERENCES vendors(id),
  code text UNIQUE,           -- 6-digit shown to vendor
  status text,                -- 'generated' | 'redeemed' | 'expired'
  redeemed_at timestamptz,    -- null = generated but not used yet
  redeemed_by_admin uuid,     -- which vendor team member entered the code
  code_expires_at timestamptz,
  created_at timestamptz
)

deal_shares (
  id uuid PRIMARY KEY,
  deal_id uuid REFERENCES deals(id),
  user_id uuid REFERENCES users(id),   -- null = anonymous share
  channel text,                         -- 'imessage' | 'instagram' | 'tiktok' | 'copy_link' | 'sms' | 'email' | 'other'
  share_token text UNIQUE,              -- for attribution: who shared, who clicked
  created_at timestamptz
)

deal_views (
  id uuid PRIMARY KEY,
  deal_id uuid REFERENCES deals(id),
  user_id uuid,                         -- nullable for anonymous
  source text,                          -- 'feed' | 'map' | 'shared_link' | 'push' | 'search'
  share_token text,                     -- if arrived via share, who shared
  created_at timestamptz
)

admin_users (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  role text,                  -- 'owner' | 'moderator'
  created_at timestamptz
)

admin_audit_log (
  id uuid PRIMARY KEY,
  admin_user_id uuid REFERENCES admin_users(id),
  action text,                -- 'approve_vendor', 'reject_deal', 'suspend_user', etc.
  target_type text,           -- 'vendor' | 'deal' | 'user' | 'redemption'
  target_id uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz
)

plans (
  id uuid PRIMARY KEY,
  slug text UNIQUE,
  display_name text,
  monthly_price_cents int,
  included_active_deals int,           -- how many deals can be active at once
  overage_per_deal_cents int,          -- cost per extra active deal
  included_push_blasts_per_month int,
  push_blast_overage_cents int,
  promoted_post_discount_pct int,
  active boolean DEFAULT true,
  created_at timestamptz
)

reviews (
  id uuid PRIMARY KEY,
  redemption_id uuid REFERENCES redemptions(id),  -- only verified redeemers can review
  user_id uuid REFERENCES users(id),
  vendor_id uuid REFERENCES vendors(id),
  rating int CHECK (rating BETWEEN 1 AND 5),
  body text,
  created_at timestamptz
)

push_blasts (
  id uuid PRIMARY KEY,
  vendor_id uuid REFERENCES vendors(id),
  message text,
  radius_miles int,
  sent_at timestamptz,
  recipients_count int,
  clicks_count int
)

saved_deals (
  user_id uuid REFERENCES users(id),
  deal_id uuid REFERENCES deals(id),
  PRIMARY KEY (user_id, deal_id)
)
```

**Key queries:**
- "Deals near me" → PostGIS `ST_DWithin(vendors.location, user_point, radius_meters)` joined to active deals
- "Vendor dashboard stats" → aggregations on `redemptions` filtered by `vendor_id` and date
- Monthly redemption limit → `users.redemptions_this_month` reset by scheduled edge function

**Row Level Security (RLS):**
- Users can only see their own redemptions, reviews, saved_deals
- Vendors can only see redemptions/blasts for their own `vendor_id`
- Deals are publicly readable when `status = 'active'`

---

## 7. Release Roadmap

### v1.0 — MVP Launch (San Diego)
**Goal:** Prove vendors will post and consumers will redeem.

- iOS app + responsive web (consumer)
- Vendor web dashboard
- Deal posting (single category dropdown, photo, price, expiration)
- Distance-based discovery
- Coupon code redemption (manual, vendor enters code)
- Anonymous browsing, account at redemption
- Stripe billing scaffolded (pricing model TBD — see §7), with year-1-free trial logic in place
- Basic admin panel

**Not in v1:** No reviews, no push blasts, no map view, no Android.

### v1.1 — Trust & Discovery (Month 2–3)
- Verified reviews (only redeemers can review)
- Map view with deal pins
- Vendor profile pages with all active deals + review aggregate
- Save / bookmark deals
- Saved searches → email when matching deal posted

### v1.2 — Push Notification Engine (Month 3–4)
- Consumer notification preferences (categories, max distance, price range)
- Vendor push blast composer (premium tier — pricing TBD)
- "Flash deal" badge + 1-hour countdown
- Geo-fenced notifications ("Botox deal 2 blocks away expires in 1hr")

### v1.3 — Promoted Posts (Month 4–5)
- Vendors can pick a specific deal and pay to boost it
- Boosted deals appear at the top of the discovery feed, in a dedicated "Featured" carousel, and get priority weight in nearby-deal sorting
- Clearly labeled "Sponsored" — no dark patterns
- Pricing model TBD: per-day boost, per-impression, or per-click. Probably starts as a flat per-day fee for simplicity.
- This is a major revenue line — vendors will pay real money to outrank competitors on a high-intent platform

### v2.0 — Multi-City Expansion (Month 6–9)
- City picker + city-specific feeds
- Launch LA, Vegas, Miami, NYC
- Referral program (consumer gets bonus redemption for inviting a friend who redeems)
- Android app (Expo build, minimal extra work)

### v2.1 — In-App Booking
- Calendar integration with vendor's existing booking system (Vagaro, Boulevard, Mindbody APIs)
- Book + pay deposit in-app
- This is where the platform becomes sticky — vendors won't churn if Gloe is their booking pipeline

### v3.0 — Loyalty & Subscription (Year 2)
- Consumer subscription tier "Gloe Plus" ($9.99/mo) — 10 redemptions/mo instead of 5, early access to deals, exclusive flash drops
- Vendor loyalty rewards — repeat customers tracked across vendors, badges
- "Gloe Concierge" — chat with a human (or AI) for personalized recommendations

### v3.5 — Adjacent Categories
- Expand beyond aesthetics: cosmetic dentistry, hair restoration, IV therapy clinics, wellness/cryo, tattoo/piercing
- Keep the brand tight — "premium personal-care deals," not "all coupons"

### v4.0 — Network Effects
- Vendor-to-vendor referrals (one med spa refers another, both get billing credit)
- API for booking-platform integrations (Vagaro, Boulevard partner integrations)
- White-label option for franchise med spa chains
- Possible acquisition / partnership conversations (Allergan/AbbVie, Galderma)

---

## 8. Monetization & Pricing

**Status: open. Pricing is a year-2 problem.** Year 1 is free for all vendors to seed supply, so we have time to test what actually converts before committing to a model.

### Revenue lines being considered

These are not mutually exclusive — the final model will likely be a mix of subscription + usage + ads.

#### A. Flat-fee subscription
- One monthly price, unlimited posts. Simplest to sell ("$X/mo, no surprises").
- Risk: heavy users get an unfair deal, light users feel they're overpaying.

#### B. Per-post pricing
- Flat-fee subscription gets you a small allotment, then per-post charges.
- Example shape: $99/mo includes 1 active deal at a time, each additional simultaneous deal is +$80/mo.
- Or pure per-post: $X per deal posted, no subscription floor.
- Aligns price with vendor activity — heavy posters pay more, which is fair.

#### C. Promoted posts / paid placement (v1.3)
- On top of any base plan. Vendor picks one of their existing deals and pays to boost it.
- Pricing options to test: per-day, per-impression, per-click, or auction-style bidding.
- High intent platform + clear ROI for vendors = real revenue. This may end up being the biggest line.

#### D. Push notification blasts
- Vendor pays to push a deal to opted-in consumers in their area.
- Either included in a high tier or charged per-blast (e.g., $X per 1,000 recipients).
- Per-blast scales revenue but adds friction.

#### E. Redemption-cap upsell
- Vendors can cap how many people redeem a deal (already a v1 feature).
- Higher caps could cost more — e.g., 20 redemptions free, additional redemptions $X each.
- Possibly too clever for v1. Park it.

#### F. Consumer-side (v3+)
- "Gloe Plus" consumer subscription — more monthly redemptions, early access, exclusive flash drops.
- Pure upside, doesn't affect vendor side.

### What to decide and when

| Decision | When |
|---|---|
| Year 1 is free for everyone | ✅ Decided |
| Base model after year 1 (flat vs per-post vs hybrid) | Decide by month 9 of pilot — use real posting-frequency data |
| Promoted posts pricing | A/B test in v1.3 — start with one simple option, iterate |
| Push blast pricing | Decide alongside v1.2 launch |
| Consumer subscription | Year 2+, only if engagement metrics support it |

### Guiding principle

Whatever the model ends up being, it has to clear two bars:
1. **Cheaper than the equivalent on Instagram/Google ads** for the vendor — that's the ceiling.
2. **Way better economics than Groupon's 50% cut** — that's the floor, and it's a huge gap.

There's a lot of room to land between those two.

---

## 9. Infra & Cost Estimates

### Year 1 (San Diego pilot, ~150 vendors, ~5K consumer downloads)

| Item | Cost |
|---|---|
| Apple Developer | $99/yr |
| Supabase Pro | $25/mo |
| Vercel Pro | $20/mo |
| Mapbox (or free MapKit on iOS) | $0–$50/mo |
| Domain + email (Cloudflare + Google Workspace) | ~$20/mo |
| Expo EAS (Production plan, optional) | $99/mo or pay-per-build |
| Stripe | 2.9% + $0.30 per vendor charge (year 1: $0, free trials) |
| Marketing budget (you committed $5–8K) | $5–8K |
| **Estimated infra year 1** | **~$2K + marketing** |

### Year 2 (5 cities, ~700 vendors, ~50K consumer downloads)

Costs depend heavily on which monetization model is in play, but baseline infra:

| Item | Cost |
|---|---|
| Supabase Team | $599/mo (or stay on Pro with add-ons) |
| Vercel Pro / Enterprise | $20–$200/mo |
| Push notifications (OneSignal scale) | $99/mo |
| CDN / image storage | $50/mo |
| Stripe fees | ~3% of vendor revenue |
| **Baseline infra ~** | **~$1K/mo + Stripe fees** |

SaaS at this scale generally clears 85–90% gross margin once pricing is set, regardless of which model wins. Infra is not the constraint — vendor acquisition is.

---

## 10. Legal & Compliance Notes (talk to a lawyer, not me)

- **Platform liability** — Gloe is a marketplace, not a medical provider. TOS must be explicit. Require vendors to carry malpractice insurance and attest to licensing on signup.
- **License verification** — Manually verify state license numbers at first. Don't let unverified providers post. This is your moat AND your liability shield.
- **HIPAA-adjacent** — You're not handling PHI (you don't store medical records), but be careful about reviews mentioning specific procedures + names. Default to first-name-only on public reviews.
- **FTC fake review rules** — No incentivized reviews, no fake reviews, ever. Reviews must be tied to a real `redemptions.id`.
- **State laws** — Some states (e.g., CA) regulate advertising of medical procedures. Boilerplate "results not guaranteed" disclaimers on every deal.
- **Apple App Store** — Medical/aesthetic apps occasionally get rejected. First submission expect rejection; common reason is "needs medical disclaimer" or "verify provider credentials." Bake the disclaimer into the deal detail screen from day 1.

---

## 11. Open Questions (decide before v1 build)

1. **Coupon redemption mechanic** — 6-digit code entered by vendor? Or QR code scanned? Code is simpler v1, QR scales better.
2. **Photo strategy** — Vendor uploads only, or stock library by category? Stock library lowers posting friction but feels less authentic.
3. **Pricing display** — Always show $ off, or % off, or both? A/B test post-launch.
4. **Consumer account requirement** — Anonymous browse + account at redemption (current plan), or require account upfront (better data, more friction)? Recommend anonymous.
5. **Refund / no-show policy** — What if a redeemed deal is honored but the consumer no-shows the appointment? Vendor's call or platform policy?
6. **Geographic expansion trigger** — Move to next city when San Diego hits X vendors / Y redemptions, or by date?
7. **Redemption caps as a vendor feature** — Should every deal have an optional "max N redemptions" cap by default? (Already planned for v1.) Do we charge more for higher caps? (See §7E — probably not in v1.)
8. **Promoted post UI placement** — Where exactly do boosted deals show up? Dedicated "Featured" row at top of feed, or interleaved with organic results? Affects perceived fairness for unboosted vendors.

---

## 12. Design System & Visual Quality Bar

**Hard requirement: this app has to look and feel like a polished consumer product on day one.** Groupon's UI is mediocre but functional and consistent — that's the floor, not the ceiling. The actual references are DoorDash, Airbnb, Resy, Glossier's app, and Sephora. Premium, modern, considered.

If the app looks like a hackathon project the moment someone opens it, no marketing budget saves it. Consumer apps live or die on the first 10 seconds.

### Visual quality bar (non-negotiable)

| Element | Standard |
|---|---|
| Typography | Custom font (e.g., Inter, GT America, or a paid serif like Söhne). No system default. Proper type scale, line heights tuned. |
| Color | Defined palette tokens: primary, neutral scale (10 steps), semantic (success/error/warning), surface, overlay. Light + dark mode from day 1. |
| Spacing | 4pt grid. Every margin, padding, gap is a token, not a magic number. |
| Iconography | One icon library (Lucide or Phosphor), consistent stroke weight. No mixing icon styles. |
| Imagery | Real, high-resolution photos. Curated stock library by category for vendors who don't upload their own. No clip art. |
| Motion | Tasteful transitions on screen change, sheet presentations, button presses. Spring physics, not linear interpolations. Reanimated 3 on mobile. |
| Haptics | Light tap on button press, success haptic on redemption, selection haptic on filter changes. iOS expects this. |
| Empty states | Every list/feed has a designed empty state — illustration + helpful copy + clear CTA. Never a blank screen. |
| Loading states | Skeleton screens, not spinners. Match the layout of the content that's loading. |
| Error states | Friendly, actionable. Never raw error codes. Always a retry option. |
| Accessibility | Min 4.5:1 contrast, dynamic type support, VoiceOver labels on all interactive elements. Apple actually rejects apps for failing this. |

### Design tokens (locked into the codebase)

Lives in `packages/ui/tokens.ts` — single source of truth for both mobile and web.

```ts
// Example structure — concrete values picked when we hire/contract a designer
export const tokens = {
  color: {
    brand: { 50, 100, 200, ..., 900 },     // brand color scale
    neutral: { 0, 50, ..., 950 },           // gray scale
    semantic: { success, error, warning, info },
    surface: { primary, secondary, elevated, overlay },
    text: { primary, secondary, tertiary, inverse, link, disabled }
  },
  space: { 0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64 },
  radius: { none, sm, md, lg, xl, pill, circle },
  fontSize: { xs, sm, base, lg, xl, '2xl', '3xl', '4xl', '5xl' },
  fontWeight: { regular, medium, semibold, bold },
  shadow: { sm, md, lg, xl },
  motion: { fast, normal, slow, springs: { gentle, snappy, bouncy } }
}
```

Components consume tokens, never hex codes or pixel values. Theme change (dark mode, future brand refresh) is a token swap.

### Component library

Built in `packages/ui` on top of Tamagui. Every screen is composed from these — no one-off styling in screen files.

**Primitives:**
- `Button` (variants: primary, secondary, ghost, destructive; sizes: sm, md, lg)
- `Input`, `TextArea`, `Select`, `Checkbox`, `Toggle`, `RadioGroup`
- `Card`, `Sheet`, `Modal`, `Drawer`
- `Avatar`, `Badge`, `Chip`, `Tag`
- `Skeleton`, `Spinner`, `Toast`
- `Stack`, `Row`, `Spacer`, `Divider`
- `Icon` (wraps the chosen icon library)

**Composite components:**
- `DealCard` (variants: feed, map-popup, share-preview, saved)
- `VendorCard` (variants: detail-header, list-item, search-result)
- `CouponDisplay` (the redemption code screen — big, screenshottable)
- `FilterBar` (category, distance, price)
- `EmptyState` (illustration + copy + CTA)
- `LoadingScreen` (branded splash with skeleton)

### Designer / design source of truth

Honest take: **hire a real designer or buy a high-quality starter design**. Code alone, even with Claude, will not produce a consumer-grade app. Cursor and Claude can implement a great design at speed; they can't *invent* one that looks premium.

Options, ranked by what I'd actually do:

1. **Hire a freelance product designer for 4–8 weeks** ($8–20K total). They deliver a Figma file with every screen, full design system, prototype. We implement from it. This is the right move for a consumer app you're betting real money on.
2. **Buy a premium design template** (e.g., Untitled UI, Setproduct, Tailwind UI app templates) for $200–500 and customize heavily. Faster, cheaper, less unique.
3. **DIY in Figma using v0.dev + Claude for component design** — fastest, cheapest, but ceiling is "looks decent, not memorable."

Recommendation: option 1. Budget for it. The design is the product for a consumer marketplace.

### What "Groupon-level UI" actually means and how we beat it

Groupon's strengths to match: consistent typography, clean cards, decent filters, fast load times, good photography on deals.

Groupon's weaknesses to beat:
- Cluttered home feed — too many promos and banners competing
- Generic deal photography — interchangeable across categories
- Cheap-feeling color palette (oranges and reds shouting "discount")
- Tabs and nav inherited from 2014
- Coupon redemption screen is a mess

Gloe should feel premium and editorial — closer to Resy or Airbnb than Groupon. The whole point is to remove the "coupon site" stink. Premium pricing, premium UI.

### Quality gates before any launch

- Internal design review pass — every screen reviewed against the design system
- TestFlight feedback from at least 10 non-technical users with a structured questionnaire
- App Store screenshots designed (not raw screenshots — actual marketing screenshots with captions and device frames)
- App icon designed by a real designer, not generated
- Onboarding flow tested for first-impression quality with people who've never seen it

---

## 13. Brand & Tone (early thoughts)

- **Tone:** Confident, a little playful, never clinical. "Find your glow" not "Discover certified aesthetic providers in your area."
- **Visuals:** Soft, premium, slightly editorial. Not pink-and-glitter. Think Glossier × Airbnb.
- **Photography:** Real treatment rooms, real (consenting) clients, golden hour lighting. Avoid stock-photo lip injection close-ups.
- **Voice in copy:** Talk like a friend who knows where the deals are. Never talk down to consumers.

---

*Last updated: 2026-05-18*
