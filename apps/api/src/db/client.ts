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
  max: 10,
  // Keep connections warm for 5 min so a paused tap doesn't re-pay the ~1s
  // TCP+TLS+auth handshake to the DB (measured cold-start tax). Recycle after
  // 30 min for hygiene. Harmless in co-located prod (handshake is cheap there).
  idle_timeout: 300,
  max_lifetime: 60 * 30,
  connect_timeout: 15,
  ssl: 'require',
});

// Warm the pool on boot so the very first real request doesn't eat the cold
// handshake. Fire-and-forget; a failure here just means the first query pays it.
void sql`SELECT 1`.catch(() => {});

export type Sql = typeof sql;
/** The `tx` handle passed to sql.begin(...) callbacks. */
export type TxSql = postgres.TransactionSql<Record<string, never>>;
