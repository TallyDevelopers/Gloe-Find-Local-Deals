import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createSignedUpload } from '../db/storage';
import {
  addCustomerMessage,
  countUnreadForUser,
  createTicket,
  customerCloseTicket,
  getTicketWithMessages,
  listMyOrders,
  listTicketsForUser,
  markAgentMessagesRead,
} from '../domain/supportTickets';
import { protectedProcedure, router } from './trpc';

/**
 * Wire shape for an already-uploaded support attachment. The client uploads to
 * the `support-attachments` bucket first (via signAttachmentUpload) and then
 * sends back the public URL plus dimensions/poster.
 */
const attachmentInput = z.object({
  kind: z.enum(['image', 'video']),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const supportRouter = router({
  /** The signed-in customer's own tickets, newest activity first. */
  list: protectedProcedure.query(({ ctx }) => listTicketsForUser(ctx.sql, ctx.auth.userId)),

  /** One ticket plus its full message thread. IDOR-guarded in the domain fn. */
  getCase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getTicketWithMessages(ctx.sql, ctx.auth.userId, input.id);
      } catch (e) {
        // A genuine ownership/existence miss is NOT_FOUND. Anything else (e.g. a
        // SQL error) is a real failure we surface as 500 — never mask a bug as
        // "not found" (that's how the attachments uuid[] cast bug stayed hidden).
        if ((e as Error)?.message === 'NOT_FOUND') throw new TRPCError({ code: 'NOT_FOUND' });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      }
    }),

  /**
   * Sign a one-shot upload URL for a support attachment. Mirrors
   * reviews.signPhotoUpload but targets the `support-attachments` bucket.
   */
  signAttachmentUpload: protectedProcedure
    // `kind` is the media kind ('image'|'video') the client tracks per asset; the
    // bucket is always 'support-attachments', so it's accepted but not forwarded
    // (the file extension already disambiguates image vs video on disk).
    .input(z.object({ fileExt: z.string().max(8), kind: z.enum(['image', 'video']).optional() }))
    .mutation(({ ctx, input }) =>
      createSignedUpload(ctx.auth.userId, input.fileExt, 'support'),
    ),

  /** The signed-in customer's own orders (vouchers), for the "which order?" picker.
   * Recency-capped + searchable by deal/vendor name. */
  myOrders: protectedProcedure
    .input(z.object({ search: z.string().max(80).optional() }).optional())
    .query(({ ctx, input }) => listMyOrders(ctx.sql, ctx.auth.userId, input?.search)),

  /** Open a new support case. */
  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(140),
        category: z
          .enum(['refund', 'voucher', 'payment', 'account', 'vendor', 'other'])
          .optional(),
        body: z.string().min(1).max(5000),
        attachments: z.array(attachmentInput).max(10).optional(),
        claimId: z.string().uuid().optional(),
      }),
    )
    .mutation(({ ctx, input }) => createTicket(ctx.sql, ctx.auth.userId, input)),

  /** Add a customer reply to an existing ticket (reopens if resolved/closed). */
  reply: protectedProcedure
    .input(
      z
        .object({
          ticketId: z.string().uuid(),
          body: z.string().max(5000),
          attachments: z.array(attachmentInput).max(10).optional(),
        })
        // A reply needs either text or at least one attachment.
        .refine((v) => v.body.trim().length > 0 || (v.attachments?.length ?? 0) > 0, {
          message: 'Message must have text or an attachment.',
        }),
    )
    .mutation(({ ctx, input }) =>
      addCustomerMessage(ctx.sql, ctx.auth.userId, input.ticketId, input.body, input.attachments),
    ),

  /** Mark all agent messages on a ticket as read by this customer. */
  markRead: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      markAgentMessagesRead(ctx.sql, ctx.auth.userId, input.ticketId),
    ),

  /** Badge count: unread agent messages across all of the customer's tickets. */
  unreadCount: protectedProcedure.query(({ ctx }) =>
    countUnreadForUser(ctx.sql, ctx.auth.userId),
  ),

  /** Customer closes their own ticket. */
  close: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      customerCloseTicket(ctx.sql, ctx.auth.userId, input.ticketId),
    ),
});
