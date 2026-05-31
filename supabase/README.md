# Supabase migrations

Source of truth for the Gloē database schema. Each file is one migration,
named `<version>_<name>.sql`, applied in version order.

## History note

This Supabase project was reused from a previous app. The Gloē schema begins
at the **`drop_all_legacy_tables`** migration, which runs
`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` — a full reset that depends
on nothing. The ~20 pre-reset migrations (a prior field-service app) and two
"discord_snatcher" migrations (created in the wrong project, then reverted) are
intentionally **not** tracked here: they touch a schema this history wipes or
never affected `public`. Replaying these files on an empty database reproduces
the current Gloē schema exactly.

## Applying

These were applied via the Supabase MCP / dashboard. To replay on a fresh DB,
run them in filename (version) order. If you adopt the Supabase CLI:
`supabase db push` (after `supabase link`).
