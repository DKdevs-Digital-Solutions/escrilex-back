-- Adiciona redes sociais ao cadastro de sócios (CompanyPartner)
ALTER TABLE "CompanyPartner"
  ADD COLUMN IF NOT EXISTS "instagram" TEXT,
  ADD COLUMN IF NOT EXISTS "facebook" TEXT;
