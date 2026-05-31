import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  addCustomerMessage,
  countUnreadForUser,
  createTicket,
  customerCloseTicket,
  getTicketWithMessages,
  listTicketsForUser,
  markAgentMessagesRead,
} from '../domain/supportTickets';
import { protectedProcedure, router } from './trpc';

export const supportRouter = router({
  /** The signed-in customer's own tickets, newest activity first. */
  list: protectedProcedure.query(({ ctx }) => listTicketsForUser(ctx.sql, ctx.auth.userId)),

  /** One ticket plus its full message thread. IDOR-guarded in the domain fn. */
  getCase: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getTicketWithMessages(ctx.sql, ctx.auth.userId, input.id);
      } catch {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
    }),

  /** Open a new support case. */
  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(140),
        category: z
          .enum(['refund', 'voucher', 'payment', 'account', 'vendor', 'other'])
          .optional(),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(({ ctx, input }) => createTicket(ctx.sql, ctx.auth.userId, input)),

  /** Add a customer reply to an existing ticket (reopens if resolved/closed). */
  reply: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        body: z.string().min(1).max(5000),
      }),
    )
    .mutation(({ ctx, input }) =>
      addCustomerMessage(ctx.sql, ctx.auth.userId, input.ticketId, input.body),
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
