import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  getAdminCustomerDetail,
  getAdminPulse,
  getAdminTransactionDetail,
  getOverview,
  getRecentActivity,
  getTopVendors,
  getPendingDeals,
  getVendorDetail,
  getVendorRoster,
  isAdmin,
  listAdminAuditLog,
  listAdminCustomers,
  listAdminPayouts,
  listAdminTransactions,
  reviewDeal,
  searchEverything,
  setVendorAutoReleaseOnRedemption,
  setVendorSuspended,
} from '../domain/admin';
import { writeAudit } from '../domain/audit';
import { createDeal, getDealForReview, updateDeal } from '../domain/dealCreate';
import { cacheStaticMap } from '../domain/dealMap';
import {
  createTier,
  deactivateTier,
  listTiers,
  reactivateTier,
  TierOverlapError,
  updateTier,
} from '../domain/fees';
import {
  reconcileVendorTransfers,
  releaseTransferForClaim,
  retryFailedPayout,
} from '../domain/payouts';
import { getConnectedAccountRequirements, getPlatformBalance } from '../domain/stripe';
import { getStripeMoneyForVendor } from '../domain/vendorHub';
import { refundTransaction, windDownVendor } from '../domain/vendorOps';
import { dealInput, dealFields } from './vendor.router';
import { createVendor } from '../domain/vendorSignup';
import { startVendorOnboarding } from '../domain/vendorStripe';
import { adminProcedure, protectedProcedure, router } from './trpc';

export const adminRouter = router({
  /** Lets the web app route a login to admin vs vendor. Any signed-in user. */
  whoami: protectedProcedure.query(async ({ ctx }) => {
    return { isAdmin: await isAdmin(ctx.sql, ctx.auth.userId) };
  }),

  overview: adminProcedure.query(({ ctx }) => getOverview(ctx.sql)),

  /** ⌘K global search — vendors, customers, transactions, deals. */
  search: adminProcedure
    .input(z.object({ query: z.string().min(0).max(120) }))
    .query(({ ctx, input }) => searchEverything(ctx.sql, input.query)),

  /** Pulse counters for the admin home. Poll every ~10s. */
  pulse: adminProcedure.query(({ ctx }) => getAdminPulse(ctx.sql)),

  /**
   * Live Gloe platform Stripe balance. Separate from pulse() because it hits
   * Stripe's API (200-500ms vs the 50ms DB call) — pulse polls every 10s and
   * we don't want to hit Stripe at that rate. UI polls this on a longer cycle.
   */
  platformStripeBalance: adminProcedure.query(async () => {
    try {
      return await getPlatformBalance();
    } catch (e) {
      // Don't fail the whole Pulse view if Stripe is down — return zeros
      // and let the UI surface a "live balance unavailable" note.
      return { availableCents: 0, pendingCents: 0, error: (e instanceof Error ? e.message : String(e)) };
    }
  }),

  /** Transactions explorer list with filters. */
  listTransactions: adminProcedure
    .input(
      z.object({
        status: z.array(z.string()).optional(),
        vendorId: z.string().uuid().optional(),
        since: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(({ ctx, input }) => listAdminTransactions(ctx.sql, input)),

  /** Transaction drill-in: tx + vendor + customer + claims + audit. */
  transactionDetail: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => getAdminTransactionDetail(ctx.sql, input.id)),

  /** Customers explorer list. */
  listCustomers: adminProcedure
    .input(z.object({ query: z.string().optional() }))
    .query(({ ctx, input }) => listAdminCustomers(ctx.sql, input.query)),

  /** Customer drill-in. */
  customerDetail: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => getAdminCustomerDetail(ctx.sql, input.id)),

  /** Payouts explorer list. */
  listPayouts: adminProcedure
    .input(
      z.object({
        status: z.array(z.string()).optional(),
        vendorId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(({ ctx, input }) => listAdminPayouts(ctx.sql, input)),

  /** Audit log explorer. */
  listAuditLog: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        vendorId: z.string().uuid().optional(),
        actorUserId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(({ ctx, input }) => listAdminAuditLog(ctx.sql, input)),
  topVendors: adminProcedure.query(({ ctx }) => getTopVendors(ctx.sql)),
  vendorRoster: adminProcedure.query(({ ctx }) => getVendorRoster(ctx.sql)),
  recentActivity: adminProcedure.query(({ ctx }) => getRecentActivity(ctx.sql)),

  /** One vendor's profile + all their listings (any status). */
  vendorDetail: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(({ ctx, input }) => getVendorDetail(ctx.sql, input.vendorId)),

  /** Live Stripe balance for a vendor's connected account (god-mode reconciliation). */
  vendorStripeMoney: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(({ ctx, input }) => getStripeMoneyForVendor(ctx.sql, input.vendorId)),

  /** Reconciliation panel data: our DB vs Stripe's live view of the same vendor. */
  vendorReconciliation: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(({ ctx, input }) => reconcileVendorTransfers(ctx.sql, input.vendorId)),

  /** Stripe's account requirements (what they're asking the vendor to fix). */
  vendorStripeRequirements: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.sql<{ stripe_account_id: string | null }[]>`
        SELECT stripe_account_id FROM public.vendors WHERE id = ${input.vendorId} LIMIT 1
      `;
      const acct = rows[0]?.stripe_account_id;
      if (!acct) return null;
      try {
        return await getConnectedAccountRequirements(acct);
      } catch {
        return null;
      }
    }),

  /** Retry a failed standard payout — creates a fresh Stripe payout. */
  retryPayout: adminProcedure
    .input(z.object({ payoutId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await retryFailedPayout(ctx.sql, input.payoutId, ctx.auth.userId);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Retry failed.' });
      }
    }),

  /**
   * Refund a transaction by amount. Full or partial. Eligibility (active or
   * expired claim, not redeemed) + race safety are enforced inside the domain
   * function. See `refundTransaction` for the rules.
   */
  refundTransaction: adminProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
      amountCents: z.number().int().positive(),
      reason: z.string().min(3).max(280),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await refundTransaction(
        ctx.sql,
        input.transactionId,
        input.amountCents,
        ctx.auth.userId,
        input.reason,
      );
      if (!result.refunded) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error ?? 'Refund failed.' });
      }
      return result;
    }),

  /** Wind down a vendor: refund every active voucher, then suspend. */
  windDownVendor: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), reason: z.string().min(3).max(280) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await windDownVendor(ctx.sql, input.vendorId, ctx.auth.userId, input.reason);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Wind-down failed.' });
      }
    }),

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

  /**
   * God-mode quick-edit. For the most-edited fields (title / description /
   * fine print / expiry) without sending the deal back through review.
   * Use this for "fix the typo, remove the bad fine print, push the expiry"
   * fixes; for variant/photo/video changes route through the full updateDeal.
   */
  quickEditDeal: adminProcedure
    .input(z.object({
      dealId: z.string().uuid(),
      title: z.string().min(3).max(140).optional(),
      description: z.string().min(10).max(2000).optional(),
      finePrint: z.string().max(2000).nullable().optional(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Pull the deal to confirm it exists + capture before-state for audit.
      const rows = await ctx.sql<{ vendor_id: string; status: string; title: string }[]>`
        SELECT vendor_id, status, title FROM public.deals WHERE id = ${input.dealId} LIMIT 1
      `;
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
      if (row.status === 'expired' || row.status === 'sold_out') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This deal can no longer be edited.' });
      }

      // Build the SET clause dynamically — only update fields the caller sent.
      const changes: Record<string, unknown> = {};
      if (input.title !== undefined)       changes.title = input.title;
      if (input.description !== undefined) changes.description = input.description;
      if (input.finePrint !== undefined)   changes.fine_print = input.finePrint;
      if (input.expiresAt !== undefined)   changes.expires_at = input.expiresAt;
      if (Object.keys(changes).length === 0) {
        return { id: input.dealId, status: row.status, changed: 0 };
      }

      // Manual COALESCE-style update (postgres tag template requires this shape).
      await ctx.sql`
        UPDATE public.deals
        SET title       = COALESCE(${changes.title       as string | undefined ?? null}, title),
            description = COALESCE(${changes.description as string | undefined ?? null}, description),
            fine_print  = ${input.finePrint === undefined ? ctx.sql`fine_print` : input.finePrint},
            expires_at  = COALESCE(${changes.expires_at  as string | undefined ?? null}, expires_at),
            updated_at  = now()
        WHERE id = ${input.dealId}
      `;

      void writeAudit(ctx.sql, {
        action: 'deal.admin_edited',
        actorUserId: ctx.auth.userId,
        vendorId: row.vendor_id,
        meta: { dealId: input.dealId, fields: Object.keys(changes), previousTitle: row.title },
      });

      return { id: input.dealId, status: row.status, changed: Object.keys(changes).length };
    }),

  /**
   * God-mode edit a vendor's deal (full form). Bypasses the "edits bounce to
   * pending_review" rule that applies to vendor self-edits — admins can fix
   * typos on a live deal without disrupting customers. Every edit is audited.
   */
  updateDeal: adminProcedure
    .input(dealInput.extend({
      dealId: z.string().uuid(),
      vendorId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await updateDeal(ctx.sql, {
          dealId: input.dealId,
          vendorId: input.vendorId,
          ...dealFields(input),
          asDraft: input.asDraft,
          preserveStatus: true,
        });
        void writeAudit(ctx.sql, {
          action: 'deal.admin_edited',
          actorUserId: ctx.auth.userId,
          vendorId: input.vendorId,
          meta: { dealId: input.dealId, title: input.title },
        });
        return result;
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Update failed.' });
      }
    }),

  /** The kill switch: suspend a vendor + pull all their posts to draft. */
  setVendorSuspended: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), suspended: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await setVendorSuspended(ctx.sql, input.vendorId, input.suspended);
      void writeAudit(ctx.sql, {
        action: input.suspended ? 'vendor.suspended' : 'vendor.reinstated',
        actorUserId: ctx.auth.userId,
        vendorId: input.vendorId,
      });
      return result;
    }),

  /** God-mode toggle: should this vendor's redemptions auto-fire a Stripe Transfer? */
  setVendorAutoRelease: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setVendorAutoReleaseOnRedemption(ctx.sql, input.vendorId, input.enabled);
      void writeAudit(ctx.sql, {
        action: 'vendor.auto_release.set',
        actorUserId: ctx.auth.userId,
        vendorId: input.vendorId,
        meta: { enabled: input.enabled },
      });
      return { enabled: input.enabled };
    }),

  /** God-mode push: release a held payout (auto-release off, or prior release failed). */
  pushHeldPayout: adminProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await releaseTransferForClaim(ctx.sql, input.claimId);
      } catch (e) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Could not release transfer.',
        });
      }
    }),

  /* ---------- Platform fee tiers ---------- */
  /** All tiers in a scope: global (vendorId null) or per-vendor override. */
  listFeeTiers: adminProcedure
    .input(z.object({ vendorId: z.string().uuid().nullable() }))
    .query(({ ctx, input }) => listTiers(ctx.sql, input.vendorId)),

  /** Add a new tier (global or per-vendor). Refuses overlap with active tiers. */
  createFeeTier: adminProcedure
    .input(
      z.object({
        label: z.string().min(1).max(60),
        minCents: z.number().int().min(0),
        maxCents: z.number().int().positive().nullable(),
        percentBps: z.number().int().min(0).max(5000).optional(),
        flatCents: z.number().int().min(0).optional(),
        vendorId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const tier = await createTier(ctx.sql, input);
        void writeAudit(ctx.sql, {
          action: 'fee_tier.created',
          actorUserId: ctx.auth.userId,
          vendorId: input.vendorId,
          meta: { tierId: tier.id, ...input },
        });
        return tier;
      } catch (e) {
        if (e instanceof TierOverlapError) {
          throw new TRPCError({ code: 'CONFLICT', message: e.message });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Could not create tier.',
        });
      }
    }),

  /** Edit a tier in place. Refuses overlap with other active tiers. */
  updateFeeTier: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(60),
        minCents: z.number().int().min(0),
        maxCents: z.number().int().positive().nullable(),
        percentBps: z.number().int().min(0).max(5000).optional(),
        flatCents: z.number().int().min(0).optional(),
        vendorId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;
      try {
        await updateTier(ctx.sql, id, patch);
        void writeAudit(ctx.sql, {
          action: 'fee_tier.updated',
          actorUserId: ctx.auth.userId,
          vendorId: input.vendorId,
          meta: { tierId: id, ...patch },
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof TierOverlapError) {
          throw new TRPCError({ code: 'CONFLICT', message: e.message });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Could not update tier.',
        });
      }
    }),

  /** Soft-delete a tier (sets active=false). */
  deactivateFeeTier: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deactivateTier(ctx.sql, input.id);
      void writeAudit(ctx.sql, {
        action: 'fee_tier.deactivated',
        actorUserId: ctx.auth.userId,
        meta: { tierId: input.id },
      });
      return { ok: true };
    }),

  /** Re-activate a previously-deactivated tier. Refuses if it would overlap. */
  reactivateFeeTier: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await reactivateTier(ctx.sql, input.id);
        void writeAudit(ctx.sql, {
          action: 'fee_tier.reactivated',
          actorUserId: ctx.auth.userId,
          meta: { tierId: input.id },
        });
        return { ok: true };
      } catch (e) {
        if (e instanceof TierOverlapError) {
          throw new TRPCError({ code: 'CONFLICT', message: e.message });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: e instanceof Error ? e.message : 'Could not reactivate tier.',
        });
      }
    }),

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
