-- Trigram similarity, used to fuzzy-match vendor names extracted from receipts
-- against existing entities. Without it the same power company accumulates a
-- new Entity row per spelling variation seen on a bill.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for similarity() lookups during extraction review.
CREATE INDEX IF NOT EXISTS entities_name_trgm_idx
  ON "entities" USING gin ("name" gin_trgm_ops);
