import type { Context as HonoContext } from 'hono';

import { sql, type Sql } from '../db/client';
import { verifyAndResolveUser, type AuthInfo } from './auth';

export interface RequestContext {
  sql: Sql;
  auth: AuthInfo | null;
}

/**
 * Builds the tRPC context per request. Reads the Authorization header,
 * verifies it with Clerk, and resolves the internal user id. A pending
 * referral code rides along in `x-gloe-referral-code` (GLO-24) — it only
 * matters on the request that JIT-creates the user; ignored otherwise.
 */
export async function createContext({ c }: { c: HonoContext }): Promise<RequestContext> {
  const authHeader = c.req.header('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  const auth = await verifyAndResolveUser(token, {
    referralCode: c.req.header('x-gloe-referral-code') ?? null,
  });
  return { sql, auth };
}
