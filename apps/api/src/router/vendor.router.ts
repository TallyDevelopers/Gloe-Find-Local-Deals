import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createSignedUpload } from '../db/storage';
import { sanitizeAmenities } from '../domain/amenities';
import { createDeal, listVendorDeals } from '../domain/dealCreate';
import { createVendor, getSetupStatus, getVendorForOwner } from '../domain/vendorSignup';
import { protectedProcedure, router } from './trpc';

/** Loads the current user's vendor or throws — used by vendor-only mutations. */
async function requireVendor(ctx: { sql: Parameters<typeof getVendorForOwner>[0]; auth: { userId: string } }) {
  const vendor = await getVendorForOwner(ctx.sql, ctx.auth.userId);
  if (!vendor) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No business account found.' });
  }
  return vendor;
}

export const vendorRouter = router({
  me: protectedProcedure.query(({ ctx }) => getVendorForOwner(ctx.sql, ctx.auth.userId)),

  setupStatus: protectedProcedure.query(({ ctx }) => getSetupStatus(ctx.sql, ctx.auth.userId)),

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

  /** Issue a signed upload URL for a deal photo. Browser PUTs the file to it. */
  signPhotoUpload: protectedProcedure
    .input(z.object({ fileExt: z.string().max(8) }))
    .mutation(async ({ ctx, input }) => {
      const vendor = await requireVendor(ctx);
      return createSignedUpload(vendor.id, input.fileExt);
    }),

  /** Create a deal with variants + photos. Must be able to post (approved + license + stripe). */
  createDeal: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        subtypeId: z.string().uuid().nullable().optional(),
        title: z.string().min(3).max(140),
        description: z.string().min(10).max(2000),
        whatsIncluded: z.array(z.string().max(200)).max(12).default([]),
        restrictions: z.array(z.string().max(200)).max(12).default([]),
        finePrint: z.string().max(2000).nullable().optional(),
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
          .min(1, 'Add at least one option'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const setup = await getSetupStatus(ctx.sql, ctx.auth.userId);
      if (!setup) throw new TRPCError({ code: 'FORBIDDEN', message: 'No business account found.' });
      if (!setup.canPostDeals) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Finish your setup (approval, license, and bank) before posting.',
        });
      }
      const vendor = await requireVendor(ctx);

      // Validate deal price < original on every variant
      for (const v of input.variants) {
        if (v.dealPriceCents >= v.originalPriceCents) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `"${v.label}": deal price must be less than the original price.`,
          });
        }
      }

      return createDeal(ctx.sql, {
        vendorId: vendor.id,
        categoryId: input.categoryId,
        subtypeId: input.subtypeId ?? null,
        title: input.title,
        description: input.description,
        whatsIncluded: input.whatsIncluded,
        restrictions: input.restrictions,
        finePrint: input.finePrint ?? null,
        expiresAt: input.expiresAt,
        perCustomerLimit: input.perCustomerLimit,
        codeValidityDays: input.codeValidityDays,
        photoUrls: input.photoUrls,
        variants: input.variants,
      });
    }),
});
