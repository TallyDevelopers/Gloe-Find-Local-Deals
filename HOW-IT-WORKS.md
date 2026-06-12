# How Gloē Works — The Complete Tour

> **Who this is for:** you, the founder. This is the plain-language, end-to-end walkthrough of
> how Gloē actually behaves — how the homepage loads, when things load, when they update, how
> "trending" is computed, how money moves, what happens in every edge case, down to the
> nitty-gritty. Every detail here was traced against the real code, not guessed.
>
> **How this differs from `GLOE.md`:** `GLOE.md` is the precise engineering spec (for builders +
> AI agents). *This* doc is the readable story — same facts, friendlier voice. Each section ends
> with a *Deeper* line pointing to the exact code so you can drill in.
>
> **Living doc:** this gets updated every time we ship a ticket that changes how the app behaves.
> If anything here doesn't match what the app actually does, that's a bug — tell me.

---

## Contents

0. [What it's built on (the 60-second tech tour)](#what-its-built-on-the-60-second-tech-tour)
1. [Opening the app](#1-opening-the-app)
2. [Finding deals (the home feed)](#2-finding-deals-the-home-feed)
3. [How ranking & "trending" actually work](#3-how-ranking--trending-actually-work)
4. [Search](#4-search)
5. [The map](#5-the-map)
6. [Looking at a deal & a spa](#6-looking-at-a-deal--a-spa)
7. [Buying, the voucher, and redeeming](#7-buying-the-voucher-and-redeeming)
8. [How the money moves](#8-how-the-money-moves)
9. [Credits, promos & referrals (the incentives engine)](#9-credits-promos--referrals-the-incentives-engine)
10. [The vendor side](#10-the-vendor-side)
11. [Behind the glass (admin god-mode)](#11-behind-the-glass-admin-god-mode)
12. [Accounts & login](#12-accounts--login)
13. [Emails & notifications](#13-emails--notifications)
14. [Support / Concierge](#14-support--concierge)
15. [The website (gloe.app)](#15-the-website-gloeapp)
16. [What's NOT built yet](#16-whats-not-built-yet)

---

## What it's built on (the 60-second tech tour)

You don't need this to use the rest of the doc — but if someone asks "what's Gloē actually made of," here's the honest answer, in plain terms.

There are **three apps and one brain.** The brain is the **API** — it holds every rule (who can buy, what the fee is, when a vendor gets paid). The three apps are just different front doors to it: the **iPhone app** (what customers use), the **website** (the vendor portal + your admin "god mode"), and they all talk to that one API. One rulebook, three doors — change a rule once and it's true everywhere.

The pieces, and why each is there:

- **The language is TypeScript everywhere** — phone, website, server all speak the same one, so a typo or a mismatched price can't sneak between them; the computer catches it before a human does.
- **The phone app is Expo / React Native** — one iPhone app, built to feel native.
- **The website is Next.js.** It's the consumer marketplace *and* the vendor dashboard *and* god mode.
- **The database is Postgres (via Supabase)** — the permanent record of every deal, voucher, and dollar. It also knows geography (for "near me") natively.
- **Login is Clerk** — a hosted service that handles passwords, social sign-in, and security so we never store a raw password. (Apple sign-in is the one piece still pending.)
- **Money is Stripe** — specifically Stripe Connect, which handles paying the spas, tax forms, and the whole dispute/chargeback machinery. **Stripe is the source of truth for money; our database just mirrors what Stripe confirms.**
- **Emails are Resend** — welcome, receipts, refund confirmations, and expiry reminders, all branded. (Login codes come from Clerk separately.)
- **Push notifications go straight to Apple** (no middleman), driven by an admin-controlled registry so you decide what fires and when.
- **It all runs on Railway**, and pictures/videos live in Supabase Storage.

The whole thing is **one codebase** (a "monorepo"), deliberately built on boring, proven tools so a solo founder can run the entire business without it falling over. *(For the exact versions + the "why" on each choice, see `GLOE.md` §3 "Stack (locked).")*

---

## 1. Opening the app

### We figure out where you are — quietly

The home feed is about deals *near you*, so the very first thing the app needs is a location.
We're deliberate about how we get it, because nothing kills a first impression like a cold
permission pop-up before you've seen anything.

There are exactly **three location states**: `unset`, `gps`, and `picked`.

- **On launch, we check — we don't ask.** The app calls a *permission check* (not a request),
  so no OS dialog appears. If you'd already granted location on a previous run, we silently
  read your last known position (a 10-minute cached fix, falling back to a fresh read) and the
  feed **comes alive with zero taps** — your location shows as a calm "Near you," nothing more.
- **If we genuinely don't know where you are** (`unset` state), the entire home feed is replaced
  by a single full-screen **Location Gate** — one clean "share your location" ask. No half-feed,
  no empty grid. Nothing is fetched until you resolve it.
- **If you tap it and allow,** the feed lights up. **If you deny,** we fall back to a **location
  picker** with three ways in: **start typing an address or city and suggestions populate live**
  (Google-powered — "San Juan Cap…" surfaces "San Juan Capistrano, CA" before you finish typing), tap
  **"Use my current location"** (GPS), or pick one of the **popular markets**. Any of them sets your
  location the same as GPS would.

> 💡 **Cost note (for you, the founder):** sharing location via GPS and tapping a popular city are
> *free* — they never touch Google. Only **typing** in the location search calls Google (the live
> suggestions). At a few thousand users that's comfortably inside Google's $200/mo free credit, so
> effectively $0. Past ~10k users we'll add "session tokens" to keep it cheap (there's a TODO in the
> code). Worth setting a Google Cloud billing alert regardless, as an accident guard.

There's a San Diego coordinate baked in as a default — but it's **only a map camera position**
(so the map isn't "a blank ocean"), never surfaced as "your location." Until you have a real
location, you're in `unset` and you see the gate.

**Why it's built this way:** home stays pristine. We handle location invisibly when we can, ask
politely once when we must, and never nag on a cold start. Once a location is set, the city you're
browsing shows up **inside the search bar itself** — a small "📍 City" segment on the left, a hairline
divider, then the usual "Search …" with its cycling treatment word. It quietly answers "where am I
searching?" at a glance, and tapping the city opens the picker so you can change where you're browsing
without detouring into Map or Search. We fold it into the search bar (rather than a separate pill)
because a standalone pill either collided with the cycling placeholder or floated alone leaving dead
space — one control reads clean. Before you're located there's no city segment; the full-screen gate
owns that state.

*Deeper: `GLOE.md` §6 "Location gate (GLO-26)". Code: `SelectedLocationProvider.tsx`, `LocationGate.tsx`, `SearchBar.tsx`, `discover.tsx`.*

### If you're in a city we haven't launched in yet

We launch city by city (LA / Orange County / San Diego today). So what does someone in, say,
Phoenix see? **Not a sad empty screen.**

- We detect the specific situation "**we know where you are, but we have zero deals within 50
  miles**" (and you haven't applied any filters). When that's true, the feed is swapped for a
  **"Gloē is growing" / Coming Soon** screen.
- It **tells the truth about where we're live** — it lists the cities that *actually* have live
  deals right now, pulled fresh from the database. So it's never stale, even as you open new cities.
- It **collects demand**: drop your email and we store it with your city + coordinates. In admin,
  you see exactly which cities people are asking for — your expansion roadmap, ranked by real demand.
- The gate is **data-driven, not hardcoded**. The moment a vendor in a new city posts the first
  live deal, the next nearby user sees a real feed automatically — no deploy, no toggle.
  *The first listing unlocks the city.*
- They can **look around a live area before we reach them**: an "**Explore a live city**" row opens
  the same location picker, so they can enter an address or tap one of our live cities and see exactly
  how Gloē works. Picking a city with deals flips the feed and this screen falls away.
- There's also a blunter **escape hatch**: a "Browse SoCal deals" button drops them straight into our
  live region anyway.

One careful detail: this only triggers *after* GPS has actually resolved, so it never flashes
during the split-second of locating you (the app starts on the San Diego fallback, which has
deals, so there's no empty flicker).

> ⚠️ When someone joins this waitlist, **no email goes out yet** — it's pure demand collection for
> now. (See [§16](#16-whats-not-built-yet).)

*Deeper: `GLOE.md` §6 "Out-of-area gate". Code: `ComingSoon.tsx`, `waitlist.router.ts`, `deals.ts`.*

---

## 2. Finding deals (the home feed)

### The whole screen loads in ONE request

When you land on Discover, the entire screen — the category rails and everything in them — comes
back from a **single** server call (`deals.discoverFeed`). The server fans out to fetch each
category's deals *concurrently on its end*, then hands you one tidy response.

This matters more than it sounds: the original design fired one request *per rail* (8+ rails at
once), which literally **drained the database connection pool**. Folding it into one call — with a
single shared "trending config" read instead of one per rail — is what keeps the home screen fast
and cheap.

### Three tricks make it feel instant

1. **We remember what we just saw (30 seconds).** After a feed loads, it stays "fresh" for 30s.
   Hop to another tab and back within that window and it paints **instantly** from cache — zero
   refetch, zero spinner.
2. **No flicker when you change anything.** Tap a different category or filter and the old cards
   **stay on screen, dimmed**, while the new ones load behind them. The app never blanks out and
   "reloads" — it just swaps. (React Query's `keepPreviousData`.)
3. **Pictures are downloaded before you scroll to them.** The instant the feed data arrives, we
   quietly push every card's photo into an on-device cache (memory + disk). By the time you scroll
   down, the image is already there — it fades in over 200ms instead of streaming in one-by-one.

There's even more under the hood: tapping a card pre-loads the *next* screen's data on **finger-down**
(`onPressIn`, ~80–150ms before the tap completes), so by the time the deal page opens its data is
already cached — no spinner. And on app boot, we pre-warm the category list so the filter pills
never "pop in." A photo downloads **exactly once, ever**, and we even rewrite Supabase image URLs
to pull a server-resized variant (a 6MB phone photo becomes ~170KB) where it counts.

One disciplined rule worth knowing: data is pre-loaded **on intent (finger down on a card), never
on scroll**. Scrolling a long list does *not* fire dozens of background requests for screens you
might never open. We warm on a real signal, not speculatively.

### The layout: rails → "See all" → 2-up grid

- The home view shows **horizontal rails** of deals, with **4:3 cards** (shorter than the
  old portrait cards, so more shows at a glance on small phones).
- At the **end of each rail** is an inline **"See all" tile** — swipe past the last card and the
  next thing under your thumb is the "see everything" button. (The old top-right "See all →" link
  is gone; the rail heading itself is also tappable.)
- Tapping "See all" doesn't navigate anywhere — it switches the *same screen* into a filtered
  view: a **2-up vertical grid** (~6 listings per screen on a small phone instead of ~1.5), driven
  by a separate query that loads up to 50 deals.

### Recently viewed

Right at the top of Discover, a small strip quietly remembers the last handful of deals you opened — tap one to jump back in. It's stored **on your phone** (not our servers), so it works whether or not you're signed in, and it's nobody's business but yours. If a deal you looked at has since expired or been pulled, it just drops off the strip on its own. Empty until you've actually viewed something.

### You decide what the sections say (the editorial layer)

Those rail headings aren't the boring category name anymore. **You** write them. In the admin
console under **Discover**, you create "sections" — each one is a **cute, benefit-led tagline** that
*replaces* the category label, an optional **description you type** that shows right under it, and
you pick **what it pulls from**: whole categories (one, or several), **specific treatments**, or a
mix. So instead of a rail called "Injectables," you can have **"Find fillers & Botox to boost your
glow"**; you can pool "Injectables" and "Skin" into one **"Look snatched"** rail — or go fully
pointed: **"Rhinoplasty, without living with it forever"** targeting just the *Liquid Rhinoplasty*
treatment, with "15-minute liquid nose jobs — no surgery, no downtime" typed underneath. Add as many
as you want, drag them into the order you want, hide one with a toggle, give it its own photo. It's
saved in the database, so changing the copy is instant — **no app update, no code.**

A couple of honest details:
- The little **"Browse by category" photo tiles** at the top stay as plain category shortcuts (a fast
  way to jump *into* a category) — only the rails below become editorial.
- If you haven't written any sections yet, the feed quietly falls back to one rail per category, so it's
  **never blank** — and a multi-category or treatment-targeted section's "See all" pools all its targets
  together on the app, description included. (On the website, those pooled rails show their deals but
  skip the "View more" link for now.)

**Refreshes happen when:** your location changes, you change a category/filter, or you pull-to-refresh
(which gives a little haptic buzz and re-fetches). Otherwise, after 30 seconds of staleness, the next
time you focus the screen it quietly refreshes in the background.

*Deeper: `GLOE.md` §6, §6A "Editorial sections (GLO-27)". Code: `discover.tsx`, `deals.router.ts`, `deals.ts` (`getDiscoverFeed`), `discoverSections.ts`, admin `SectionsView.tsx`.*

### Category pills & the treatment drill-down

Once you're *inside* a category, a row of category pills appears (with an "All" pill to pop back).
Below it, a second row of **treatment** sub-pills (Botox, Filler, etc.) appears — **but only when
at least 2 treatments nearby have enough live inventory to be worth choosing between.**

This is a small, smart piece of design: at launch, most categories have only one or two deals, so a
treatment drill-down would usually dead-end on a single result — a frustrating, broken-feeling tap.
So the second row **earns its place**: thin inventory → you see one clean row of categories and never
a dead tap. And because it's just counting live nearby inventory, the richer experience **switches
itself on automatically** as vendors are added — no config change, no app release.

*Deeper: `GLOE.md` §6A "Customer drill-down". Code: `TreatmentPills.tsx`, `FilterPills.tsx`, `deals.ts` (`getCategoryTreatments`).*

---

## 3. How ranking & "trending" actually work

### Why your feed feels fresh but not chaotic

An anonymous shopper with no account still gets a feed that feels personal. Here's the trick: each
install gets a **stable random ID** (a UUID stored securely on the device). That ID, combined with
**today's date**, seeds a tiny bit of "shuffle" in the ranking.

The effect: reload the app ten times this afternoon and the order **holds steady** (not jittery and
broken-feeling). Come back tomorrow and the top picks **rotate** — the catalog feels alive. No
machine learning, no login required, and "fresh tomorrow" is free because it's just the date string
in the hash flipping at midnight. The moment you sign in, your real user ID quietly replaces the
device ID, so you get a consistent personalized order across all your devices — with zero migration code.

Underneath, each deal's rank is a blended score: a sponsored boost, plus its rating, minus a distance
penalty, plus a freshness bonus, plus that small daily shuffle. (Pick an explicit sort — distance,
price, rating — and the shuffle is bypassed for a clean deterministic order.)

*Deeper: `GLOE.md` §6A. Code: `anonSeed.ts`, `deals.ts` (blended score), `deals.router.ts`.*

### "Trending" is two different things

This surprises people, so it's worth being clear: Gloē has **two unrelated** notions of "trending."

**1. The "Trending" ribbon on a deal** is *real purchase signal.* It's computed live: "did at least
**3 different people pay for this deal in the last 7 days**?" If yes, ribbon on. It's recomputed
fresh on every load straight from the payments table — so it **can't be gamed by views**, it lights
up within *seconds* of the 3rd purchase's payment landing, and it goes dark on its own as those
purchases age out of the 7-day window. No nightly batch job. (Fully refunded purchases stop counting;
partial refunds still count.)

**You control the "3" and the "7 days" yourself, from the back end — no code, no deploy.** Both
numbers are settings (`trending_min_purchases` and `trending_window_days`) stored in the database and
edited from **admin god-mode → Settings**. Want trending to mean "10 purchases in the last 14 days"
instead? Change the two values, save, and **the very next feed request uses the new numbers** — every
deal's ribbon re-evaluates live against your new bar. Nothing is hardcoded: if the settings are ever
missing, it safely falls back to 3-in-7. (Internally the admin call clamps the values to sane ranges
so you can't set a nonsensical 0.)

> One thing to know: this ribbon currently renders on the **website only**. Mobile receives the
> data but doesn't yet draw the ribbon — a UI gap, not a data gap. (See [§16](#16-whats-not-built-yet).)

**2. "Popular near you" treatment chips** (in search) are *not* purchase-based at all. They rank
treatments by **how many live deals exist nearby** — pure inventory count. That's deliberate: with
thin early inventory, "what can I actually book here" is the most useful signal, and it improves on
its own as supply grows. The intent is to swap this to real search/purchase counts once we log them.

*Deeper: `GLOE.md` §6A. Code: `platformSettings.ts` (`getTrendingConfig`), `deals.ts` (`is_trending` subquery, `getTrendingTreatments`), `SettingsView.tsx` (admin).*

---

## 4. Search

Search is built to feel like it **knows aesthetics**. Two layers stack:

1. **A hand-curated synonym map.** We teach it the slang and brand names of the industry — type
   "tox" and it expands to Botox, Dysport, Jeuveau, Xeomin, Daxxify; "skinny shot" → semaglutide +
   tirzepatide; "fat freeze" → CoolSculpting. There are ~18 of these trigger groups. A generic
   search engine doesn't know any of this.
2. **Typo forgiveness.** On top of that, a fuzzy-matching algorithm (Postgres trigrams) handles
   misspellings — "botx" still finds Botox — on *both* what you typed and the expanded terms.

The quality gate is a **similarity floor**: a result only survives if it fuzzy-matches well enough
*or* genuinely contains the words. So a real typo gets through, but actual nonsense falls to an
**honest empty state** instead of returning garbage. And that empty state never dead-ends — it
offers "popular nearby treatments" chips to tap.

Behind the scenes, search is **the same engine as the feed** (`listDeals` with a search term added),
so distance, filters, and ranking behave identically everywhere — one place to tune, no drift.

One integrity detail: during search, the **sponsored boost is cut in half**. When someone asks for a
specific thing, the best *match* should win, not the highest bidder.

The UX is tuned to feel instant and never blank: a **180ms debounce** (it waits for you to pause
typing before hitting the server), results that **morph smoothly** instead of flickering (old results
dim while new ones load), **autocomplete chips** that only point at treatments with real nearby
inventory, and **recent searches** saved securely on-device. Tapping a result pre-loads the deal page
on finger-down, so it opens with no spinner.

*Deeper: `GLOE.md` §6A. Code: `search.tsx`, `aestheticSynonyms.ts` (`expandQuery`), `deals.ts` (search SQL), `deals.router.ts`.*

---

## 5. The map

The map is a full-screen, ResortPass-style discovery view, reached from a button on Discover.

- It **opens centered on where you're browsing** — your GPS location or your picked city.
- **One teal pin per spa** (not per deal — a spa with several deals shows one pin, and its card says
  "+N more experiences"). Pins for spas without coordinates are simply dropped (can't be plotted).
- **Pins cluster when you zoom out** and break apart as you zoom in — handled by a lightweight
  homemade grid bucketer (no heavy clustering library). The pin you're looking at darkens to ink;
  the rest stay teal.
- **Swipeable spa cards** at the bottom are two-way synced to the pins: swipe a card and its pin
  centers; tap a pin and its card scrolls into view.
- A **three-position draggable sheet** (peek / half / full) lets you browse the card list at whatever
  height you want.
- The top chrome is three rows: your location **as a tappable pill** (pin + city + chevron, sitting
  next to the back button — tap it to change where you're browsing and the map re-centers), **category
  tabs**, and **filter chips** (Filter · Vibe · Price · Rating · Sort). Every filter maps 1:1 onto the
  same `deals.list` inputs the feed uses — so applying a filter is just a parameter change, no special
  map backend.
- **"Search this area"** re-queries deals for wherever you've panned the map to.

It's **iOS-first** by design (uses Apple Maps); Android is a deliberate fast-follow. And because it
reuses the existing deals endpoint, building the map required **zero backend changes**.

*Deeper: `GLOE.md` §6A "Map discovery". Code: `map.tsx`, `MapBrowseSheet.tsx`, `clustering.ts`, `spaGrouping.ts`, `deals.ts`.*

### Vibes & amenities

A spa's "vibe" (clinical, luxe, trendy…) is vendor-self-selected, and consumers can filter the map
by it ("show me only luxe spas"). It's a flexible tag system — the same pattern powers amenities —
and it filters with a "match any selected vibe" rule.

*Deeper: `GLOE.md` "Vibes feature". Code: `deals.ts` (`vibes` filter), `MapFilterSheet.tsx`.*

---

## 6. Looking at a deal & a spa

### The deal page

Everything the deal page needs arrives in **essentially one round-trip** — hero photos, the vendor
card, variant options, reviews availability, the redemption map, restrictions, fine print. No cascade
of spinners. And because the card pre-loaded this data on finger-down, tapping a card usually shows a
**fully-painted page with no spinner at all**.

A few deliberately-cheap touches:

- **The map is a pre-made image.** A static map of the spa is generated *once* when the location is
  set and stored in our own storage — so customers load our cached image and we **never pay Google
  per view**. There's also a "Calculate distance" button that fires a *real* Google Directions route
  (with live drive time and a drawn route line) only when the user explicitly taps for it.
- **Drive time is estimated with math, not a paid API.** Cards show a drive-time estimate computed
  from straight-line distance × a speed that rises with trip length — within ~20% of Google, at zero
  per-view cost. (Real Google timing only on the explicit "Calculate distance" tap.)
- **Reviews lead with whichever source has substance.** If the spa has fewer than 5 Gloē reviews and
  a Google listing is linked, the page auto-leads with Google — so a brand-new spa still shows social
  proof. Ratings are **count-weighted blends** of Gloē + Google, so a 4.0★ (1 Gloē review) can't bury
  a 4.9★ (200 Google reviews).

The "Buy now" button never dead-ends an anonymous user — tap it signed-out and it opens sign-in, then
**continues straight into checkout** with your selection intact.

*Deeper: `GLOE.md` §6 "Deal detail flow". Code: `deal/[id].tsx`, `deals.ts` (`getDeal`), `RedemptionMap.tsx`, `ReviewsSection.tsx`.*

### The spa storefront

A spa's public profile assembles in **one query that fans out to ~6 parallel reads**: the spa row,
its deals, its providers, its "Inside the spa" videos, its Gloē reviews, and its cached Google
reviews. On the website, this page also renders SEO metadata + structured data so spa pages are
Google-indexable.

**Google reviews are cached in our own database** and refreshed **lazily, once per 24 hours, on a
real visit** — so we pay Google once per spa per day instead of once per pageview, while still showing
current star counts. If Google is down or unlinked, the page degrades gracefully to cached/Gloē-only.

*Deeper: `GLOE.md` §7, `WEB.md`. Code: `vendorStorefront.ts`, `vendors.router.ts`, `SpaStorefrontClient.tsx`.*

### Reviews — why they're trustworthy

Gloē reviews are **welded to a paid, redeemed voucher**: you can only review your *own* claim, only
*after* it's been redeemed, and only *once* per claim (re-submitting edits it). This is enforced in
two places — the app code *and* a database trigger — so reviews **can't be astroturfed**. It's the
FTC-defensible "only real customers review" guarantee. A review is a star rating, optional words, and
up to **3 photos** (uploaded straight to storage via a signed URL).

**Getting reviews written (the prompt).** Real reviews don't appear on their own, so the wallet
*asks*. Any **redeemed** voucher you haven't reviewed yet shows an inline **"How was {spa}? ★ Leave a
review"** strip welded to the bottom of *that voucher's own card* — a brand-tinted footer band, and
the card stays bright (not faded like the rest of your "past" history) so it reads as a live call to
action. One prompt per deal, no separate list to scroll, so it scales even if you've redeemed dozens.
Note it only appears on *redeemed* vouchers — an **expired** voucher (bought but never used) gets no
prompt, because you can't review a service you never received (the DB trigger enforces this too).

Tapping the strip opens the review sheet (mobile) or modal (web): tap the stars, optionally type a few
words, add up to 3 photos. On mobile the sheet **rides above the keyboard** — the whole sheet lifts so
the text field and Submit button stay visible while you type. Once you've left a review the strip
disappears and the button on the voucher screen flips to "Edit your review." The same flow is also
reachable from the redeemed voucher screen itself.

There's **also** an optional "leave a review" *push* — but unlike the instant wallet nudge, it fires a
**configurable number of hours after the visit** (default 3h, DoorDash-style), so it lands once she's
home rather than while she's still in the chair. It's **off by default** — review prompts that nag get
ignored — and flipped on (with its delay + copy) from admin god mode (Settings → **Notifications**). The
cron skips it if she already left a review in the meantime, and sends only once per voucher. When it
does fire, tapping it deep-links straight to the voucher and auto-opens the review sheet.

*Deeper: `GLOE.md` §6 + §6D. Code: `reviews.ts`, `reviews.router.ts`, the `enforce_review_requires_redemption` DB trigger; `ReviewSheet.tsx` (mobile) / `ReviewModal.tsx` (web); the wallet nudge in `wallet.tsx` / `wallet/page.tsx`; the push registry in `notifications.ts` (`review_prompt` type).*

### Saved

Hearting a deal or spa flips **instantly** (the heart updates before the network even responds —
"optimistic" updates), with a little haptic tap on *add* only. If the save fails, it quietly rolls
back. The Saved tab has a segmented control to switch between saved deals and saved spas. Saving
while signed-out opens the sign-in sheet first (except on the map, where it silently no-ops).

*Deeper: `GLOE.md` §6. Code: `SavedDealsProvider.tsx`, `SavedVendorsProvider.tsx`, `saved.ts`.*

---

## 7. Buying, the voucher, and redeeming

### Buying — money is the source of truth

The most important rule in the whole system: **a voucher can only exist if real money was
confirmed.** Here's the exact sequence:

1. You tap **Pay**. The server creates a **held** Stripe charge — the money goes onto *Gloē's* own
   balance and is **held there** (it does *not* go to the vendor yet). It also writes a
   "pending payment" record with the fee math **frozen in** at that moment.
2. Stripe's native payment sheet collects the money (card, Apple Pay, Link, Klarna — whatever's
   enabled). We never touch card numbers.
3. When the charge succeeds, **Stripe pings our server** (a webhook), and *only then* are the QR
   vouchers minted — one per quantity — and inventory decremented.

So an unpaid or abandoned order **never produces a live voucher.** And the minting happens inside a
single atomic database transaction, guarded so that Stripe re-sending an event (which it can do)
**can never double-mint** vouchers or double-count inventory.

Why hold the money instead of paying the vendor right away? Two reasons: it lets us honor the
**3-day refund**, and it means **vendors only get paid after a voucher is actually redeemed** —
which protects against no-shows and chargebacks. (More in [§8](#8-how-the-money-moves).)

Freezing the fee math onto each transaction means you can change your fee tiers *anytime* in admin,
and it will **never retroactively change the economics of a past sale.**

> ⚠️ One thing the audit flagged: there's **no cleanup job** for abandoned "pending payment" rows
> (a canceled checkout leaves a harmless orphan record). And there's a brief window where two buyers
> could both pass the "spots left" check before either pays. Both noted in [§16](#16-whats-not-built-yet).

*Deeper: `GLOE.md` §4 "Money pipeline". Code: `checkout.ts` (`createPurchase`, `fulfillPurchase`), `stripe.ts`, `index.ts` (webhooks).*

### Share-to-pay (gift links)

You can generate a **Stripe-hosted link** that *anyone* can pay — but the voucher still lands in
**your** wallet, not the payer's. Text it to a partner or parent: they pay, you get the treatment.

Because the payer is a stranger to our account system (the biggest fraud surface), the money logic is
locked down on the backend: a **hard $500-per-link ceiling**, your per-customer limits still counted
against *you* (the recipient), and fraud/liability delegated to Stripe Radar. When it's paid, you get
a push: *"[Name] booked your gift."* The link is shareable; the resulting voucher is **not** —
"Code is unique to your account. Do not share."

*Deeper: `GLOE.md` §6B. Code: `checkout.ts` (`createGiftLink`), `gift/[sessionId]/page.tsx`.*

### The voucher (your walk-in ticket)

The voucher screen is the customer's ticket, and it renders in **one of three states**: **active**,
**redeemed**, or **expired**.

- It paints **instantly** from cache (no spinner) — QR code, an 8-character backup code receptionists
  can type, and the price you paid (frozen from purchase time).
- It overlays **fresh** vendor phone + address fetched live at view time — so if the spa changed its
  number, you see the *current* one (not the frozen snapshot).
- A countdown ticks every minute and turns **red within 24 hours** of expiry.
- "Add to Apple Wallet," Call, and Directions are right there.

**The critical safety wall: there is no "I redeemed it myself" button.** The customer screen only
*displays* the QR + code. Redemption is **vendor-only** — staff scan the QR or type the code on their
end. This is deliberate: a self-redeem path would let someone trigger a vendor payout with **nobody
actually showing up.** (An old dev-only "simulate redemption" path was removed for exactly this reason.)

### Expiry — lazy, no cron

Expiry is enforced **lazily, at read time** — every query that lists deals/vouchers checks
`expires_at > now()` rather than a nightly job flipping statuses. So an expired voucher simply *reads
as* expired the moment you look at it; there's no scheduled task that has to run. (One function does
hard-flip deals to "expired" status, but it's only reachable on demand, not on a timer.)

**How long is a voucher good for?** That's a dial you control, not code: god mode → Settings →
**Voucher validity window** (default 90 days). Every voucher sold from that moment on expires that
many days after purchase — no deploy needed. A specific deal can still set its own override in the
posting form ("Code valid (days)" — leave blank for the platform default). Already-sold vouchers
keep the expiry they were sold with; changing the dial never moves a live voucher's date.

**And if one does expire on a customer?** You can **reissue it**: open the transaction in god mode
(Transactions → the order) and hit **Reissue voucher** on the dead one. The customer instantly gets a
fresh, active voucher — new QR + code, fresh expiry from the current window — for the **same already-paid
purchase** (no new charge, no spot re-counted), and a push tells them it's in their wallet. The dead
voucher stays in place, marked as replaced, so the paper trail is intact; each voucher can only be
reissued once, even if two admins click at the same time.

*Deeper: `GLOE.md` §6 "Voucher screen" + §"Scenario 6". Code: `my-deal/[id].tsx`, `claims.ts`
(`reissueClaim`), `platformSettings.ts` (`getVoucherValidityDays`), `vendor.router.ts` (`redeemVoucher`),
`SettingsView.tsx`, `TransactionsView.tsx`.*

### Redeeming — what happens when staff scan it

The vendor scans the QR (or types the code), the system verifies it read-only, the vendor confirms,
and then a **single atomic database write** flips the voucher to "redeemed" — with four conditions
checked in that one write (right voucher, right vendor, still active, not expired). So if two staff
scan at once, **exactly one wins.** Every attempt — success, lookup-only, or refused — is logged to an
audit trail.

And **that redemption is what releases the vendor's money** (next section).

*Deeper: `GLOE.md` §4, §7. Code: `claims.ts` (`redeemClaimByVendor`, `lookupVoucher`).*

### And the customer's inbox?

The receipt email lands seconds after the purchase, and a reminder goes out if a voucher is about to
expire unused. Every automated email — what triggers it, who gets it, exactly when it sends — lives in
one table in [§13](#13-emails--notifications), so this section stays about the voucher itself.

---

## 8. How the money moves

This is the heart of the business, so here's the whole pipeline in plain terms. Money moves in
**stages**, and the key principle is: **the spa gets paid only when the treatment actually happens.**

### Stage 1 — The charge (at purchase)

When a customer pays, the full amount lands on **Gloē's own Stripe balance and is held** — there's
no transfer to the vendor at this point. This is the "separate charges and transfers" model, and it's
what lets us refund freely and only pay vendors on redemption.

### The platform fee — a lever, not hardcoded

Your fee schedule lives in the **database**, not in code. Tiers are admin-editable (the live config:
20% on sales ≤ $500, a flat $60 above). You can raise a tier, or give one specific spa a discounted
override, as a **data edit — no deploy**. The system picks the matching tier, prefers a vendor-specific
override over the global one, and if the fee table is ever empty or misconfigured, it falls back to a
sensible 12% rather than giving the product away.

And the magic detail: the fee that applied is **frozen onto each transaction as a snapshot.** Change
tomorrow's tiers all you want — it can **never retroactively change yesterday's sales.**

> The way Gloē keeps its cut is elegant: at redemption, we simply **transfer less** to the vendor than
> we charged the customer. Stripe never sees the fee as a separate line — it's just the gap between
> what came in and what went out.

*Deeper: `GLOE.md` §4 Stage 1, §2. Code: `fees.ts` (`computeFee`), `platform_fees` table, `FeesView.tsx` (admin).*

### Stage 2 — The transfer (at redemption)

When the vendor redeems a voucher, we move **the vendor's share** from our held balance to their
connected Stripe account — but only after a chain of **safety walls** all pass:

1. The voucher is genuinely redeemed, and
2. its transaction is paid, and
3. it hasn't already been transferred (idempotency — can't double-pay), and
4. the vendor has a *real, active* Stripe account (we even regex-check the account ID to reject
   placeholder/test values before Stripe would error), and
5. the payout amount is positive and finite.

Crucially, **the destination account is always looked up server-side from the voucher** — never passed
in by the caller. So a malicious request can't redirect another vendor's money.

There are **two release modes**, per vendor: **auto-release** (trusted vendors get paid the instant they
redeem) or **hold** (funds stay on the platform until an admin pushes them manually). It's a single
toggle in god-mode. And if a transfer *fails*, **the redemption still sticks** — the customer was
already served, so an ops/Stripe hiccup never punishes them; the error is surfaced for an operator to
resolve. Every attempt, pass or fail, is written to an **append-only audit log** for forensic
reconciliation.

*Deeper: `GLOE.md` §4 Stage 2. Code: `payouts.ts` (`releaseTransferForClaim`, walls), `claims.ts` (`redeemClaimByVendor`).*

### Stage 3 — Payouts to the vendor's bank

Two paths:

- **Standard payouts** (free): **Stripe owns the schedule** (default daily). We never run a payout
  cron — we just *listen* to Stripe's payout webhooks and mirror each one into our own table, which
  drives the admin Payouts console and a vendor "failed payout" banner with plain-English error
  explanations. (Stripe is the source of truth; our table is a read-cache for our UI.)
- **Instant payout** (3% fee): a vendor taps "Pay me now" to get cash to their debit card in ~30
  minutes instead of waiting 1–2 business days. Eligibility and balance are **re-verified live against
  Stripe at the moment of the tap** (never trusting the cached UI), the destination is re-derived
  server-side, and every refusal is logged. Gloē nets ~2% after Stripe's cut.

*Deeper: `GLOE.md` §4 Stage 3 / 3'. Code: `payouts.ts`, `index.ts` (`payout.*` webhooks), `VendorDashboard.tsx`.*

### Refunds

Two financially-opposite cases, handled differently:

- **Before redemption:** the vendor was never paid, so it's a clean card reversal — refund the
  customer, kill the voucher. Simple.
- **After redemption:** the service *was* delivered and the vendor was likely already paid, so refunding
  the customer also has to **claw back the vendor's transfer** (which can drive their balance negative).
  This is a deliberate, **owner-only, two-step** action — the UI screams about it with a red danger
  button and a warning banner.

Gloē **always keeps its platform fee** on a refund (so we never pay Stripe's ~3% to issue one). The
refund "ledger" is built on the audit log, so it captures not just every dollar that *moved* but every
dollar someone *tried* to move and was **blocked** — with actor, reason, and Stripe ID.

*Deeper: `GLOE.md` §4 Refunds. Code: `vendorOps.ts` (`refundClaim`, `refundTransaction`, `forceRefundRedeemed`).*

### Disputes / chargebacks

When a customer files a bank dispute, Stripe sends a `charge.dispute.created` webhook and Gloē reacts
**automatically** — no admin action required to stop the bleeding:

- **Freeze the voucher.** Every still-unredeemed voucher on that order flips to a new `frozen` status.
  A frozen voucher can't be redeemed (the vendor's scanner says *"on hold pending a payment review"*), so
  a disputer can't also walk away with the service.
- **Halt the payout.** The transaction flips to `disputed`, which trips the payout wall — no vendor
  transfer can fire while a dispute is open.
- **Flag the awkward case.** If the voucher was *already redeemed* (service delivered, vendor maybe already
  paid), we can't un-deliver it — so the transaction is flagged for admin review in god mode instead.

Then the dispute resolves:

- **We win** (`charge.dispute.closed`, status `won`) → the freeze is undone: vouchers go back to `active`
  and the transaction back to `paid`, so it works again and can pay out.
- **We lose** → Stripe has already pulled the funds back from the platform. The freeze stands. If the
  vendor was already paid on this order, an owner uses the **"Claw back vendor share"** button in the
  transaction drawer (`reconcileLostDispute`) to reverse their transfer so the loss doesn't sit on Gloē.
  We do *not* issue a second customer refund here — the chargeback already returned their money.

The hard part (proportional transfer reversal) was reused from the refund work; the new pieces are the
webhook listener, the freeze, the `disputed` payout wall, and the reconcile action. Every step writes an
audit row (`dispute.opened` / `dispute.won` / `dispute.lost` / `dispute.reconciled`).

Repeat offenders surface themselves: vendors over your admin-set dispute threshold get a red ⚠ on the
god-mode Vendors list, and a **"⚠ Flagged" filter chip** shows only those vendors — your one-tap
watch-list (GLO-36).

> Ops note: this only works if `charge.dispute.created`, `.updated`, and `.closed` are enabled on the
> Stripe webhook endpoint. Confirm them in the Stripe dashboard before launch.

*Deeper: `GLOE.md` §4 Disputes. Code: `payoutWebhooks.ts` (`handleStripeDisputeWebhook`), `vendorOps.ts`
(`reconcileLostDispute`). Linear: GLO-34.*

### A subtle accounting note worth knowing

Because expiry is lazy and **nothing ever flips an unredeemed voucher to a terminal state**, a voucher
that's paid for but **never redeemed** keeps its payout sitting in the "owed to vendor" bucket
*indefinitely* — even long past its expiry date. There's no process today that sweeps elapsed-unredeemed
vouchers, releases that held money, or recognizes the breakage. Flagged in [§16](#16-whats-not-built-yet).

### Discounts & wallet credit at checkout

Promos ("Extra $X off" on a deal) and wallet credits both ride this same pipeline — the promo
shrinks the price, credits shrink the cash charge, and the funding rules decide whose pocket it
comes from. They get their own full chapter: [§9](#9-credits-promos--referrals-the-incentives-engine).

---

## 9. Credits, promos & referrals (the incentives engine)

This is the growth machinery: every dollar of "free money" a customer ever sees — wallet credit,
a referral reward, an "Extra $15 off" badge — runs through one system with one governing rule:
**incentives are platform-funded unless a vendor explicitly opts in to fund their own.** The vendor's
payout is sacred; Gloē's marketing comes out of Gloē's margin, never theirs.

### The two levers, side by side

| | **Wallet credits** (GLO-24) | **Deal promos** (GLO-44) |
| -- | -- | -- |
| What it is | Personal money that follows the *customer* | A public discount sitting on a *deal* |
| Who sees it | Just that customer, in their wallet | Everyone browsing — badge on the card |
| How it applies | Auto-applies at checkout (toggle to skip) | Applies itself; nothing to enter |
| Funded by | Gloē, always | Gloē (god mode) **or** the vendor ("Boost") |
| Liability tail | Yes — tracked, expiring, audited | None — instant discount, no balance |

Order of operations at checkout, always: **promo cuts the price first, credits cover the remainder,
the card covers the rest.** Receipts show all four lines (original / promo / credits / charged) —
that's also our dispute evidence.

### Wallet credits — how a customer earns

- **Referrals** *(ON at launch)* — give $20, get $20. Details below.
- **Purchase rewards** *(built, switched OFF)* — tier ladder seeded ($100–250 → $10, $250–500 → $20,
  $500+ → $25), earned on the cash portion only, flip a row in god mode to turn on.
- **Signup bonus** *(built, switched OFF)* — $10 campaign knob, ships dark.
- **Credit campaigns** — god-mode blasts ("$10 to everyone lapsed 60 days") with an audience picker,
  a cost preview before sending, and a push+email per grant.
- **Refund returns** — the credit share of any refund comes back as credit (cash goes back to the card).
- **Admin grants** — goodwill, one customer at a time, from the customer's ledger screen.

### How spending works

Credits auto-apply at checkout with a visible "−$X credits" line and a toggle to save them. The server
recomputes the amount inside the purchase transaction — the client only ever sends the on/off toggle,
so a tampered app can't invent balance. Credits can cover up to **100%** of an order: a fully-covered
order skips Stripe entirely and still mints vouchers + receipt through the same fulfillment core. One
Stripe quirk handled for you: a card can't be charged less than 50¢, so if credits would leave a 1–49¢
sliver, we shave the applied credit to leave exactly 50¢ instead.

### The ledger underneath (why the balance is always right)

Every grant is a **lot** — an amount, a remaining balance, and its own expiry date. Every spend is an
append-only **entry** pointing at the lot it drew from; spending consumes lots
soonest-expiry-first. Nothing is ever edited or deleted: the wallet balance is just the sum of what's
remaining across lots, and the full history is replayable for any dispute, audit, or "where did my $20
go" support ticket. Clawbacks can push a lot negative — the customer sees $0, and the negative quietly
nets against whatever they earn next.

Expiry is per-rule (default 90 days). A daily sweep zeroes overdue remainders, and the customer gets a
push + email nudge **7 days and 1 day** before money dies — both through the notification registry, so
you can tune or kill the nudges like any other notification type.

### Referrals — give $20, get $20

Every user has a speakable personal code (e.g. `RYAN20`) and a share link. When a friend signs up with
it, the friend's $20 lands immediately but stays **locked until their first booking of $50+** — it
applies automatically at that checkout. The moment that first booking fulfills, the referrer's $20
lands too, with a push. Both amounts, the $50 floor, expiry, and the monthly caps are god-mode fields
on the referral rule — change the program without a deploy.

### Deal promos — the "Extra $X off" badge (GLO-44)

Some deals carry a public **promo**: a badge on the card ("Extra $15 off", or a custom label like
"Summer glow special") and an automatic discount line at checkout. Nobody types a code — if the badge
is on the deal, everyone gets it. Promo cuts the price first; wallet credits then apply to what's left.
The card and deal page show the **post-promo price** with the true original struck through, so the
number on the card is exactly what checkout charges.

Who pays for it is the whole story:

- **Gloē-funded** (placed in god mode → Promos): the customer pays less, but the **vendor is still paid
  in full on the original price** — the discount comes out of Gloē's fee. Vendors never fund Gloē's
  marketing; same rule as credits.
- **Vendor-funded** (the vendor taps **Boost** on their own live deal): the vendor chose to sell cheaper,
  so the sale is booked at the discounted price — their payout becomes discounted price − fee(discounted
  price). The dashboard shows the trade plainly per option ("you'll receive $X instead of $Y") before
  they confirm, and they can end the boost anytime.

One promo per deal, time-boxed, can't take any option below Stripe's 50¢ floor or past a 90% total
discount (so "extra off" can't make the original price look fake). Pause or suspend the deal and the
promo goes off-air with it. Refunds give back what was **paid** (cash + credits — the discount was never
paid, so it never comes back). Receipts show original / promo / credits / charged. God mode lists every
running promo with its cost-to-date (orders × discount).

*Deeper: `GLOE.md` §4 Deal promos + §9. Code: `promos.ts`, `checkout.ts` (`pricePromoOrder`). Linear: GLO-44.*


### How we're safe (the abuse inventory)

Money-printing features attract fraud, so every door is guarded:

1. **One door for granting.** Nothing mints credit except `grantCredit()`, and it's idempotent —
   unique walls on (kind + transaction), (kind + referral), (campaign + user) mean a retried webhook
   or a double-click returns "duplicate" instead of double money.
2. **No double-spend.** Redemption locks the user's lots (`SELECT … FOR UPDATE`) and pending checkouts
   reserve their credit, so two simultaneous purchases can't spend the same $20.
3. **Refunds can't leak.** Split-tender math returns cash to the card and credit to the wallet — and
   DB CHECK constraints make over-refunding (including refunding a promo discount the customer never
   paid) impossible at the database level, not just the code level.
4. **Earned money unwinds.** Refund or lose a dispute and whatever that purchase *earned* (purchase
   reward, both sides of a referral) is clawed back from its specific lot — negative balances allowed.
5. **Dispute freeze.** A chargeback freezes the customer's ledger until the dispute resolves; frozen
   wallets can't spend.
6. **Referral fraud is boxed in:** no self-referral; a **card-fingerprint match** between referrer and
   referee voids the payout (same physical card on both sides = self-funding); deleted accounts leave a
   **salted email hash** behind so delete-and-resignup never reads as a "new user"; monthly caps bound
   referral + signup earnings; the $50 first-booking floor makes farming uneconomical.
7. **Promos can't lie or stack:** one live promo per deal (database-enforced), capped so the final
   price never crosses Stripe's 50¢ floor or a 90% total discount vs the original price (FTC
   reference-price hygiene), and badge copy is auto-generated from the amount so it can't go stale.
8. **Everything is audited.** Every grant, redemption, clawback, freeze, campaign send, promo create/end
   writes an audit row. The ledger itself is append-only — there is no "edit history" because there are
   no edits.

### Why it scales

- **Every knob is a database row** — credit rules, campaign audiences, promo amounts, fee tiers. Changing
  the referral amount or launching a purchase-reward ladder is a god-mode edit, not a deploy.
- **No per-user machinery.** One daily sweep handles all expiry; the 60-second notification queue handles
  all nudges; balance is a SUM, not a maintained counter that can drift.
- **The economics are visible.** God mode shows the credit cost on every transaction (price → vendor
  payout → fee → credit cost → platform net), a program dashboard (issued / redeemed / clawed back /
  expired / forfeited / **outstanding liability**), and promo cost-to-date per promo — so you always
  know what the machine is spending before the bank statement tells you.
- **Platform Stripe balance vs. exposure:** credit-covered orders are funded from Gloē's own Stripe
  balance at payout time, so god mode surfaces balance-vs-liability — the number to watch as the
  program grows.

### Where you drive it

**God mode → Credits**: rules editor, campaigns (compose, preview audience + cost, send), any
customer's ledger with manual grant/revoke, the program dashboard. **God mode → Promos**: place a
platform-funded promo on any live deal, watch cost-to-date, end anything early. **Vendor dashboard →
Boost**: vendors run their own promos on their own deals. **Customer side**: wallet balance + history,
the "Give $20, get $20" referral row, the credit toggle + promo line at checkout, and receipts that
show every discount line.

*Deeper: `GLOE.md` §9 (spec) and §4 (promo payout math). Code: `credits.ts`, `referrals.ts`,
`promos.ts`, `creditAdmin.ts`. Linear: GLO-24, GLO-44.*

---

## 10. The vendor side

### Signing up & connecting a bank

A spa can sign up in **under a minute** — the form asks only for the essentials (name, phone,
address with Places autocomplete, categories) and creates the vendor in a **`pending_approval`**
state. That's enough to put a pin on the map.

Signup also requires ticking **"I agree to the Gloē Vendor Agreement"** (`/legal/vendor-terms`) —
the contract that makes the chargeback claw-back defensible: Gloē is a marketplace facilitator,
the vendor is the merchant of record, and **dispute liability sits with the vendor**. The
acceptance is enforced server-side (not just a disabled button) and stamped on the vendor row
(`terms_accepted_at` + the agreement version), so we can always prove who agreed to what.
Founder-pre-created listings haven't accepted yet — their stamp is a TODO for the claim flow.

Connecting Stripe happens **later and lazily** — on the first "Connect bank" tap from the dashboard,
not at signup. (Why: we never create dead Stripe accounts for tire-kickers.) That opens a Stripe-hosted
onboarding flow, and when Stripe says the account can receive money, a webhook **mirrors that status
back** into our records.

Three things must all be true before a vendor can post live deals: **admin-approved + license
verified + Stripe active** (or an explicit admin bypass). This collapses to **one server-computed
boolean**, so the UI and the API can't disagree. And the money wall independently re-checks "Stripe
active" at transfer time — so even if a UI gate were somehow bypassed, **a half-onboarded vendor
physically cannot receive funds.**

### When Gloē sets the spa up first (claim & invite)

Plenty of spas get onboarded by the founder before they've ever logged in — the listing exists,
deals may even be selling, but nobody owns it yet. The handover is one email: the admin hits
**"Invite owner"**, and the owner's invite link opens a create-password page that **names their
email and says it's already verified** (clicking the invite link *is* the verification — no code
to type, and no social-login buttons that could create the account under a different address).
Password set, they land at `/vendor`, where the system **matches their verified email to the
unclaimed listing and links it to them** — straight into their own dashboard, never a signup
form, and they can't accidentally create a duplicate spa. The match only trusts **verified** emails (an unverified address can never hijack a business),
the link is atomic (two racing sessions can't both claim it), and every claim writes an audit row.

### Getting verified ("vetted & licensed", for real)

We tell customers every spa is licensed & reviewed — so there's a real process behind it. In
Settings the vendor submits the license their practice operates under: **number, state, type, and a
photo/PDF of the license itself**. The document lands in a **private** storage bucket (it's PII — no
public URLs exist; an admin views it through a link that expires in minutes). The submission sits in
a review queue until a human checks it against the issuing state board and **approves or rejects it
with a reason** — the vendor sees the reason word-for-word and can fix and resubmit. Approval is
also the moment a brand-new vendor goes from "in review" to **live**: verifying the license IS
approving the spa. Spas that were already live before this shipped keep selling and are flagged
"unverified" in god-mode for follow-up — getting verified never knocks anyone offline, and
rejecting a license doesn't either (suspension stays a separate, deliberate act).

*Deeper: `GLOE.md` §7. Code: `vendor.router.ts`, `domain/vendorLicense.ts`, Stripe `account.updated` webhook, `vendorHub.ts`.*

### Posting a deal

One form builds the whole listing — categories, title, priced variants, photos/videos, vibes &
amenities, redemption location, fine print — and submits it either as a **private draft** or as
**pending review**. As the spa types a price, the form shows **"You earn $X (Gloē fee $Y)"** live,
computed by the same fee engine that snapshots the fee at sale time — so the number a vendor sees
while pricing is exactly the deal they signed up for (and what the Vendor Agreement promises).

- **Draft** lets a spa build a listing *before* they're fully onboarded (drafts bypass the
  license/Stripe gate).
- **Pending review** goes into an **admin approval queue** — nothing reaches customers without a human
  approving it. That's the trust/quality firewall for a medical-aesthetics marketplace.
- **Editing a live deal silently bounces it back to review** (and clears its approval) — so a vendor
  can't get approved and then quietly swap in different content.

Media is compressed on-device and uploaded directly to storage; the static map for the deal is
generated once and cached (zero per-view Google cost).

### Auto-tagging (the magic that keeps search clean)

As the vendor types a title, the form **classifies the treatment for them** (debounced ~350ms). Brand
names auto-fill with a checkmark ("Botox" → ✓ Botox, zero friction); generic words only *suggest*
("lip filler" → "Looks like Dermal Filler?") and wait for a tap. It's **scoped to the chosen category**,
so genuinely ambiguous names (Laser Hair Removal exists under two categories) resolve correctly. It's
always a head-start, **never a lock-in** — it never overrides a human's pick.

Why it matters: search can only say "this deal is Botox" if the deal carries the treatment tag — but a
front-desk worker won't hunt through a hundred treatments. So the form does it from the title they already typed.

*Deeper: `GLOE.md` §6A, §7. Code: `PostDealForm`, `dealCreate.ts`, `aestheticSynonyms.ts` (`detectTreatment`).*

### Scanning & redeeming

The vendor scans a voucher's QR (or types the code), the system verifies it **read-only**, the vendor
confirms, and a **single atomic write** flips it to redeemed (the same race-safe, exactly-one-winner
mechanism from §7). The camera deliberately stops after the first read so a steady QR can't fire ten
lookups a second.

If auto-release is on, **the vendor's payout fires immediately** on that redemption. The money path is
decoupled from the redemption path on purpose: once the customer is served, the voucher is burned even
if Stripe hiccups — the operator sees a clear "money held" message rather than an unredeemed-but-paid
limbo. And the whole Scan tab is **blocked until Stripe is active**, so a vendor can never redeem
vouchers they could never get paid for.

*Deeper: `GLOE.md` §7. Code: `vendor.router.ts` (`redeemVoucher`), `claims.ts`, `payouts.ts`.*

### The dashboard

The vendor Hub shows a **"Today" card** (sold / redeemed / active), a **"Money" card** (live Stripe
balance + amount queued-for-transfer + 7-day-paid + a failed-payout banner), and a **storefront editor**.

A deliberate design split: the "Today" and "queued/paid" numbers come from **one fast database query**
(always available, instant), while the genuinely-live "in your Stripe account" balance comes from a
**separate Stripe call** that can be slow or down **without ever blocking the rest of the page** — it
just shows "…". The "held / queued for transfer" figure is the trust anchor: money the vendor earned on
redemption that hasn't moved to their bank yet.

*Deeper: `GLOE.md` §7. Code: `vendorHub.ts` (`hubSnapshot`, `stripeMoney`), `VendorDashboard.tsx`.*

---

## 11. Behind the glass (admin god-mode)

`/admin` is the founder's single-screen cockpit for running the whole marketplace — gated by an
admin-users table with two roles (**owner** and **moderator**).

- **Pulse** answers "where do I stand / what needs a click today" on a ~10-second heartbeat.
- Every tab is backed by an admin-only query, and **every money-moving or admin action writes an
  append-only audit log row** — a permanent receipt of who did what.
- It's the **only** place refunds, payout retries, deal approvals, fee tiers, and vendor kill-switches
  are operated.

The two roles matter: **owner** can move/claw-back money and manage the team; **moderator** does
day-to-day review and support but **can't** drain a vendor's balance or lock the founder out (there are
owner-only force-refunds and "last owner" guards). Combined with the server-derived Stripe destinations
and the 8 transfer walls from §8, god-mode convenience **never becomes a way to send money to the wrong
account.**

### The treatment menu is yours to edit (Admin → Treatments)

The master menu of the marketplace — 8 categories and the ~128 treatments under them (every tox
brand, every filler line, Kybella, dermaplaning, Fraxel, Emsculpt, TRT, lash extensions…) — lives in
the database, and the **Treatments tab is its editor**. Add a treatment (type a name, optionally a
unit like "syringe" or "session"), rename one, drag its order, or hide it — and within a minute it's
live **everywhere at once**: the vendor signup chips, the deal form's treatment picker, the Discover
drill-down pills, and search. No code release, no SQL.

Two details worth knowing:

- **"Remove" is a hide, not a delete.** Deals already tagged with a treatment keep their tag and stay
  live; the treatment just disappears from every picker and from search suggestions. Permanent delete
  only appears for treatments no deal has ever used. (Semaglutide/tirzepatide are currently parked
  this way under Weight Loss — one click restores them.)
- **A new treatment is instantly searchable** by its name (search matches treatment names directly,
  typo-tolerant). The hand-curated slang layer ("fat freeze" → CoolSculpting, "tox" → every
  neuromodulator) is separate and still code-side — so name new treatments the way customers say them.

Category chips themselves can be renamed, reordered, or hidden here too. Every edit writes an audit row.

*Deeper: `GLOE.md` §"Service taxonomy". Code: `TaxonomyView.tsx`, `domain/taxonomy.ts`, `admin.listTaxonomy` + CRUD.*

### The license review queue

The Vendors tab carries a **"License review" filter chip** — every spa whose license submission is
waiting on a decision, oldest first. The vendor's detail page shows what they submitted (number,
state, type) plus a **view-the-document link** that's generated fresh and expires in minutes,
because license docs live in a private bucket, never on public URLs. Two buttons: **Approve** (for a
brand-new spa this is also the "take them live" moment) and **Reject…** with a required reason the
vendor reads verbatim on their dashboard before resubmitting. Both decisions write audit rows.

### The support drawer

The Support tab is a **triage queue** (needs-reply-first) with a wide drawer that wraps each chat thread
in three context layers: a **customer "boss-view"** header with auto-flags (whale vs refund-farmer vs
first-timer), a **collapsible order-history panel** with **inline per-order refunds**, and the message
thread itself. The agent can resolve the most common case — a refund — **without leaving the page**, and
their **text reply is the single place a consumer push fires.**

*Deeper: `GLOE.md` §8, `WEB.md`. Code: `admin.router.ts`, `admin.ts`, `SupportView.tsx`, `audit_log` table.*

---

## 12. Accounts & login

### Why web and mobile login look different

**Clerk powers all auth on both platforms** — but the *UI* diverges, and it's forced, not stylistic:
Clerk gives us a polished pre-built sign-in box **for web only.** It has no native version for a phone app.

- **Web** mounts Clerk's prebuilt components (a centered, brand-styled modal).
- **Mobile** is a **hand-built bottom sheet** — email/password, 6-digit email-code verification, social
  sign-in, and Face ID — driven by thin wrappers over Clerk's headless mobile SDK. Same brand styling,
  built ourselves because Clerk doesn't provide a native screen.

The big conversion play: **anonymous browse is always allowed.** A shopper explores the entire
marketplace and only hits sign-in the *instant* they try to redeem, save, review, or turn on
notifications. And because the gated action is **stashed and auto-resumed**, a signed-out "Buy now"
flows straight into checkout after sign-in — no dead-end.

The whole auth layer sits behind a provider-agnostic seam, so Clerk could be swapped with one file
changing.

*Deeper: `GLOE.md` §6E, `clerk-native-no-prebuilt-ui` + `auth-ui-architecture-decision` memos. Code: web `sign-in/page.tsx`, mobile `AuthGateSheet.tsx`, `useRequireAuth.ts`.*

### Signing up

Signup is **100% Clerk-driven** — the 6-digit verification code email is sent by *Clerk*, not us. Your
Gloē account row is created **just-in-time** the first time you hit our API with a valid token (not via
a webhook). That's deliberately simple and self-healing: there's no webhook to miss, and your local row
can never get orphaned from Clerk because it's only ever born from a verified token. That first-ever
insert is also what fires the one-time **welcome email** — since the row is born exactly once, the
welcome can't re-send on later logins.

> Email is now partly wired (§15): **receipts, refund confirmations, voucher-expiring reminders, and
> the welcome email go out** (Resend) — branded, plus vendor payout notices and support-reply
> emails (GLO-40). The gift-confirmation email is still pending.

### Deleting your account

Apple requires in-app account deletion, but we legally **can't vaporize a user** — every dollar that
moved is wired to your record so tax/chargeback/payout history can't be orphaned. So deletion is
**anonymize-and-deactivate**: we kill the Clerk login, **scrub every personal field to null**, tombstone
the Clerk ID so the account can never be revived or re-linked, and stamp a deletion date — while the
faceless financial skeleton survives. We delete the Clerk identity *first*, then scrub: if the
identity-kill fails, nothing in the database is touched (no half-deleted account you could still log
into). It's a muted text link behind two confirmations — a rare, irreversible "leave" action.

*Deeper: `GLOE.md` §6 "Account deletion". Code: `account.ts` (`deleteAccount`).*

---

## 13. Emails & notifications

Everything Gloē sends automatically — no human pressing "send" — in one place: the emails first, then
the phone pushes.

### Every email, and exactly when it sends

All branded, all via Resend, all with a footer where replying reaches a real person. A failed email
never blocks anything — a purchase or refund always goes through even if the note about it doesn't.

| The email | Who gets it | When it sends |
|---|---|---|
| **Receipt** | The customer | Seconds after their purchase goes through — what they paid, their code(s), how to pull up the QR |
| **Refund confirmation** | The customer | The moment a refund is issued, full or partial — the amount, and "back to your card in 5–10 business days" |
| **Voucher expiring soon** | The customer | Once, about 7 days before their unredeemed voucher lapses — so they never lose money they already paid |
| **Welcome** | The customer | Once, the moment their account is created — never again on later logins |
| **You got paid** | The spa | The instant a redemption moves their share to their Stripe balance — amount, deal, "View in Stripe" button |
| **Support reply** | The customer | When a Gloē agent answers their ticket — the full reply text is right there in the email |

Three fine-print notes: emails go to the customer's account email (for a gift link, the payer's address
is the fallback); each send is keyed so retries can't double-send; and the password/verification emails come
from Clerk separately, branded in the Clerk dashboard.

> Still missing: a gift-confirmation email. (See [§16](#16-whats-not-built-yet).)

*Deeper: `GLOE.md` §4 "Transactional email". Code: `domain/email.ts` (`sendEmail`), `emails/` (React Email templates), `transactionalEmails.ts`, `checkout.ts` (receipt), `vendorOps.ts` (refund), `payouts.ts` (payout notice), `admin.ts` (support reply), `index.ts` (expiry sweep), `context/auth.ts` (welcome).*

### Push notifications

Gloē talks **straight to Apple's push gateway** (APNs) — no Expo middleman — signing its own
credentials. Devices register their push token on every signed-in launch, and the permission ask is
**lazy** (only *after* sign-in, so a scary system prompt never wrecks the first-launch experience).

**Every push runs through one registry.** Instead of notification logic scattered across the codebase,
there's a single table where each push type is a row — on/off, how long after the event it fires, and the
copy itself. One admin screen (god-mode → Settings → **Notifications**) controls all of them, and adding a
new type later makes it show up there automatically. The three live types today:

1. **Support reply** — a support agent answers your ticket (deep-links to the thread on tap). *Immediate.*
2. **Gift booked** — your gift link gets redeemed, so the gifter knows. *Immediate.*
3. **Review prompt** — asks for a review a **configurable few hours after** a visit (default 3h, off by
   default). It's the one *delayed* push: it rides a queue that an in-process cron drains once due, and it
   politely **skips itself if you already reviewed** in the meantime.

The delayed ones don't send inline — they're enqueued with a "send after" time and a dedup key (so the
same visit never double-prompts), and the cron re-checks the rules right before sending. Beyond these three
the channel is still quiet — no "voucher expires soon," no "new deal near you" — a big untapped retention
lever, but now with the controls in place to turn them on safely. (Tracked: GLO-20 push campaigns.)

> ⚠️ **One caveat:** none of this *delivers* until the APNs signing key (`.p8`) and its env vars are live.
> The registry, queue, cron, and admin panel are all built and correct — they just need push itself
> switched on. Until then the toggles set intent; the pushes don't leave the building.

*Deeper: `GLOE.md` §6D. Code: `notifications.ts` (registry + queue + cron), `apns.ts`, `usePushRegistration.ts`; admin panel in `SettingsView.tsx`. Linear: GLO-20.*

---

## 14. Support / Concierge

A 1:1 customer↔Gloē help-ticket system that **reads like Messages.** Your sent message appears
instantly (dimmed until confirmed), the unread dot clears the moment you focus the thread, and a
**permission-aware strip** tells you the truth — *"you can close the app, we'll ping you"* (if
notifications are on) vs *"turn on notifications"* (if off) — instead of nagging.

A **5-state machine** tracks the one thing both sides care about: **whose turn is it.** A customer reply
always pulls the ball back to "we're on it" and even **reopens a resolved or closed case.** Messages can
carry **camera or library photos/videos**, uploaded to a private signed storage bucket.

Security is **structural, not bolted on**: every customer read/write filters by your user ID *inside the
SQL itself*, so a stolen or guessed ticket ID can't read someone else's thread, clear their badges, or
attach to a stranger's order. The single place a push fires is when an agent replies.

*Deeper: `GLOE.md` §6, §8. Code: `supportTickets.ts`, `support.router.ts`, `support/cases.tsx`, `SupportView.tsx`.*

---

## 15. The website (gloe.app)

The shopper site is a real **premium website**, not a stretched app. It's server-rendered for SEO —
every deal, spa, and treatment page ships **metadata + structured data** so Google can index them with
price and star snippets — while the interactive bits hydrate as client islands. It pulls from the
**same shared API** as the mobile app.

The single biggest UX bet is **embedded Stripe Checkout**: buyers pay **inside a modal on gloe.app** and
**never bounce to a hosted Stripe page** — which preserves trust and conversion. And just like mobile,
the **voucher is only minted by the webhook** (never optimistically), so an abandoned or failed payment
can never leave a live voucher behind. Share-to-pay (the $500-capped gift flow) runs on the same
machinery.

*Deeper: `GLOE.md` §6, `WEB.md`. Code: `apps/web` `(consumer)` route group, `EmbeddedCheckoutModal.tsx`.*

---

## 16. What's NOT built yet

An honest inventory of gaps the audit surfaced — things a user might reasonably expect that aren't
built. Each is either tracked in Linear or worth a ticket.

### Recently graduated off this list ✅
Gaps this doc surfaced that have since shipped (kept for the record, details in their sections):
- **Transactional email** — Resend foundation + receipt (GLO-37/GLO-11), refund confirmation (GLO-38),
  voucher-expiring reminder (GLO-39), and the welcome email (GLO-28). See §12 "Emails & notifications."
  *(Resend is in testing mode until launch — delivers only to verified addresses for now.)*
- **Stripe dispute/chargeback handling** (GLO-34) — `charge.dispute.*` freezes unredeemed vouchers, halts
  the payout, flags already-redeemed orders, reconciles a lost dispute. See §8.
- **Post-redemption review prompt** (GLO-8) — verified-booking Gloē reviews now collect. See §6.

### Emails
- **Gift-confirmation email.** → **GLO-17**. (Vendor payout-notification + support-reply emails shipped — GLO-40.)
- **The waitlist promises a notification it can't send.** The "we'll reach out when Gloē lands near you"
  copy has no delivery mechanism behind it.

### Money safety
- **No cleanup of abandoned "pending payment" rows** — canceled checkouts leave harmless orphan records.
- **A brief oversell window** — two buyers can both pass the "spots left" check before either pays
  (inventory only decrements at payment).
- **Unredeemed-voucher breakage isn't reconciled** — held money for never-redeemed vouchers sits in
  "owed to vendor" forever (§8 accounting note).

### Polish / parity
- **The "Trending" ribbon is web-only.** Mobile gets the data but doesn't draw the ribbon.
- **The map heart has no auth gate.** Signed-out users tapping save on the map get nothing (no sheet, no
  feedback) — the other four surfaces do prompt sign-in.
- **Apple Wallet passes don't live-update.** A pass added to Wallet won't flip to "Redeemed" — the whole
  APNs Pass Web Service layer is specced but unbuilt (and `pass_registrations` is documented but not
  actually created). → see `apple-wallet-push-updates-todo`.
- **Universal Links are broken.** Shared `gloe.app` links always open in the browser, never deep-link
  into the app. → **GLO-14**.
- **No vendor reply-to-reviews.** No column, endpoint, or UI exists.
- **"Notify me about new deals" on saved spas isn't wired** — the copy promises it; no push path exists.
- **Search/click/purchase analytics aren't logged** — "popular near you" is inventory-count, not real
  engagement. → relates to **GLO-23** (Sentry + PostHog).

### Config drift / doc-vs-code
- A few things `GLOE.md` describes as done are actually specced-but-unbuilt (the `pass_registrations`
  table, base64-env cert loading). Noted so the docs get reconciled.

---

## How this doc stays honest

Every time we finish a ticket that changes how the app *behaves*, the relevant section here gets updated
(or a new one added). If you ever read something here that doesn't match what the app actually does,
that's a bug worth flagging.
