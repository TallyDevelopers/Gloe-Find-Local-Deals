import { createSign, KeyObject, createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connect, type ClientHttp2Session } from 'node:http2';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deleteDeviceToken } from './devices';
import type { Sql } from '../db/client';

/**
 * Apple Push Notifications service (APNs) sender.
 *
 * Uses Apple's HTTP/2 + JWT (ES256) auth scheme. No external dependencies —
 * just Node's built-in http2 + crypto. The signing key (.p8 file) lives in
 * apps/api/secrets/ (gitignored) and the env points us at it.
 *
 * Topic: pass.com.gloe.voucher is the Pass Type ID — for in-app push
 * notifications use the APP bundle id (com.gloe.app).
 *
 * Spec: https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns
 */

interface ApnsConfig {
  keyId: string;        // 10-char Apple Key ID
  teamId: string;       // 10-char Apple Team ID
  bundleId: string;     // App bundle identifier (= APNs "topic" for app pushes)
  privateKey: KeyObject;
  endpoint: string;     // api.push.apple.com (prod) or api.sandbox.push.apple.com (dev)
}

let cachedConfig: ApnsConfig | null = null;
let cachedSession: ClientHttp2Session | null = null;

/** Where the JWT token is cached. Apple requires re-signing every 20-60 min. */
let cachedJwt: { token: string; issuedAt: number } | null = null;
const JWT_REFRESH_MS = 30 * 60 * 1000; // 30 min

const SECRETS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'secrets');

function getConfig(): ApnsConfig | null {
  if (cachedConfig) return cachedConfig;
  const keyId = process.env.APPLE_APNS_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const bundleId = process.env.APPLE_BUNDLE_ID ?? 'com.gloe.app';
  const keyFilename = process.env.APPLE_APNS_KEY_FILENAME;
  // Dev (sandbox-built apps) vs prod (App Store builds) target DIFFERENT
  // APNs endpoints — using the wrong one silently drops the push. We default
  // to sandbox in NODE_ENV=development and prod otherwise.
  const endpoint =
    process.env.APPLE_APNS_ENDPOINT ??
    (process.env.NODE_ENV === 'production'
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com');

  if (!keyId || !teamId || !keyFilename) {
    // Not configured yet — caller will skip sending. This is the expected
    // state until the user uploads their .p8 key.
    return null;
  }

  const keyPath = join(SECRETS_DIR, keyFilename);
  const pem = readFileSync(keyPath, 'utf8');
  const privateKey = createPrivateKey({ key: pem, format: 'pem' });

  cachedConfig = { keyId, teamId, bundleId, privateKey, endpoint };
  return cachedConfig;
}

/**
 * Generate the JWT Apple wants in the `authorization` header.
 * ES256 over the canonical header + payload.
 */
function getJwt(config: ApnsConfig): string {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.issuedAt < JWT_REFRESH_MS) return cachedJwt.token;

  const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId, typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) }),
  );
  const signingInput = `${header}.${payload}`;

  const signer = createSign('SHA256');
  signer.update(signingInput);
  // Apple wants raw r||s concatenation, NOT the default DER encoding that
  // `sign()` returns. Node 16+ accepts { dsaEncoding: 'ieee-p1363' }.
  const sigBuf = signer.sign({ key: config.privateKey, dsaEncoding: 'ieee-p1363' });
  const signature = sigBuf.toString('base64url');

  const token = `${signingInput}.${signature}`;
  cachedJwt = { token, issuedAt: now };
  return token;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/** Get (and lazily open) the persistent HTTP/2 session to APNs. */
function getSession(config: ApnsConfig): ClientHttp2Session {
  if (cachedSession && !cachedSession.closed && !cachedSession.destroyed) {
    return cachedSession;
  }
  const session = connect(`https://${config.endpoint}`);
  session.on('error', (err) => {
    if (__DEV()) console.error('APNs HTTP/2 session error:', err.message);
  });
  session.on('close', () => {
    cachedSession = null;
  });
  cachedSession = session;
  return session;
}

function __DEV(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export interface PushPayload {
  title: string;
  body: string;
  /** Optional structured data — the app reads this from the notification's userInfo. */
  data?: Record<string, string>;
  /** iOS-specific: thread-id groups notifications visually (e.g. "bookings"). */
  threadId?: string;
  /** Custom notification sound; omit for default. */
  sound?: 'default' | string;
}

/**
 * Send a single push. Returns true on success; logs + returns false on any
 * error (we never throw — pushes are best-effort, never block the user path).
 * If APNs reports the token is dead (HTTP 410 BadDeviceToken / Unregistered),
 * we delete it from the device_tokens table so we don't keep retrying.
 */
export async function sendApnsPush(
  sql: Sql,
  deviceToken: string,
  payload: PushPayload,
): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    if (__DEV()) console.warn('APNs not configured (missing env or .p8). Skipping push.');
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let session: ClientHttp2Session;
    try {
      session = getSession(config);
    } catch (e) {
      console.error('Failed to open APNs session:', (e as Error).message);
      resolve(false);
      return;
    }

    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: payload.sound ?? 'default',
        ...(payload.threadId ? { 'thread-id': payload.threadId } : {}),
      },
      ...(payload.data ?? {}),
    });

    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${getJwt(config)}`,
      'apns-topic': config.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    });

    let status = 0;
    let responseBody = '';
    req.on('response', (headers) => {
      status = Number(headers[':status']) || 0;
    });
    req.on('data', (chunk) => {
      responseBody += chunk.toString();
    });
    req.on('end', () => {
      if (status >= 200 && status < 300) {
        resolve(true);
        return;
      }
      // 410 Gone OR 400 BadDeviceToken / Unregistered → token is dead, prune it.
      const reason = (() => {
        try {
          return JSON.parse(responseBody).reason as string | undefined;
        } catch {
          return undefined;
        }
      })();
      if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
        deleteDeviceToken(sql, deviceToken).catch(() => {});
        if (__DEV()) console.log(`APNs pruned dead token (${reason ?? status})`);
      } else {
        console.error(`APNs send failed: status=${status} reason=${reason ?? '?'}`);
      }
      resolve(false);
    });
    req.on('error', (err) => {
      console.error('APNs request error:', err.message);
      resolve(false);
    });
    req.end(body);
  });
}

/** Convenience: fan out a single payload to every token a user has. */
export async function sendApnsPushToUser(
  sql: Sql,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  const { listIosTokensForUser } = await import('./devices');
  const tokens = await listIosTokensForUser(sql, userId);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    tokens.map(async (t) => {
      const ok = await sendApnsPush(sql, t, payload);
      if (ok) sent++;
      else failed++;
    }),
  );
  return { sent, failed };
}
