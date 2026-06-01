-- Fuzzy search infrastructure (pg_trgm). Powers typo-tolerant search:
-- "botx" ~ "botox", "filer" ~ "filler", "microneedeling" ~ "microneedling".
-- GIN trigram indexes accelerate both similarity (%) and word_similarity (<%)
-- over the four text fields search ranks against.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_deals_title_trgm
  ON public.deals USING gin (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendors_business_name_trgm
  ON public.vendors USING gin (lower(business_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_service_categories_display_trgm
  ON public.service_categories USING gin (lower(display_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_service_subtypes_display_trgm
  ON public.service_subtypes USING gin (lower(display_name) gin_trgm_ops);
