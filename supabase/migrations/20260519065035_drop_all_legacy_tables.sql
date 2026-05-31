-- Wipe the entire public schema and recreate it clean.
-- All previous tables, functions, triggers, and types are removed.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;