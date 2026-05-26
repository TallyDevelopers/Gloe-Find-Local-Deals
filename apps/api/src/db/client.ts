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
  idle_timeout: 20,
  ssl: 'require',
});

export type Sql = typeof sql;
/** The `tx` handle passed to sql.begin(...) callbacks. */
export type TxSql = postgres.TransactionSql<Record<string, never>>;
