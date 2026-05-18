-- Permite múltiplos e-mails nos responsáveis internos do cliente.
-- Mantém o campo legado "email" como e-mail principal para compatibilidade com o front atual.
ALTER TABLE "CompanyClientContact"
  ADD COLUMN IF NOT EXISTS "emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "CompanyClientContact"
SET "emails" = ARRAY["email"]
WHERE "email" IS NOT NULL
  AND "email" <> ''
  AND cardinality("emails") = 0;
