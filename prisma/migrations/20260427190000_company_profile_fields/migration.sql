-- Company fields used by the company edit form and status endpoints.
-- Safe to run more than once on PostgreSQL because every ADD COLUMN uses IF NOT EXISTS.
ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "inactivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cod" TEXT,
  ADD COLUMN IF NOT EXISTS "filial" TEXT,
  ADD COLUMN IF NOT EXISTS "grupo" TEXT,
  ADD COLUMN IF NOT EXISTS "tributacao" TEXT,
  ADD COLUMN IF NOT EXISTS "ieAtual" TEXT,
  ADD COLUMN IF NOT EXISTS "dataTributacao" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motivoEntrada" TEXT,
  ADD COLUMN IF NOT EXISTS "situacao" TEXT,
  ADD COLUMN IF NOT EXISTS "dataSituacao" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ramo" TEXT,
  ADD COLUMN IF NOT EXISTS "consultoria" TEXT,
  ADD COLUMN IF NOT EXISTS "banco" TEXT,
  ADD COLUMN IF NOT EXISTS "perfil" TEXT,
  ADD COLUMN IF NOT EXISTS "licitacao" TEXT,
  ADD COLUMN IF NOT EXISTS "responsavelComercial" TEXT,
  ADD COLUMN IF NOT EXISTS "dataEntrada" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dataInicioCobranca" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dataFimCobranca" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motivoSaidaResumo" TEXT,
  ADD COLUMN IF NOT EXISTS "qtdeInicialFolha" INTEGER;

-- If an earlier test created banco/licitacao as BOOLEAN, convert them to TEXT
-- so the endpoint can save the form values exactly as strings.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Company'
      AND column_name = 'banco'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE "Company" ALTER COLUMN "banco" TYPE TEXT USING "banco"::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Company'
      AND column_name = 'licitacao'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE "Company" ALTER COLUMN "licitacao" TYPE TEXT USING "licitacao"::text;
  END IF;
END $$;
