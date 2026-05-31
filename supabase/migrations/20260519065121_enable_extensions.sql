-- PostGIS for distance/proximity queries on vendor locations
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- pgcrypto is already enabled by default in Supabase but ensure
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- pg_trgm for fuzzy text search later (search bar)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;