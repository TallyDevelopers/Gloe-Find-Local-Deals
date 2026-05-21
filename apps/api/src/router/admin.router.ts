import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  getOverview,
  getRecentActivity,
  getTopVendors,
  getPendingDeals,
  getVendorDetail,
  getVendorRoster,
  isAdmin,
  reviewDeal,
  setVendorSuspended,
} from '../domain/admin';
import { createDeal, getDealForReview } from '../domain/dealCreate';
import { cacheStaticMap } from '../domain/dealMap';
import { createVendor } from '../domain/vendorSignup';
import { startVendorOnboarding } from '../domain/vendorStripe';
import { adminProcedure, protectedProcedure, router } from './trpc';

export const adminRouter = router({
  /** Lets the web app route a login to admin vs vendor. Any signed-in user. */
  whoami: protectedProcedure.query(async ({ ctx }) => {
    return { isAdmin: await isAdmin(ctx.sql, ctx.auth.userId) };
  }),

  overview: adminProcedure.query(({ ctx }) => getOverview(ctx.sql)),
  topVendors: adminProcedure.query(({ ctx }) => getTopVendors(ctx.sql)),
  vendorRoster: adminProcedure.query(({ ctx }) => getVendorRoster(ctx.sql)),
  recentActivity: adminProcedure.query(({ ctx }) => getRecentActivity(ctx.sql)),

  /** One vendor's profile + all their listings (any status). */
  vendorDetail: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(({ ctx, input }) => getVendorDetail(ctx.sql, input.vendorId)),

  /** Founder triggers Stripe onboarding for a spa — returns the link to send them. */
  startVendorStripeOnboarding: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), refreshUrl: z.string().url(), returnUrl: z.string().url() }))
    .mutation(({ ctx, input }) =>
      startVendorOnboarding(ctx.sql, input.vendorId, {
        refreshUrl: input.refreshUrl,
        returnUrl: input.returnUrl,
      }),
    ),

  /** All deals awaiting review. */
  pendingDeals: adminProcedure.query(({ ctx }) => getPendingDeals(ctx.sql)),

  /** Full detail of one deal for the expanded review panel. */
  dealDetail: adminProcedure
    .input(z.object({ dealId: z.string().uuid() }))
    .query(({ ctx, input }) => getDealForReview(ctx.sql, input.dealId)),

  /** The kill switch: suspend a vendor + pull all their posts to draft. */
  setVendorSuspended: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), suspended: z.boolean() }))
    .mutation(({ ctx, input }) => setVendorSuspended(ctx.sql, input.vendorId, input.suspended)),

  /** Approve or reject a pending deal. */
  reviewDeal: adminProcedure
    .input(z.object({
      dealId: z.string().uuid(),
      decision: z.enum(['approve', 'reject']),
      reason: z.string().max(500).nullable().optional(),
    }))
    .mutation(({ ctx, input }) =>
      reviewDeal(ctx.sql, ctx.auth.userId, input.dealId, input.decision, input.reason),
    ),

  /** God-mode: flip a vendor's gates so they can post without license/Stripe. */
  setVendorOverride: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), bypassRequirements: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Mark active + record the override so getSetupStatus can honor it.
      await ctx.sql`
        UPDATE public.vendors
        SET status = ${input.bypassRequirements ? 'active' : 'pending_approval'},
            admin_bypass = ${input.bypassRequirements}
        WHERE id = ${input.vendorId}
      `;
      return { ok: true };
    }),

  /** Create a vendor on a spa's behalf — no signup from them required. */
  createVendorOnBehalf: adminProcedure
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
      // ownerUserId null = unclaimed; the spa claims it later via Stripe.
      const vendor = await createVendor(ctx.sql, { ownerUserId: null, ...input });
      // Founder-created vendors are live immediately and bypass gates.
      await ctx.sql`
        UPDATE public.vendors SET status = 'active', admin_bypass = true WHERE id = ${vendor.id}
      `;
      return vendor;
    }),

  /** Post a deal for a vendor (live immediately). Reuses the deal create path. */
  postDealOnBehalf: adminProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
        categoryId: z.string().uuid(),
        subtypeId: z.string().uuid().nullable().optional(),
        title: z.string().min(3).max(140),
        description: z.string().min(10).max(2000),
        whatsIncluded: z.array(z.string().max(200)).max(12).default([]),
        restrictions: z.array(z.string().max(200)).max(12).default([]),
        finePrint: z.string().max(2000).nullable().optional(),
        redemptionAddress: z.string().max(300).nullable().optional(),
        redemptionLat: z.number().nullable().optional(),
        redemptionLng: z.number().nullable().optional(),
        expiresAt: z.string(),
        perCustomerLimit: z.number().int().min(1).max(10).default(1),
        codeValidityDays: z.number().int().min(1).max(90).default(7),
        photoUrls: z.array(z.string().url()).max(8).default([]),
        variants: z
          .array(
            z.object({
              label: z.string().min(1).max(60),
              unitCount: z.number().int().positive().nullable().optional(),
              unitLabel: z.string().max(20).nullable().optional(),
              originalPriceCents: z.number().int().positive(),
              dealPriceCents: z.number().int().positive(),
              spotsTotal: z.number().int().positive().nullable().optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const v of input.variants) {
        if (v.dealPriceCents >= v.originalPriceCents) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `"${v.label}": deal price must be below original.` });
        }
      }
      const created = await createDeal(ctx.sql, {
        vendorId: input.vendorId,
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
        expiresAt: input.expiresAt,
        perCustomerLimit: input.perCustomerLimit,
        codeValidityDays: input.codeValidityDays,
        photoUrls: input.photoUrls,
        variants: input.variants,
      });
      // Founder-posted deals go live immediately.
      await ctx.sql`UPDATE public.deals SET status = 'active' WHERE id = ${created.id}`;

      // Cache the map (custom coords, else vendor address).
      const vendorRows = await ctx.sql<{ lat: number | null; lng: number | null }[]>`
        SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
        FROM public.vendors WHERE id = ${input.vendorId} LIMIT 1
      `;
      const lat = input.redemptionLat ?? vendorRows[0]?.lat ?? null;
      const lng = input.redemptionLng ?? vendorRows[0]?.lng ?? null;
      if (lat != null && lng != null) {
        const url = await cacheStaticMap(created.id, lat, lng);
        if (url) await ctx.sql`UPDATE public.deals SET redemption_map_url = ${url} WHERE id = ${created.id}`;
      }
      return created;
    }),
});
