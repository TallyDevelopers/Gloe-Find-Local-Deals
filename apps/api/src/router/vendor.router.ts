import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { Sql } from '../db/client';
import { createSignedUpload } from '../db/storage';
import { sanitizeAmenities } from '../domain/amenities';
import { sanitizeVibes } from '../domain/vibes';
import {
  createDeal,
  expireElapsedDeals,
  getVendorDeal,
  listVendorDeals,
  setDealStatus,
  updateDeal,
} from '../domain/dealCreate';
import { cacheStaticMap } from '../domain/dealMap';
import { writeAudit } from '../domain/audit';
import {
  lookupClaimForVendor,
  redeemClaimByVendor,
  RedemptionError,
} from '../domain/claims';
import { computeFee } from '../domain/fees';
import { getInstantPayoutStatus, InstantPayoutError, triggerInstantPayout } from '../domain/payouts';
import { createVendor, getSetupStatus, getVendorForOwner, type VendorRecord } from '../domain/vendorSignup';
import { getLicenseInfo, LicenseSubmitError, submitLicense } from '../domain/vendorLicense';
import { claimVendorByEmail } from '../domain/vendorClaim';
import { addVendorVideo, deleteVendorVideo, listVendorVideos } from '../domain/vendorMedia';
import { getVendorDashboardLink, startVendorOnboarding } from '../domain/vendorStripe';
import {
  getStripeMoneyForVendor,
  getVendorHubSnapshot,
  listVendorVouchers,
} from '../domain/vendorHub';
import { protectedProcedure, router } from './trpc';

/**
 * Caches the redemption-location static map for a deal and stores its URL.
 * Uses the deal's custom coords, else the vendor's business coords. Best-effort:
 * a map failure never blocks the save. The cached PNG is keyed by deal id, so a
 * later address change just overwrites it — no orphaned files accumulate.
 */
async function refreshDealMap(
  sql: Sql,
  dealId: string,
  vendor: VendorRecord,
  customLat: number | null | undefined,
  customLng: number | null | undefined,
) {
  const lat = customLat ?? vendor.address?.latitude ?? null;
  const lng = customLng ?? vendor.address?.longitude ?? null;
  if (lat == null || lng == null) return;
  const url = await cacheStaticMap(dealId, lat, lng);
  if (url) {
    await sql`UPDATE public.deals SET redemption_map_url = ${url} WHERE id = ${dealId}`;
  }
}

/** Loads the current user's vendor or throws — used by vendor-only mutations. */
async function requireVendor(ctx: { sql: Parameters<typeof getVendorForOwner>[0]; auth: { userId: string } }) {
  const vendor = await getVendorForOwner(ctx.sql, ctx.auth.userId);
  if (!vendor) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No business account found.' });
  }
  return vendor;
}

const variantInput = z.object({
  label: z.string().min(1).max(60),
  unitCount: z.number().int().positive().nullable().optional(),
  unitLabel: z.string().max(20).nullable().optional(),
  originalPriceCents: z.number().int().positive(),
  dealPriceCents: z.number().int().positive(),
  spotsTotal: z.number().int().positive().nullable().optional(),
});

const videoInput = z.object({
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url(),
  caption: z.string().max(140).nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
});

export const dealInput = z.object({
  // 1-2 categories per listing. First = primary, second = secondary.
  categoryIds: z
    .array(z.string().uuid())
    .min(1, 'Pick a category.')
    .max(2, 'You can select up to 2 categories per listing.')
    .refine((ids) => new Set(ids).size === ids.length, 'Categories must be distinct.'),
  /** Specific treatment under the primary category (Botox, Dysport…). Auto-detected from the title, vendor-confirmable. */
  subtypeId: z.string().uuid().nullable().optional(),
  title: z.string().min(3).max(140),
  description: z.string().min(10).max(2000),
  whatsIncluded: z.array(z.string().max(200)).max(12).default([]),
  restrictions: z.array(z.string().max(200)).max(12).default([]),
  finePrint: z.string().max(2000).nullable().optional(),
  // Redemption location. When all three are null the deal redeems at the
  // vendor's business address (resolved at read time).
  redemptionAddress: z.string().max(300).nullable().optional(),
  redemptionLat: z.number().nullable().optional(),
  redemptionLng: z.number().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  expiresAt: z.string(),
  perCustomerLimit: z.number().int().min(1).max(10).default(1),
  // Per-deal voucher validity override. Null/omitted = use the platform-wide
  // voucher_validity_days setting (admin-controlled, GLO-29).
  codeValidityDays: z.number().int().min(1).max(365).nullable().optional(),
  photoUrls: z.array(z.string().url()).max(8).default([]),
  videos: z.array(videoInput).max(6).default([]),
  variants: z.array(variantInput).min(1, 'Add at least one option'),
  asDraft: z.boolean().default(false),
});

type DealInput = z.infer<typeof dealInput>;

/** Maps the validated input to the domain layer's field set. */
export function dealFields(input: DealInput) {
  // Zod min(1) guarantees the primary is present; assert for TS under noUncheckedIndexedAccess.
  const [primaryCategoryId, secondaryCategoryId] = input.categoryIds as [string, string?];
  return {
    categoryId: primaryCategoryId,
    secondaryCategoryId: secondaryCategoryId ?? null,
    subtypeId: input.subtypeId ?? null,
    title: input.title,
    description: input.description,
    whatsIncluded: input.whatsIncluded,
    restrictions: input.restrictions,
    finePrint: input.finePrint ?? null,
    redemptionAddress: input.redemptionAddress ?? null,
    redemptionLat: input.redemptionLat ?? null,
    redemptionLng: input.redemptionLng ?? null,
    startsAt: input.startsAt ?? null,
    expiresAt: input.expiresAt,
    perCustomerLimit: input.perCustomerLimit,
    codeValidityDays: input.codeValidityDays ?? null,
    photoUrls: input.photoUrls,
    videos: input.videos,
    variants: input.variants,
  };
}

function assertVariantPricing(variants: DealInput['variants']) {
  for (const v of variants) {
    if (v.dealPriceCents >= v.originalPriceCents) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `"${v.label}": deal price must be less than the original price.`,
      });
    }
  }
}

async function assertCanPost(ctx: { sql: Parameters<typeof getSetupStatus>[0]; auth: { userId: string } }) {
  const setup = await getSetupStatus(ctx.sql, ctx.auth.userId);
  if (!setup) throw new TRPCError({ code: 'FORBIDDEN', message: 'No business account found.' });
  if (!setup.canPostDeals) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Finish your setup (approval, license, and bank) before posting.',
    });
  }
}

export const vendorRouter = router({
  me: protectedProcedure.query(({ ctx }) => getVendorForOwner(ctx.sql, ctx.auth.userId)),

  setupStatus: protectedProcedure.query(({ ctx }) => getSetupStatus(ctx.sql, ctx.auth.userId)),

  /** Start Stripe Connect onboarding — returns a hosted URL to connect their bank. */
  startStripeOnboarding: protectedProcedure
    .input(z.object({ refreshUrl: z.string().url(), returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      return startVendorOnboarding(ctx.sql, vendor.id, {
        refreshUrl: input.refreshUrl,
        returnUrl: input.returnUrl,
      });
    }),

  /** Express dashboard login link (manage payouts/bank/tax) for a connected vendor. */
  stripeDashboardLink: protectedProcedure.mutation(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    try {
      return { url: await getVendorDashboardLink(ctx.sql, vendor.id) };
    } catch (e) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
    }
  }),

  /**
   * GLO-5: link an admin-pre-created (unclaimed) vendor to the signed-in
   * user when its stored email matches one of their VERIFIED Clerk emails.
   * /vendor calls this before ever showing the signup form, so an invited
   * owner lands straight in their own dashboard instead of creating a dupe.
   */
  claimByEmail: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await claimVendorByEmail(ctx.sql, ctx.auth.userId, ctx.auth.clerkUserId);
    if (result.claimed) {
      void writeAudit(ctx.sql, {
        action: 'vendor.claimed',
        actorUserId: ctx.auth.userId,
        vendorId: result.vendorId,
      });
    }
    return result;
  }),

  signup: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(2).max(120),
        phone: z.string().min(7).max(20),
        addressLine1: z.string().min(3).max(200),
        city: z.string().min(2).max(80),
        region: z.string().min(2).max(40),
        postalCode: z.string().min(3).max(12),
        latitude: z.number(),
        longitude: z.number(),
        googlePlaceId: z.string().nullable().optional(),
        categorySlugs: z.array(z.string()).default([]),
        // GLO-35: the Vendor Agreement checkbox is required, enforced server-side.
        agreeToTerms: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.agreeToTerms) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must accept the Vendor Agreement to create a business account.',
        });
      }
      const existing = await getVendorForOwner(ctx.sql, ctx.auth.userId);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You already have a business account.' });
      }
      const { agreeToTerms: _agree, ...rest } = input;
      return createVendor(ctx.sql, { ownerUserId: ctx.auth.userId, ...rest, acceptedTerms: true });
    }),

  /**
   * What the vendor earns at a given deal price (GLO-35: the Vendor Agreement
   * promises estimated earnings are shown while pricing a deal). Uses the same
   * computeFee the checkout snapshots, including any vendor-specific override.
   */
  feePreview: protectedProcedure
    .input(z.object({ priceCents: z.number().int().min(50).max(5_000_000) }))
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      const fee = await computeFee(ctx.sql, input.priceCents, vendor.id);
      return {
        priceCents: fee.consumerPaidCents,
        feeCents: fee.platformFeeCents,
        vendorTakeCents: fee.vendorPayoutCents,
      };
    }),

  /** A vendor's own deals (any status) for their dashboard. */
  listDeals: protectedProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    return listVendorDeals(ctx.sql, vendor.id);
  }),

  /** The current vendor's amenities. */
  amenities: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.sql<{ amenities: string[] }[]>`
      SELECT amenities FROM public.vendors WHERE owner_user_id = ${ctx.auth.userId} LIMIT 1
    `;
    return rows[0]?.amenities ?? [];
  }),

  /** Update the vendor's amenity list. */
  updateAmenities: protectedProcedure
    .input(z.object({ amenities: z.array(z.string()).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      const clean = sanitizeAmenities(input.amenities);
      await ctx.sql`
        UPDATE public.vendors SET amenities = ${ctx.sql.json(clean)} WHERE id = ${vendor.id}
      `;
      return { amenities: clean };
    }),

  /** The current vendor's vibes (the spa's "feel" — clinical / luxe / trendy …). */
  vibes: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.sql<{ vibes: string[] }[]>`
      SELECT vibes FROM public.vendors WHERE owner_user_id = ${ctx.auth.userId} LIMIT 1
    `;
    return rows[0]?.vibes ?? [];
  }),

  /** Update the vendor's vibes (capped at 3 known slugs). */
  updateVibes: protectedProcedure
    .input(z.object({ vibes: z.array(z.string()).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      const clean = sanitizeVibes(input.vibes);
      await ctx.sql`
        UPDATE public.vendors SET vibes = ${ctx.sql.json(clean)} WHERE id = ${vendor.id}
      `;
      return { vibes: clean };
    }),

  /**
   * Profile editor — surfaces the fields the storefront cares about but
   * onboarding doesn't collect. All fields optional; passing undefined leaves
   * a column untouched, passing null clears it. Used by the "Complete your
   * profile" card in the vendor dashboard.
   */
  updateProfile: protectedProcedure
    .input(z.object({
      description: z.string().max(2000).nullable().optional(),
      website: z.string().url().nullable().optional().or(z.literal('')),
      instagramHandle: z.string().max(60).nullable().optional(),
      hoursSummary: z.string().max(280).nullable().optional(),
      heroImageUrl: z.string().url().nullable().optional(),
      logoUrl: z.string().url().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      // Normalize: empty string → null. Strip leading "@" on Instagram so the
      // storefront's `@${handle}` template doesn't double up.
      const website = input.website === '' ? null : input.website;
      const insta = input.instagramHandle == null
        ? input.instagramHandle
        : input.instagramHandle.trim().replace(/^@/, '') || null;

      await ctx.sql`
        UPDATE public.vendors SET
          description       = ${input.description       === undefined ? ctx.sql`description`       : input.description},
          website           = ${website                 === undefined ? ctx.sql`website`           : website},
          instagram_handle  = ${insta                   === undefined ? ctx.sql`instagram_handle`  : insta},
          hours_summary     = ${input.hoursSummary      === undefined ? ctx.sql`hours_summary`     : input.hoursSummary},
          hero_image_url    = ${input.heroImageUrl      === undefined ? ctx.sql`hero_image_url`    : input.heroImageUrl},
          logo_url          = ${input.logoUrl           === undefined ? ctx.sql`logo_url`          : input.logoUrl},
          updated_at        = now()
        WHERE id = ${vendor.id}
      `;
      return { ok: true };
    }),

  /** Profile fields the dashboard editor needs to prefill itself. */
  myProfile: protectedProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    const rows = await ctx.sql<{
      description: string | null;
      website: string | null;
      instagram_handle: string | null;
      hours_summary: string | null;
      hero_image_url: string | null;
      logo_url: string | null;
    }[]>`
      SELECT description, website, instagram_handle, hours_summary, hero_image_url, logo_url
      FROM public.vendors WHERE id = ${vendor.id} LIMIT 1
    `;
    const r = rows[0];
    return {
      description: r?.description ?? '',
      website: r?.website ?? '',
      instagramHandle: r?.instagram_handle ?? '',
      hoursSummary: r?.hours_summary ?? '',
      heroImageUrl: r?.hero_image_url ?? null,
      logoUrl: r?.logo_url ?? null,
    };
  }),

  /** Issue a signed upload URL for a deal photo or video. Browser PUTs the file to it. */
  signPhotoUpload: protectedProcedure
    .input(z.object({ fileExt: z.string().max(8), kind: z.enum(['photo', 'video']).default('photo') }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      return createSignedUpload(vendor.id, input.fileExt, input.kind);
    }),

  /* ---------- License verification (GLO-19) ---------- */

  /** The vendor's own license submission state, for the Settings card. */
  licenseInfo: protectedProcedure.query(({ ctx }) => getLicenseInfo(ctx.sql, ctx.auth.userId)),

  /**
   * Signed upload URL for the license document (photo or PDF). The bucket is
   * private — the browser PUTs to uploadUrl, then passes the returned `path`
   * to submitLicense. Admins view it later via a short-lived signed read URL.
   */
  signLicenseUpload: protectedProcedure
    .input(z.object({ fileExt: z.string().max(8) }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      const signed = await createSignedUpload(vendor.id, input.fileExt, 'license');
      return { uploadUrl: signed.uploadUrl, path: signed.path };
    }),

  /**
   * Submit (or resubmit after rejection) license info + document for admin
   * review. documentPath may be omitted on a resubmit to keep the
   * previously-uploaded document.
   */
  submitLicense: protectedProcedure
    .input(
      z.object({
        licenseNumber: z.string().min(3).max(60),
        licenseState: z.string().length(2),
        licenseType: z.string().min(2).max(80),
        documentPath: z.string().min(3).max(300).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      // The path must point inside this vendor's own folder — a vendor must
      // not be able to attach someone else's document to their submission.
      if (input.documentPath && !input.documentPath.startsWith(`${vendor.id}/`)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid document path.' });
      }
      let info;
      try {
        info = await submitLicense(ctx.sql, vendor.id, { ...input, documentPath: input.documentPath ?? null });
      } catch (e) {
        if (e instanceof LicenseSubmitError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
      void writeAudit(ctx.sql, {
        action: 'vendor.license_submitted',
        actorUserId: ctx.auth.userId,
        vendorId: vendor.id,
        meta: { licenseState: input.licenseState.toUpperCase(), licenseType: input.licenseType },
      });
      return info;
    }),

  /** Vendor-level profile videos (the storefront "Inside the spa" reel). */
  listVideos: protectedProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    return listVendorVideos(ctx.sql, vendor.id);
  }),

  addVideo: protectedProcedure
    .input(videoInput)
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      try {
        return await addVendorVideo(ctx.sql, vendor.id, input);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
    }),

  deleteVideo: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      await deleteVendorVideo(ctx.sql, vendor.id, input.videoId);
      return { ok: true };
    }),

  /** Create a deal (or draft) with variants + photos + videos. */
  createDeal: protectedProcedure.input(dealInput).mutation(async ({ ctx, input }) => {
    const vendor = await requireVendor(ctx);
    if (!input.asDraft) await assertCanPost(ctx);
    assertVariantPricing(input.variants);

    const created = await createDeal(ctx.sql, {
      vendorId: vendor.id,
      ...dealFields(input),
      asDraft: input.asDraft,
    });
    await refreshDealMap(ctx.sql, created.id, vendor, input.redemptionLat, input.redemptionLng);
    return created;
  }),

  /** Load one of the vendor's deals (with children) — for the edit form. */
  getDeal: protectedProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      return getVendorDeal(ctx.sql, vendor.id, input.dealId);
    }),

  /** Edit a deal. Editing a live deal bounces it back to pending_review. */
  updateDeal: protectedProcedure
    .input(dealInput.extend({ dealId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      if (!input.asDraft) await assertCanPost(ctx);
      assertVariantPricing(input.variants);

      const updated = await updateDeal(ctx.sql, {
        dealId: input.dealId,
        vendorId: vendor.id,
        ...dealFields(input),
        asDraft: input.asDraft,
      });
      await refreshDealMap(ctx.sql, input.dealId, vendor, input.redemptionLat, input.redemptionLng);
      return updated;
    }),

  /** Pause / resume / submit a deal. */
  setDealStatus: protectedProcedure
    .input(z.object({ dealId: z.string().uuid(), to: z.enum(['active', 'paused', 'pending_review']) }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      if (input.to !== 'paused') await assertCanPost(ctx);
      try {
        return await setDealStatus(ctx.sql, vendor.id, input.dealId, input.to);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
    }),

  /** Sweep elapsed deals to 'expired'. Safe to call on a schedule or page load. */
  sweepExpired: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await expireElapsedDeals(ctx.sql);
    return { expired: count };
  }),

  /** Hub-header + money-card data in one DB roundtrip. Stripe balance is separate. */
  hubSnapshot: protectedProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    return getVendorHubSnapshot(ctx.sql, vendor.id);
  }),

  /** Live balance from Stripe (split out so a slow Stripe call doesn't block the hub). */
  stripeMoney: protectedProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    return getStripeMoneyForVendor(ctx.sql, vendor.id);
  }),

  /** Voucher list for the Vouchers card. */
  vouchers: protectedProcedure
    .input(z.object({ tab: z.enum(['active', 'redeemed', 'past']) }))
    .query(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      return listVendorVouchers(ctx.sql, vendor.id, input.tab);
    }),

  /** Snapshot for the "Pay me now" UI: opt-in flag, eligibility, available $. */
  instantPayoutStatus: protectedProcedure.query(async ({ ctx }) => {
    const vendor = await requireVendor(ctx);
    return getInstantPayoutStatus(ctx.sql, vendor.id);
  }),

  /** Vendor opts in or out of instant payouts (3% fee). See §1b. */
  setInstantPayoutEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      await ctx.sql`
        UPDATE public.vendors
        SET instant_payout_enabled = ${input.enabled}, updated_at = now()
        WHERE id = ${vendor.id}
      `;
      void writeAudit(ctx.sql, {
        action: 'instant_payout.toggled',
        actorUserId: ctx.auth.userId,
        vendorId: vendor.id,
        meta: { enabled: input.enabled },
      });
      return { enabled: input.enabled };
    }),

  /**
   * Look up a voucher by QR payload or human code, scoped to this vendor.
   * Read-only — returns the deal/customer details for the confirm screen.
   * Refuses if the voucher isn't ours, isn't active, or is expired.
   */
  lookupVoucher: protectedProcedure
    .input(z.object({ code: z.string().min(4).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      try {
        return await lookupClaimForVendor(ctx.sql, vendor.id, ctx.auth.userId, input.code);
      } catch (e) {
        if (e instanceof RedemptionError) {
          throw new TRPCError({
            code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: e.message,
          });
        }
        throw e;
      }
    }),

  /**
   * Actually redeem a voucher. Vendor + claim must match. Atomic.
   * Fires Stripe Transfer if vendor has auto_release_on_redemption.
   */
  redeemVoucher: protectedProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      try {
        return await redeemClaimByVendor(ctx.sql, vendor.id, ctx.auth.userId, input.claimId);
      } catch (e) {
        if (e instanceof RedemptionError) {
          throw new TRPCError({
            code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: e.message,
          });
        }
        throw e;
      }
    }),

  /** Fire an Instant Payout for the vendor. Stripe deducts the 3% fee. */
  requestInstantPayout: protectedProcedure
    .input(z.object({ amountCents: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      try {
        return await triggerInstantPayout(ctx.sql, vendor.id, input.amountCents, ctx.auth.userId);
      } catch (e) {
        if (e instanceof InstantPayoutError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: e instanceof Error ? e.message : 'Instant payout failed.',
        });
      }
    }),
});
