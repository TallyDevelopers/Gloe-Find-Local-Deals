import postgres from 'postgres';

/**
 * Single Postgres connection pool for the API.
 *
 * Supabase pooler usernames contain a dot (postgres.<project-ref>) which the
 * `postgres` library mis-parses out of a URL string — it splits on the dot
 * and sees just "postgres" as the user. So we parse the URL ourselves and
 * pass explicit options.
 *
 * `prepare: false` is required for Supabase's transaction pooler.
 */
function buildConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('Missing DATABASE_URL environment variable');

  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port) || 5432,
    database: url.pathname.replace(/^\//, ''),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

const config = buildConfig();
console.log('[db] connecting as', config.user, '@', config.host);

export const sql = postgres({
  ...config,
  prepare: false,
  // The Discover screen fires ~9 deals.list queries at once (one per category
  // rail). Each query is fast (~2ms) but the round-trip to the remote Supabase
  // pooler is the real cost, so connections are held briefly under bursts. A
  // pool of 10 could drain on a single burst and wedge; 20 gives headroom.
  max: 20,
  // Keep connections warm for 5 min so a paused tap doesn't re-pay the ~1s
  // TCP+TLS+auth handshake to the DB (measured cold-start tax). Recycle after
  // 30 min for hygiene. Harmless in co-located prod (handshake is cheap there).
  idle_timeout: 300,
  max_lifetime: 60 * 30,
  connect_timeout: 15,
  ssl: 'require',
  // Safety net: no single query may hold a pooled connection longer than 10s.
  // Without this, a slow/stuck query keeps its connection forever and, under a
  // burst (e.g. the Discover screen firing many deals.list at once), drains the
  // pool and wedges the whole API. statement_timeout makes a runaway query fail
  // fast and release its connection instead of hanging everything.
  connection: { statement_timeout: 10_000 },
});

// Warm MULTIPLE connections on boot. The Discover screen fires ~9 deals.list
// queries at once; against the remote Supabase pooler each *new* connection
// pays a ~4s TLS+auth handshake, so a cold burst opens 9 connections in
// parallel and they contend (~11s each). Pre-opening a batch of warm, idle
// connections means the burst reuses them (~0.4s each) instead of cold-opening.
// `sql.begin` holds N connections concurrently for the warmup so the pool
// actually grows to that size, rather than reusing one.
const WARM_CONNECTIONS = 9;
void Promise.all(
  Array.from({ length: WARM_CONNECTIONS }, () =>
    sql`SELECT pg_sleep(0.05)`.catch(() => {}),
  ),
).catch(() => {});

export type Sql = typeof sql;
/** The `tx` handle passed to sql.begin(...) callbacks. */
export type TxSql = postgres.TransactionSql<Record<string, never>>;
