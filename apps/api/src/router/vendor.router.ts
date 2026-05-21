import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { Sql } from '../db/client';
import { createSignedUpload } from '../db/storage';
import { sanitizeAmenities } from '../domain/amenities';
import {
  createDeal,
  expireElapsedDeals,
  getVendorDeal,
  listVendorDeals,
  setDealStatus,
  updateDeal,
} from '../domain/dealCreate';
import { cacheStaticMap } from '../domain/dealMap';
import { createVendor, getSetupStatus, getVendorForOwner, type VendorRecord } from '../domain/vendorSignup';
import { getVendorDashboardLink, startVendorOnboarding } from '../domain/vendorStripe';
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

const dealInput = z.object({
  categoryId: z.string().uuid(),
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
  codeValidityDays: z.number().int().min(1).max(90).default(7),
  photoUrls: z.array(z.string().url()).max(8).default([]),
  videos: z.array(videoInput).max(6).default([]),
  variants: z.array(variantInput).min(1, 'Add at least one option'),
  asDraft: z.boolean().default(false),
});

type DealInput = z.infer<typeof dealInput>;

/** Maps the validated input to the domain layer's field set. */
function dealFields(input: DealInput) {
  return {
    categoryId: input.categoryId,
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
    codeValidityDays: input.codeValidityDays,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getVendorForOwner(ctx.sql, ctx.auth.userId);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You already have a business account.' });
      }
      return createVendor(ctx.sql, { ownerUserId: ctx.auth.userId, ...input });
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

  /** Issue a signed upload URL for a deal photo or video. Browser PUTs the file to it. */
  signPhotoUpload: protectedProcedure
    .input(z.object({ fileExt: z.string().max(8), kind: z.enum(['photo', 'video']).default('photo') }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      return createSignedUpload(vendor.id, input.fileExt, input.kind);
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
});
