ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "perfilComercial" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "matrizFilial" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "reunioesFechamentos" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "fechamentoContabil" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "analiseCompliance" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "cobrancaServExtras" BOOLEAN;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "complexidadeFiscal" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "complexidadeContabil" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "informacoesNegociosMarketing" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataSaida" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataEntradaFiscal" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataSaidaFiscal" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataEntradaContabil" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataSaidaContabil" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataEntradaFolha" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataSaidaFolha" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataEntradaConsultoria" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataSaidaConsultoria" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataInicioCobrancaFiscal" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataFimCobrancaFiscal" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataInicioCobrancaContabil" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataFimCobrancaContabil" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataInicioCobrancaFolha" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataFimCobrancaFolha" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataInicioCobrancaConsultoria" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dataFimCobrancaConsultoria" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "motivoSaida" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "prefeituraLogin" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "prefeituraSenha" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sefazLogin" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sefazSenha" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "blockedBy" TEXT;

UPDATE "Company" SET "status" = COALESCE("status", "situacao");
UPDATE "Company" SET "perfilComercial" = COALESCE("perfilComercial", "perfil");

CREATE TABLE IF NOT EXISTS "CompanyClientContact" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "nome" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyClientContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CompanyClientContact_companyId_idx" ON "CompanyClientContact"("companyId");
DO $$ BEGIN
  ALTER TABLE "CompanyClientContact" ADD CONSTRAINT "CompanyClientContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CompanyAccessCredential" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "login" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyAccessCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAccessCredential_companyId_service_key" ON "CompanyAccessCredential"("companyId", "service");
DO $$ BEGIN
  ALTER TABLE "CompanyAccessCredential" ADD CONSTRAINT "CompanyAccessCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
