-- Adds município and UF to the Company so they can be stored and searched
-- in the expectation-matrix filter. Idempotent on PostgreSQL.
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "municipio" TEXT,
  ADD COLUMN IF NOT EXISTS "uf" TEXT;
