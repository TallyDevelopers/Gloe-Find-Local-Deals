# Gloē Web — Consumer Marketplace (source of truth)

> Living build tracker for turning `gloe.app` into a customer-facing marketplace
> that works on phones and computers. **Updated at the end of every phase.**
> Companion to the root `GLOE.md` (which has the product/business overview).

Last updated: 2026-06-02 · All phases (0–4) complete + desktop redesign. Consumer website is feature-complete; remaining items are polish (see end).

---

## The idea

`gloe.app` is **consumer-first**. The site root `/` is the marketplace (browse →
claim/pay → wallet/redeem). Businesses reach their portal through a **"For
Businesses"** link → `/business` → `/vendor` (existing portal). Admin stays at
`/admin`. The mobile app and the website share **one tRPC API** (`apps/api`) and
one design language (warm rose-gold light theme — Fraunces display + Inter body).

Design north star: **gorgeous, editorial, premium.** Light mode only (v1).

---

## Architecture (how the website is built)

- **Next.js 15 App Router**, web-native React (no react-native-web). Styling =
  CSS variables (`src/app/globals.css`) + inline styles, same as the existing
  business pages.
- **Route group `(consumer)`** holds every shopper page and a shared
  `layout.tsx` that renders the consumer shell (top nav on desktop, bottom tab
  bar on mobile). Business/admin/vendor live outside the group, so they keep
  their own chrome.
- **Data**: `trpc` (already wired in `src/lib/TrpcProvider.tsx`, Clerk token
  attached). Public procedures for browsing, protected (Clerk) for
  saved/wallet/account. Full reuse — see API map below.
- **Auth**: Clerk. Consumer sign-in returns the shopper to where they were
  (default `/`); business sign-in still lands on `/vendor`.
- **Payments**: Stripe-hosted Checkout via `checkout.createHostedCheckout`
  (added for web). "Share to pay" reuses `checkout.createGiftLink`.

---

## Route map

| Route | Group | Auth | Status |
|---|---|---|---|
| `/` | consumer | public | Phase 1 |
| `/search` | consumer | public | Phase 1 |
| `/deals/[id]` | consumer | public (SEO) | Phase 1 |
| `/spa/[id]` | consumer | public (SEO) | Phase 1 |
| `/treatments/[slug]` | consumer | public (SEO) | category listing — real route so Back works; header + subtype chips + sort |
| `/saved` | consumer | Clerk | Phase 2 |
| `/wallet`, `/wallet/[id]` | consumer | Clerk | Phase 2 |
| `/account` | consumer | Clerk | Phase 2 |
| `/support`, `/support/[id]` | consumer | Clerk | Phase 4 |
| `/business` | business | public | Phase 0 (moved from `/`) |
| `/vendor/*` | business | Clerk | exists |
| `/admin/*` | admin | Clerk+admin | exists |
| `/gift/[sessionId]` | public | none | exists |

Note the `/vendor` collision: the consumer storefront is **`/spa/[id]`** (the
business dashboard owns `/vendor`).

---

## API surface reused (all in `apps/api`)

- **Browse (public):** `deals.list` `deals.search` `deals.suggest`
  `deals.trending` `deals.byId` `deals.categoryTreatments` ·
  `vendors.storefront` `vendors.byId` · `categories.list` · `reviews.listForVendor`
  · `maps.staticMapUrl` `maps.directions` · `geocode.autocomplete`
  `geocode.placeDetails`
- **Account (Clerk):** `saved.listIds/toggle` `saved.listVendors/toggleVendor` ·
  `claims.list/byId` · `me.whoami/deleteAccount` · `reviews.create/byClaim` ·
  `support.*`
- **Pay (Clerk):** `checkout.createGiftLink` (exists) +
  `checkout.createHostedCheckout` (**new, Phase 3**).

Voucher QR payload = `claim.qrPayload` (`gloe:claim:<uuid>`); backup =
`claim.humanCode` (`GLOE-XXXXX`). Redemption is vendor-only (no consumer redeem).

---

## Device-only → web substitutes

PaymentSheet → hosted Checkout · `react-native-qrcode-svg` → `qrcode.react` ·
Apple Wallet `.pkpass` → on-screen QR (v1) · `expo-location` → browser
Geolocation + manual city (`geocode.*`) saved to `localStorage` · maps/tel →
`maps.apple.com` + `tel:` · secure-store → `localStorage` · native Share →
`navigator.share()` + clipboard.

---

## Build log / checklist

### Phase 0 — Foundation & routing flip ✅ (2026-06-02)
- [x] `WEB.md` (this doc) created
- [x] `/` flipped to consumer (`app/(consumer)/`); business landing → `/business`; middleware updated
- [x] sign-in/sign-up honor `redirect_url` (consumer → `/`, business → `/vendor`)
- [x] consumer shell: `AppShell` / `TopNav` / `MobileTabBar` / `Footer` / `LocationPill`
- [x] `lib/location.tsx` (geolocation + manual fallback + persistence)
- [x] primitives: `DealCard` `CategoryPills` `SaveButton` `icons` `format` `Skeletons` + grid/responsive CSS
- [x] consumer home (`/`) live: hero + search + category filter + deal grid · typecheck clean

### Phase 1 — Browse & discovery (public) ✅ (2026-06-02)
- [x] home feed (`/`) · search (`/search`) · deal detail (`/deals/[id]`) · spa storefront (`/spa/[id]`)
- [x] deal detail: gallery + thumbs, variant picker, sticky purchase panel (desktop) / inline (mobile), provider, static map, reviews, fine print
- [x] all routes return 200 · web + api typecheck clean

### Phase 2 — Account-gated ✅ (2026-06-02)
- [x] `/saved` (Deals + Spas tabs) · `/wallet` (+ `?purchased=1` banner) · `/wallet/[id]` (QR via `qrcode.react`) · `/account`
- [x] `SignInGate` fallback; middleware hard-gates `/saved` `/wallet` `/account` (Clerk `auth.protect()`)
- [x] web typecheck clean · NOTE: gated routes 404 to cookie-less curl (Clerk protect-rewrite) — render fine in-browser

### Phase 3 — Checkout ✅ backend + flow (2026-06-02)
- [x] `checkout.createHostedCheckout` (API) + migration `payment_source IN (…, 'web')`
- [x] Buy now → hosted Stripe Checkout; Share to pay → `createGiftLink`; `useBuy` hook + `PurchasePanel`
- [ ] NOTE: set `PUBLIC_WEB_ORIGIN=http://localhost:3000` on the API for local success/cancel redirects (defaults to prod `gloe.app`)

### Phase 4 — Support, SEO, PWA polish ✅ (2026-06-02)
- [x] legal pages (`/legal/terms`, `/legal/privacy`) — placeholder copy, replace before launch
- [x] dynamic sitemap (home/search/business/legal/auth + live deal + spa URLs from API); `/robots.txt` + `/sitemap.xml` whitelisted in middleware
- [x] PWA manifest + icons verified installable
- [x] support threads (`/support` list+compose, `/support/[id]` thread+reply); linked from account + footer
- [x] SSR + `generateMetadata` for deal + spa (server wrapper + client island via `lib/serverApi.ts`) — real `<title>`/OG/Twitter tags

### Desktop redesign ✅ (2026-06-02) — "computer vibes" / ResortPass-style
- [x] inline nav search (`NavSearch`) + top-right "For Businesses" entrance
- [x] home reworked: value-forward hero + single editorial image (no stacked collage), photo "Browse by treatment" cards, a rail per category (Injectables/Skin/Laser/Peptides…), how-it-works band, closing CTA — one feed query grouped client-side
- [x] **treatments are real routes** (`/treatments/[slug]`) → browser Back works; + visible Back on deal/spa pages
- [x] **desktop filter rail** on treatment pages: sticky sidebar (sub-treatment, price, discount, distance, rating) + sort + live count; `ListingFilters` component
- [x] **mobile = app vibes**: filter rail collapses to a slide-up drawer; marketing bands (how-it-works, CTA) hidden on mobile so the home reads like the native feed. **Desktop = full website.**
- [ ] remaining nice-to-haves: real testimonials/press strip, attachments on support replies, replace legal placeholder copy

---

## How to run / verify

```bash
# API on :4000, then:
npm run dev --workspace=@gloe/web      # http://localhost:3000
npm run typecheck --workspace=@gloe/web
```

Browse `/`, `/deals/[id]`, `/spa/[id]`, `/search` signed-out. Sign in → save →
`/saved`; `/wallet` shows scannable QR. Resize to phone width → bottom tab bar +
single-column grid; desktop → top nav + multi-column.
