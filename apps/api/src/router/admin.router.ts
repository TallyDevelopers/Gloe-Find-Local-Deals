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
  getAdminRole,
  listAdmins,
  countOwners,
  addAdminByEmail,
  removeAdmin,
  setAdminRole,
  listAdminAuditLog,
  listAdminRefunds,
  listAdminCustomers,
  listAdminPayouts,
  listAdminSupportTickets,
  getAdminSupportTicketDetail,
  createAgentReply,
  setSupportTicketStatus,
  listAdminTransactions,
  setVendorTake,
  reviewDeal,
  searchEverything,
  setVendorAutoReleaseOnRedemption,
  setVendorAutoClawbackOnDisputeLost,
  setVendorSuspended,
} from '../domain/admin';
import { writeAudit } from '../domain/audit';
import { getLicenseReviewQueue, LicenseReviewError, reviewVendorLicense } from '../domain/vendorLicense';
import { InviteError, inviteVendorOwner } from '../domain/vendorClaim';
import { getCustomerOrdersForTicket, getSupportTicketCustomer } from '../domain/supportTickets';
import { createSignedReadUrl, createSignedUpload } from '../db/storage';
import { addVendorVideo, deleteVendorVideo, listVendorVideos } from '../domain/vendorMedia';
import { findPlaceId, isMapsConfigured } from '../domain/googleMaps';
import { createDeal, getDealForReview, replaceDealPhotos, updateDeal } from '../domain/dealCreate';
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
import { refundTransaction, forceRefundRedeemed, reconcileLostDispute, windDownVendor } from '../domain/vendorOps';
import { dealInput, dealFields } from './vendor.router';
import { createVendor } from '../domain/vendorSignup';
import { startVendorOnboarding } from '../domain/vendorStripe';
import { getTrendingConfig, setTrendingConfig, getDisputeRiskConfig, setDisputeRiskConfig, getVoucherValidityDays, setVoucherValidityDays } from '../domain/platformSettings';
import { reissueClaim } from '../domain/claims';
import {
  listNotificationTypes,
  updateNotificationType,
  getQueueStats,
} from '../domain/notifications';
import {
  listDiscoverSections,
  createDiscoverSection,
  updateDiscoverSection,
  deleteDiscoverSection,
  reorderDiscoverSections,
} from '../domain/discoverSections';
import { adminProcedure, protectedProcedure, router } from './trpc';

/** Throws FORBIDDEN unless the caller is an `owner` (not just an admin). */
async function assertOwner(ctx: { sql: Parameters<typeof getAdminRole>[0]; auth: { userId: string } }) {
  const role = await getAdminRole(ctx.sql, ctx.auth.userId);
  if (role !== 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can manage the admin team.' });
  }
}

export const adminRouter = router({
  /** Lets the web app route a login to admin vs vendor. Any signed-in user. */
  whoami: protectedProcedure.query(async ({ ctx }) => {
    return { isAdmin: await isAdmin(ctx.sql, ctx.auth.userId) };
  }),

  /* ───────────────────────── Admin team ───────────────────────── */

  /** Everyone with admin access. Any admin can view; only owners can mutate. */
  listAdmins: adminProcedure.query(({ ctx }) => listAdmins(ctx.sql, ctx.auth.userId)),

  /** Grant admin access by email. Owner-only. The person must already have an account. */
  addAdmin: adminProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['owner', 'moderator']).default('moderator'),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx);
      try {
        const { userId } = await addAdminByEmail(ctx.sql, input.email, input.role);
        void writeAudit(ctx.sql, {
          action: 'admin.added',
          actorUserId: ctx.auth.userId,
          meta: { grantedUserId: userId, email: input.email, role: input.role },
        });
        return { userId };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to add admin.';
        if (msg === 'NO_SUCH_USER') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No Gloē account found for that email. Ask them to sign in once first, then try again.' });
        }
        if (msg === 'ALREADY_ADMIN') {
          throw new TRPCError({ code: 'CONFLICT', message: 'That person is already an admin.' });
        }
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
      }
    }),

  /** Revoke admin access. Owner-only. Can't remove yourself or the last owner. */
  removeAdmin: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx);
      if (input.userId === ctx.auth.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "You can't remove your own admin access." });
      }
      const targetRole = await getAdminRole(ctx.sql, input.userId);
      if (!targetRole) throw new TRPCError({ code: 'NOT_FOUND', message: 'That admin no longer exists.' });
      if (targetRole === 'owner' && (await countOwners(ctx.sql)) <= 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can\'t remove the last owner. Promote someone else to owner first.' });
      }
      await removeAdmin(ctx.sql, input.userId);
      void writeAudit(ctx.sql, {
        action: 'admin.removed',
        actorUserId: ctx.auth.userId,
        meta: { removedUserId: input.userId, previousRole: targetRole },
      });
      return { ok: true };
    }),

  /** Change an admin's role. Owner-only. Can't demote the last owner. */
  setAdminRole: adminProcedure
    .input(z.object({ userId: z.string().uuid(), role: z.enum(['owner', 'moderator']) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx);
      const current = await getAdminRole(ctx.sql, input.userId);
      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'That admin no longer exists.' });
      if (current === input.role) return { ok: true };
      if (current === 'owner' && input.role !== 'owner' && (await countOwners(ctx.sql)) <= 1) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can\'t demote the last owner. Promote someone else first.' });
      }
      await setAdminRole(ctx.sql, input.userId, input.role);
      void writeAudit(ctx.sql, {
        action: 'admin.role_changed',
        actorUserId: ctx.auth.userId,
        meta: { targetUserId: input.userId, from: current, to: input.role },
      });
      return { ok: true };
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
        until: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(({ ctx, input }) => listAdminTransactions(ctx.sql, input)),

  /** Read the auto-"Trending" threshold (min purchases + window days). */
  getTrendingConfig: adminProcedure.query(({ ctx }) => getTrendingConfig(ctx.sql)),

  /** Tune the auto-"Trending" threshold (god-mode). */
  setTrendingConfig: adminProcedure
    .input(z.object({ minPurchases: z.number().int().min(1).max(10000), windowDays: z.number().int().min(1).max(365) }))
    .mutation(({ ctx, input }) => setTrendingConfig(ctx.sql, input)),

  /** The admin-chosen dispute-risk policy: what counts as "too many" disputes. */
  getDisputeRiskConfig: adminProcedure.query(({ ctx }) => getDisputeRiskConfig(ctx.sql)),

  /** Set the dispute-risk policy (god-mode). Owner-gated — it's a money/judgment lever. */
  setDisputeRiskConfig: adminProcedure
    .input(z.object({
      enabled: z.boolean(),
      maxDisputes: z.number().int().min(1).max(1000),
      windowDays: z.number().int().min(1).max(365),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx);
      return setDisputeRiskConfig(ctx.sql, input);
    }),

  /** How many days a freshly issued voucher stays redeemable (platform default). */
  getVoucherValidityDays: adminProcedure.query(async ({ ctx }) => ({
    days: await getVoucherValidityDays(ctx.sql),
  })),

  /** Set the voucher validity window. Applies to NEW vouchers only (GLO-29). */
  setVoucherValidityDays: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365) }))
    .mutation(async ({ ctx, input }) => ({
      days: await setVoucherValidityDays(ctx.sql, input.days),
    })),

  /**
   * Replace an expired voucher with a fresh active one — no new charge, no
   * spots bump, audit-logged, customer notified (GLO-29).
   */
  reissueClaim: adminProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      reissueClaim(ctx.sql, { claimId: input.claimId, actorUserId: ctx.auth.userId }),
    ),

  /** Notification registry: every push type with its enabled/delay/copy. */
  listNotificationTypes: adminProcedure.query(({ ctx }) => listNotificationTypes(ctx.sql)),

  /** Pending/sent/skipped counts for the delayed-push queue (panel header stats). */
  getNotificationQueueStats: adminProcedure.query(({ ctx }) => getQueueStats(ctx.sql)),

  /** Edit one push type (god-mode): toggle it, change the delay, or tweak copy. */
  updateNotificationType: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        enabled: z.boolean().optional(),
        delayMinutes: z.number().int().min(0).max(43200).optional(), // ≤ 30 days
        titleTemplate: z.string().min(1).max(200).optional(),
        bodyTemplate: z.string().min(1).max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) => updateNotificationType(ctx.sql, input)),

  /* ─────────────── Discover editorial sections (GLO-27) ─────────────── */

  /** All editorial home-feed sections (active + inactive), in display order. */
  listDiscoverSections: adminProcedure.query(({ ctx }) => listDiscoverSections(ctx.sql)),

  /** Author a new section: a tagline that pools 1..N categories into one rail. */
  createDiscoverSection: adminProcedure
    .input(z.object({
      tagline: z.string().min(1).max(120),
      categoryIds: z.array(z.string().uuid()).min(1).max(8),
      imageUrl: z.string().url().nullable().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const section = await createDiscoverSection(ctx.sql, input);
      void writeAudit(ctx.sql, {
        action: 'discover_section.created',
        actorUserId: ctx.auth.userId,
        meta: { sectionId: section.id, tagline: section.tagline, categoryIds: input.categoryIds },
      });
      return section;
    }),

  /** Edit a section: tagline, categories (replaces the set), image, order, active. */
  updateDiscoverSection: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      tagline: z.string().min(1).max(120).optional(),
      categoryIds: z.array(z.string().uuid()).min(1).max(8).optional(),
      imageUrl: z.string().url().nullable().optional(),
      displayOrder: z.number().int().min(0).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const section = await updateDiscoverSection(ctx.sql, input);
      void writeAudit(ctx.sql, {
        action: 'discover_section.updated',
        actorUserId: ctx.auth.userId,
        meta: { sectionId: input.id },
      });
      return section;
    }),

  deleteDiscoverSection: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDiscoverSection(ctx.sql, input.id);
      void writeAudit(ctx.sql, {
        action: 'discover_section.deleted',
        actorUserId: ctx.auth.userId,
        meta: { sectionId: input.id },
      });
      return { ok: true };
    }),

  /** Persist a new section ordering (ids in their new order). */
  reorderDiscoverSections: adminProcedure
    .input(z.object({ orderedIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await reorderDiscoverSections(ctx.sql, input.orderedIds);
      return { ok: true };
    }),

  /** Sign an upload URL for a section's tile art (reuses the vendor-media bucket
   *  under a `discover-sections` namespace). */
  signDiscoverSectionUpload: adminProcedure
    .input(z.object({ fileExt: z.string().max(8) }))
    .mutation(({ input }) => createSignedUpload('discover-sections', input.fileExt, 'photo')),

  /** Set the editorial "Gloē's take" + perk chips on a spa (admin-only). */
  setVendorTake: adminProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      take: z.string().max(600).nullable(),
      perks: z.array(z.string().max(60)).max(6),
    }))
    .mutation(({ ctx, input }) => setVendorTake(ctx.sql, input.vendorId, input.take, input.perks)),

  /** Sign an upload URL for a specific vendor's profile media (admin onboarding). */
  signVendorUpload: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), fileExt: z.string().max(8), kind: z.enum(['photo', 'video']).default('photo') }))
    .mutation(({ input }) => createSignedUpload(input.vendorId, input.fileExt, input.kind)),

  /** Vendor profile videos — admin can curate them on the spa's behalf at signup. */
  listVendorVideos: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .query(({ ctx, input }) => listVendorVideos(ctx.sql, input.vendorId)),

  addVendorVideo: adminProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      videoUrl: z.string().url(),
      thumbnailUrl: z.string().url(),
      caption: z.string().max(140).nullable().optional(),
      durationSeconds: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await addVendorVideo(ctx.sql, input.vendorId, input);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: (e as Error).message });
      }
    }),

  deleteVendorVideo: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), videoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteVendorVideo(ctx.sql, input.vendorId, input.videoId);
      return { ok: true };
    }),

  /**
   * Auto-resolve a vendor's Google place_id from its name + address and store
   * it. Clearing google_reviews_fetched_at forces the storefront to pull fresh
   * Google reviews on next view. Returns whether a match was found.
   */
  linkGooglePlace: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!isMapsConfigured()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Google Maps API key is not configured on the server.' });
      }
      const rows = await ctx.sql<{ business_name: string; address_line1: string; city: string; region: string; postal_code: string }[]>`
        SELECT business_name, address_line1, city, region, postal_code
        FROM public.vendors WHERE id = ${input.vendorId} LIMIT 1
      `;
      const v = rows[0];
      if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found.' });

      const query = [v.business_name, v.address_line1, v.city, v.region, v.postal_code].filter(Boolean).join(', ');
      let placeId: string | null;
      try {
        placeId = await findPlaceId(query);
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Google lookup failed: ${(e as Error).message}` });
      }
      if (!placeId) return { linked: false, placeId: null as string | null };

      await ctx.sql`
        UPDATE public.vendors
        SET google_place_id = ${placeId}, google_reviews_fetched_at = NULL, updated_at = now()
        WHERE id = ${input.vendorId}
      `;
      void writeAudit(ctx.sql, {
        action: 'vendor.google_place_linked',
        actorUserId: ctx.auth.userId,
        vendorId: input.vendorId,
        meta: { placeId },
      });
      return { linked: true, placeId };
    }),

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

  /* ── Support tickets ── */
  listSupportTickets: adminProcedure
    .input(
      z.object({
        query: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      }),
    )
    .query(({ ctx, input }) => listAdminSupportTickets(ctx.sql, input)),

  supportTicketDetail: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getAdminSupportTicketDetail(ctx.sql, input.id);
      } catch (e) {
        throw new TRPCError({ code: 'NOT_FOUND', message: e instanceof Error ? e.message : 'Not found' });
      }
    }),

  /** Rich customer profile for the support drawer header (spend, orders, tickets). */
  supportTicketCustomer: adminProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getSupportTicketCustomer(ctx.sql, input.ticketId);
      } catch (e) {
        throw new TRPCError({ code: 'NOT_FOUND', message: e instanceof Error ? e.message : 'Not found' });
      }
    }),

  /** Order history for a ticket's customer (shown in the support drawer).
   * Recency-capped + searchable; the tagged order is always included. */
  supportTicketOrders: adminProcedure
    .input(z.object({ ticketId: z.string().uuid(), search: z.string().max(80).optional() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getCustomerOrdersForTicket(ctx.sql, input.ticketId, input.search);
      } catch (e) {
        throw new TRPCError({ code: 'NOT_FOUND', message: e instanceof Error ? e.message : 'Not found' });
      }
    }),

  /**
   * Sign a one-shot upload URL for a support attachment from god-mode. Mirrors
   * support.signAttachmentUpload but is admin-gated.
   */
  signSupportAttachmentUpload: adminProcedure
    .input(z.object({ fileExt: z.string().max(8) }))
    .mutation(({ ctx, input }) =>
      createSignedUpload(ctx.auth.userId, input.fileExt, 'support'),
    ),

  replySupportTicket: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        body: z.string().min(1).max(5000),
        attachments: z
          .array(
            z.object({
              kind: z.enum(['image', 'video']),
              url: z.string().url(),
              thumbnailUrl: z.string().url().optional(),
              width: z.number().optional(),
              height: z.number().optional(),
            }),
          )
          .max(10)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createAgentReply(
          ctx.sql,
          input.ticketId,
          input.body,
          ctx.auth.userId,
          input.attachments,
        );
        void writeAudit(ctx.sql, {
          action: 'support.replied',
          actorUserId: ctx.auth.userId,
          meta: { ticketId: input.ticketId },
        });
        return result;
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Reply failed.' });
      }
    }),

  setSupportTicketStatus: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        status: z.enum(['awaiting_us', 'awaiting_customer', 'resolved', 'closed']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await setSupportTicketStatus(ctx.sql, input.ticketId, input.status, ctx.auth.userId);
        void writeAudit(ctx.sql, {
          action: 'support.status_set',
          actorUserId: ctx.auth.userId,
          meta: { ticketId: input.ticketId, status: input.status },
        });
        return result;
      } catch (e) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'Update failed.' });
      }
    }),

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

  /** Dedicated refund ledger — every refund (and blocked attempt) with full order/customer/redemption context. */
  listRefunds: adminProcedure
    .input(
      z.object({
        outcome: z.enum(['succeeded', 'refused']).optional(),
        vendorId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(300).optional(),
      }),
    )
    .query(({ ctx, input }) => listAdminRefunds(ctx.sql, input)),

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

  /**
   * Force-refund an ALREADY-REDEEMED voucher (the dispute / comp case). Refunds
   * the customer and, by default, claws back the vendor's share via a transfer
   * reversal. Owner-gated — it can push a vendor's Connect balance negative.
   */
  forceRefundRedeemed: adminProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
      amountCents: z.number().int().positive(),
      reason: z.string().min(3).max(280),
      reverseTransfer: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx);
      const result = await forceRefundRedeemed(
        ctx.sql,
        input.transactionId,
        input.amountCents,
        ctx.auth.userId,
        input.reason,
        input.reverseTransfer,
      );
      if (!result.refunded) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error ?? 'Refund failed.' });
      }
      return result;
    }),

  /**
   * Reconcile a LOST dispute (GLO-34): claw back the vendor's transfer when a
   * disputed-then-redeemed voucher's payout already went out and Stripe pulled
   * the charge back from the platform. Does NOT refund the customer (Stripe
   * already did, via the chargeback). Owner-gated.
   */
  reconcileLostDispute: adminProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx);
      const result = await reconcileLostDispute(ctx.sql, input.transactionId, ctx.auth.userId);
      if (!result.reversed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.error ?? 'Reconcile failed.' });
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
   * fine print / expiry / photos) without sending the deal back through review.
   * Use this for "fix the typo, remove the bad fine print, push the expiry,
   * swap the cover photo" fixes; for variant/video changes route through the
   * full updateDeal. When `photoUrls` is sent, it fully replaces the deal's
   * photo set (first = cover); omit it to leave photos untouched.
   */
  quickEditDeal: adminProcedure
    .input(z.object({
      dealId: z.string().uuid(),
      title: z.string().min(3).max(140).optional(),
      description: z.string().min(10).max(2000).optional(),
      finePrint: z.string().max(2000).nullable().optional(),
      expiresAt: z.string().optional(),
      photoUrls: z.array(z.string().min(1)).min(1).max(8).optional(),
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

      const hasFieldChanges = Object.keys(changes).length > 0;
      const hasPhotoChanges = input.photoUrls !== undefined;
      if (!hasFieldChanges && !hasPhotoChanges) {
        return { id: input.dealId, status: row.status, changed: 0 };
      }

      // Manual COALESCE-style update (postgres tag template requires this shape).
      if (hasFieldChanges) {
        await ctx.sql`
          UPDATE public.deals
          SET title       = COALESCE(${changes.title       as string | undefined ?? null}, title),
              description = COALESCE(${changes.description as string | undefined ?? null}, description),
              fine_print  = ${input.finePrint === undefined ? ctx.sql`fine_print` : input.finePrint},
              expires_at  = COALESCE(${changes.expires_at  as string | undefined ?? null}, expires_at),
              updated_at  = now()
          WHERE id = ${input.dealId}
        `;
      }

      // Photos: full replace (delete + reinsert). First URL becomes the cover.
      if (hasPhotoChanges) {
        await replaceDealPhotos(ctx.sql, input.dealId, input.photoUrls!);
        if (!hasFieldChanges) {
          await ctx.sql`UPDATE public.deals SET updated_at = now() WHERE id = ${input.dealId}`;
        }
      }

      const changedFields = [...Object.keys(changes), ...(hasPhotoChanges ? ['photos'] : [])];
      void writeAudit(ctx.sql, {
        action: 'deal.admin_edited',
        actorUserId: ctx.auth.userId,
        vendorId: row.vendor_id,
        meta: { dealId: input.dealId, fields: changedFields, previousTitle: row.title },
      });

      return { id: input.dealId, status: row.status, changed: changedFields.length };
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

  /**
   * GLO-5: send (or resend) the Clerk invitation to an unclaimed vendor's
   * owner. Optionally saves the email first (for vendors created without one).
   */
  inviteVendorOwner: adminProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      email: z.string().email().nullable().optional(),
      redirectUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await inviteVendorOwner(ctx.sql, input.vendorId, input.redirectUrl, input.email);
        void writeAudit(ctx.sql, {
          action: 'vendor.owner_invited',
          actorUserId: ctx.auth.userId,
          vendorId: input.vendorId,
          meta: { email: result.email },
        });
        return result;
      } catch (e) {
        if (e instanceof InviteError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),

  /** Vendors awaiting license review, oldest first (GLO-19). */
  licenseReviewQueue: adminProcedure.query(({ ctx }) => getLicenseReviewQueue(ctx.sql)),

  /**
   * Approve or reject a vendor's license (GLO-19). Approving a
   * pending_approval vendor also flips them active — this IS the
   * "vetted & licensed" gate opening.
   */
  reviewVendorLicense: adminProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      decision: z.enum(['approve', 'reject']),
      reason: z.string().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let result;
      try {
        result = await reviewVendorLicense(ctx.sql, input.vendorId, input.decision, input.reason);
      } catch (e) {
        if (e instanceof LicenseReviewError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
      void writeAudit(ctx.sql, {
        action: 'vendor.license_reviewed',
        actorUserId: ctx.auth.userId,
        vendorId: input.vendorId,
        meta: { decision: input.decision, reason: input.reason ?? null },
      });
      return result;
    }),

  /**
   * Fresh short-lived signed URL for a vendor's license document, fetched at
   * click time so the link can't expire inside a cached vendorDetail payload.
   */
  licenseDocumentUrl: adminProcedure
    .input(z.object({ vendorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.sql<{ license_document_path: string | null }[]>`
        SELECT license_document_path FROM public.vendors WHERE id = ${input.vendorId} LIMIT 1
      `;
      const path = rows[0]?.license_document_path;
      if (!path) throw new TRPCError({ code: 'NOT_FOUND', message: 'No license document on file.' });
      try {
        return { url: await createSignedReadUrl('license', path) };
      } catch {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not sign the document URL — try again.' });
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

  /** God-mode toggle: auto-reverse this vendor's transfer when a dispute is lost? */
  setVendorAutoClawback: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setVendorAutoClawbackOnDisputeLost(ctx.sql, input.vendorId, input.enabled);
      void writeAudit(ctx.sql, {
        action: 'vendor.auto_clawback.set',
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
      decision: z.enum(['approve', 'reject', 'request_changes']),
      reason: z.string().max(500).nullable().optional(),
    }))
    .mutation(({ ctx, input }) =>
      reviewDeal(ctx.sql, ctx.auth.userId, input.dealId, input.decision, input.reason),
    ),

  /** God-mode: flip a vendor's gates so they can post without license/Stripe. */
  setVendorOverride: adminProcedure
    .input(z.object({ vendorId: z.string().uuid(), bypassRequirements: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.bypassRequirements) {
        // Mark active + record the override so getSetupStatus can honor it.
        await ctx.sql`
          UPDATE public.vendors
          SET status = 'active', admin_bypass = true
          WHERE id = ${input.vendorId}
        `;
      } else {
        // Closing the gates must not delist a vendor who is active on merit —
        // a verified license (GLO-19) is its own path to 'active' now.
        await ctx.sql`
          UPDATE public.vendors
          SET admin_bypass = false,
              status = CASE WHEN license_status = 'verified' THEN status ELSE 'pending_approval' END
          WHERE id = ${input.vendorId}
        `;
      }
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
        // GLO-5: owner's email, so "Invite owner" + claim-by-email can work.
        ownerEmail: z.string().email().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { ownerEmail, ...signup } = input;
      // ownerUserId null = unclaimed; the spa claims it later via Stripe.
      const vendor = await createVendor(ctx.sql, { ownerUserId: null, ...signup });
      // Founder-created vendors are live immediately and bypass gates.
      await ctx.sql`
        UPDATE public.vendors
        SET status = 'active', admin_bypass = true, email = ${ownerEmail?.toLowerCase() ?? null}
        WHERE id = ${vendor.id}
      `;
      return vendor;
    }),

  /** Post a deal for a vendor (live immediately). Reuses the deal create path. */
  postDealOnBehalf: adminProcedure
    .input(
      z.object({
        vendorId: z.string().uuid(),
        categoryIds: z
          .array(z.string().uuid())
          .min(1, 'Pick a category.')
          .max(2, 'You can select up to 2 categories per listing.')
          .refine((ids) => new Set(ids).size === ids.length, 'Categories must be distinct.'),
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
        // Null/omitted = use the platform-wide voucher_validity_days setting (GLO-29).
        codeValidityDays: z.number().int().min(1).max(365).nullable().optional(),
        photoUrls: z.array(z.string().url()).max(8).default([]),
        videos: z
          .array(
            z.object({
              videoUrl: z.string().url(),
              thumbnailUrl: z.string().url(),
              caption: z.string().max(200).nullable().optional(),
              durationSeconds: z.number().int().positive().nullable().optional(),
            }),
          )
          .max(5)
          .default([]),
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
      // Zod min(1) guarantees the primary is present; assert for TS under noUncheckedIndexedAccess.
      const [primaryCategoryId, secondaryCategoryId] = input.categoryIds as [string, string?];
      const created = await createDeal(ctx.sql, {
        vendorId: input.vendorId,
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
        expiresAt: input.expiresAt,
        perCustomerLimit: input.perCustomerLimit,
        codeValidityDays: input.codeValidityDays ?? null,
        photoUrls: input.photoUrls,
        videos: input.videos,
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
