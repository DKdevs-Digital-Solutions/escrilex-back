-- =====================================================================
-- MIGRATION UNIFICADA - VERSAO SEGURA / IDEMPOTENTE
-- Gerado a partir de: migrations.zip
-- Ordem preservada pelos nomes das pastas de migrations.
-- Observação: este arquivo consolida as migrations em sequência.
-- Ajustado para evitar erros comuns em bancos parcialmente migrados: enums/tabelas/índices/colunas/constraints já existentes.
-- =====================================================================


-- =====================================================================
-- 01. 20260228171648_checklist_v1
-- Arquivo original: 20260228171648_checklist_v1/migration.sql
-- =====================================================================

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'GESTOR_EMPRESA', 'OPERADOR', 'LEITURA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ChecklistType" AS ENUM ('ENTRADA', 'SAIDA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ItemStatus" AS ENUM ('PENDENTE', 'FEITO', 'NA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Sector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanySectorResponsible" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "CompanySectorResponsible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanySectorResponsibleHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "CompanySectorResponsibleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistTemplateSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectorId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "offsetDaysFromAnchor" INTEGER,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "anchorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChecklistItemRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "observation" TEXT,
    "dueDate" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "doneBy" TEXT,
    "overdueNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "ChecklistItemRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompanySectorResponsible_companyId_sectorId_key" ON "CompanySectorResponsible"("companyId", "sectorId");

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'User_sectorId_fkey'
         AND conrelid = to_regclass('public."User"')
     ) THEN
    ALTER TABLE IF EXISTS "User" ADD CONSTRAINT "User_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."UserRole"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'UserRole_userId_fkey'
         AND conrelid = to_regclass('public."UserRole"')
     ) THEN
    ALTER TABLE IF EXISTS "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."UserRole"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'UserRole_roleId_fkey'
         AND conrelid = to_regclass('public."UserRole"')
     ) THEN
    ALTER TABLE IF EXISTS "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanySectorResponsible"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanySectorResponsible_companyId_fkey'
         AND conrelid = to_regclass('public."CompanySectorResponsible"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanySectorResponsible" ADD CONSTRAINT "CompanySectorResponsible_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanySectorResponsible"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanySectorResponsible_sectorId_fkey'
         AND conrelid = to_regclass('public."CompanySectorResponsible"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanySectorResponsible" ADD CONSTRAINT "CompanySectorResponsible_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanySectorResponsible"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanySectorResponsible_userId_fkey'
         AND conrelid = to_regclass('public."CompanySectorResponsible"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanySectorResponsible" ADD CONSTRAINT "CompanySectorResponsible_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanySectorResponsibleHistory"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanySectorResponsibleHistory_companyId_fkey'
         AND conrelid = to_regclass('public."CompanySectorResponsibleHistory"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanySectorResponsibleHistory" ADD CONSTRAINT "CompanySectorResponsibleHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanySectorResponsibleHistory"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanySectorResponsibleHistory_sectorId_fkey'
         AND conrelid = to_regclass('public."CompanySectorResponsibleHistory"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanySectorResponsibleHistory" ADD CONSTRAINT "CompanySectorResponsibleHistory_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanySectorResponsibleHistory"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanySectorResponsibleHistory_userId_fkey'
         AND conrelid = to_regclass('public."CompanySectorResponsibleHistory"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanySectorResponsibleHistory" ADD CONSTRAINT "CompanySectorResponsibleHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistTemplateSection"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistTemplateSection_templateId_fkey'
         AND conrelid = to_regclass('public."ChecklistTemplateSection"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistTemplateSection" ADD CONSTRAINT "ChecklistTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistTemplateItem"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistTemplateItem_sectorId_fkey'
         AND conrelid = to_regclass('public."ChecklistTemplateItem"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistTemplateItem"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistTemplateItem_sectionId_fkey'
         AND conrelid = to_regclass('public."ChecklistTemplateItem"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistTemplateSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistRun"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistRun_companyId_fkey'
         AND conrelid = to_regclass('public."ChecklistRun"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistRun" ADD CONSTRAINT "ChecklistRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistRun"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistRun_templateId_fkey'
         AND conrelid = to_regclass('public."ChecklistRun"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistRun" ADD CONSTRAINT "ChecklistRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistItemRun"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistItemRun_runId_fkey'
         AND conrelid = to_regclass('public."ChecklistItemRun"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistItemRun" ADD CONSTRAINT "ChecklistItemRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistItemRun"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistItemRun_templateItemId_fkey'
         AND conrelid = to_regclass('public."ChecklistItemRun"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistItemRun" ADD CONSTRAINT "ChecklistItemRun_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."AuditLog"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'AuditLog_actorUserId_fkey'
         AND conrelid = to_regclass('public."AuditLog"')
     ) THEN
    ALTER TABLE IF EXISTS "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


-- =====================================================================
-- 02. 20260228210000_due_rule
-- Arquivo original: 20260228210000_due_rule/migration.sql
-- =====================================================================

-- Add due rule support to template items
DO $$ BEGIN
  CREATE TYPE "DueRuleType" AS ENUM ('OFFSET_DAYS', 'DAY_OF_NEXT_MONTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE IF EXISTS "ChecklistTemplateItem"
  ADD COLUMN IF NOT EXISTS "dueRuleType" "DueRuleType" NOT NULL DEFAULT 'OFFSET_DAYS',
  ADD COLUMN IF NOT EXISTS "dueRuleParam" INTEGER;

-- Backfill dueRuleParam from legacy offsetDaysFromAnchor when present
UPDATE "ChecklistTemplateItem"
SET "dueRuleParam" = "offsetDaysFromAnchor"
WHERE "dueRuleParam" IS NULL AND "offsetDaysFromAnchor" IS NOT NULL;


-- =====================================================================
-- 03. 20260228215511_
-- Arquivo original: 20260228215511_/migration.sql
-- =====================================================================

-- AlterTable
ALTER TABLE IF EXISTS "Company" ADD COLUMN IF NOT EXISTS "banco" BOOLEAN,
ADD COLUMN IF NOT EXISTS "cod" TEXT,
ADD COLUMN IF NOT EXISTS "consultoria" TEXT,
ADD COLUMN IF NOT EXISTS "dataEntrada" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dataFimCobranca" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dataInicioCobranca" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dataSituacao" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dataTributacao" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "filial" TEXT,
ADD COLUMN IF NOT EXISTS "grupo" TEXT,
ADD COLUMN IF NOT EXISTS "ieAtual" TEXT,
ADD COLUMN IF NOT EXISTS "licitacao" BOOLEAN,
ADD COLUMN IF NOT EXISTS "motivoEntrada" TEXT,
ADD COLUMN IF NOT EXISTS "motivoSaidaResumo" TEXT,
ADD COLUMN IF NOT EXISTS "perfil" TEXT,
ADD COLUMN IF NOT EXISTS "qtdeInicialFolha" INTEGER,
ADD COLUMN IF NOT EXISTS "ramo" TEXT,
ADD COLUMN IF NOT EXISTS "responsavelComercial" TEXT,
ADD COLUMN IF NOT EXISTS "situacao" TEXT,
ADD COLUMN IF NOT EXISTS "tributacao" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanyPartner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nomeCompleto" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "telefoneEmpresa" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "outros" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CompanyPartner_companyId_idx" ON "CompanyPartner"("companyId");

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanyPartner"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanyPartner_companyId_fkey'
         AND conrelid = to_regclass('public."CompanyPartner"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanyPartner" ADD CONSTRAINT "CompanyPartner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- =====================================================================
-- 04. 20260301170000_snapshot_history
-- Arquivo original: 20260301170000_snapshot_history/migration.sql
-- =====================================================================

-- Make historical checklist runs/items independent from templates by:
-- 1) Dropping FKs from history -> template/templateItem
-- 2) Allowing templateItemId to be nullable (optional reference only)
-- 3) Adding snapshot columns to persist the content used at creation time

-- 1) ChecklistRun: drop FK to ChecklistTemplate and add snapshot metadata
ALTER TABLE IF EXISTS public."ChecklistRun"
  DROP CONSTRAINT IF EXISTS "ChecklistRun_templateId_fkey";

ALTER TABLE IF EXISTS public."ChecklistRun"
  ADD COLUMN IF NOT EXISTS "snapshotTemplateName" text,
  ADD COLUMN IF NOT EXISTS "snapshotTemplateVersion" int4;

-- 2) ChecklistItemRun: drop FK to ChecklistTemplateItem, allow null, add snapshot fields
ALTER TABLE IF EXISTS public."ChecklistItemRun"
  DROP CONSTRAINT IF EXISTS "ChecklistItemRun_templateItemId_fkey";

ALTER TABLE IF EXISTS public."ChecklistItemRun"
  ALTER COLUMN "templateItemId" DROP NOT NULL;

ALTER TABLE IF EXISTS public."ChecklistItemRun"
  ADD COLUMN IF NOT EXISTS "snapshotSectionName" text,
  ADD COLUMN IF NOT EXISTS "snapshotItemCode" text,
  ADD COLUMN IF NOT EXISTS "snapshotItemDescription" text,
  ADD COLUMN IF NOT EXISTS "snapshotItemOrder" int4,
  ADD COLUMN IF NOT EXISTS "snapshotIsRequired" bool,
  ADD COLUMN IF NOT EXISTS "snapshotSectorId" text,
  ADD COLUMN IF NOT EXISTS "snapshotOffsetDaysFromAnchor" int4,
  ADD COLUMN IF NOT EXISTS "snapshotDueRuleType" public."DueRuleType",
  ADD COLUMN IF NOT EXISTS "snapshotDueRuleParam" int4;

-- Optional backfill (uncomment if you want the migration to populate snapshots for existing rows):
-- UPDATE public."ChecklistRun" cr
-- SET
--   "snapshotTemplateName" = ct."name",
--   "snapshotTemplateVersion" = ct."version"
-- FROM public."ChecklistTemplate" ct
-- WHERE ct.id = cr."templateId";
--
-- UPDATE public."ChecklistItemRun" cir
-- SET
--   "snapshotItemCode" = cti.code,
--   "snapshotItemDescription" = cti.description,
--   "snapshotItemOrder" = cti."order",
--   "snapshotIsRequired" = cti."isRequired",
--   "snapshotSectorId" = cti."sectorId",
--   "snapshotOffsetDaysFromAnchor" = cti."offsetDaysFromAnchor",
--   "snapshotDueRuleType" = cti."dueRuleType",
--   "snapshotDueRuleParam" = cti."dueRuleParam",
--   "snapshotSectionName" = cts."name"
-- FROM public."ChecklistTemplateItem" cti
-- JOIN public."ChecklistTemplateSection" cts ON cts.id = cti."sectionId"
-- WHERE cti.id = cir."templateItemId";


-- =====================================================================
-- 05. 20260301172201_novo
-- Arquivo original: 20260301172201_novo/migration.sql
-- =====================================================================

/*
  Warnings:

  - You are about to drop the column `banco` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `cod` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `consultoria` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `dataEntrada` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `dataFimCobranca` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `dataInicioCobranca` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `dataSituacao` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `dataTributacao` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `filial` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `grupo` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `ieAtual` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `licitacao` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `motivoEntrada` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `motivoSaidaResumo` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `perfil` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `qtdeInicialFolha` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `ramo` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `responsavelComercial` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `situacao` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `tributacao` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the `CompanyPartner` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE IF EXISTS "CompanyPartner" DROP CONSTRAINT IF EXISTS "CompanyPartner_companyId_fkey";

-- AlterTable
ALTER TABLE IF EXISTS "Company" DROP COLUMN IF EXISTS "banco",
DROP COLUMN IF EXISTS "cod",
DROP COLUMN IF EXISTS "consultoria",
DROP COLUMN IF EXISTS "dataEntrada",
DROP COLUMN IF EXISTS "dataFimCobranca",
DROP COLUMN IF EXISTS "dataInicioCobranca",
DROP COLUMN IF EXISTS "dataSituacao",
DROP COLUMN IF EXISTS "dataTributacao",
DROP COLUMN IF EXISTS "filial",
DROP COLUMN IF EXISTS "grupo",
DROP COLUMN IF EXISTS "ieAtual",
DROP COLUMN IF EXISTS "licitacao",
DROP COLUMN IF EXISTS "motivoEntrada",
DROP COLUMN IF EXISTS "motivoSaidaResumo",
DROP COLUMN IF EXISTS "perfil",
DROP COLUMN IF EXISTS "qtdeInicialFolha",
DROP COLUMN IF EXISTS "ramo",
DROP COLUMN IF EXISTS "responsavelComercial",
DROP COLUMN IF EXISTS "situacao",
DROP COLUMN IF EXISTS "tributacao";

-- DropTable
DROP TABLE IF EXISTS "CompanyPartner";


-- =====================================================================
-- 06. 20260301190000_itemstatus_concluido
-- Arquivo original: 20260301190000_itemstatus_concluido/migration.sql
-- =====================================================================

-- Add EM_ANDAMENTO and switch FEITO -> CONCLUIDO in ItemStatus
-- This keeps history compatible while using the new label in the app.

DO $$
BEGIN
  -- Ensure enum type exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ItemStatus'
  ) THEN
    RAISE NOTICE 'Enum type public."ItemStatus" not found, skipping.';
    RETURN;
  END IF;

  -- 1) Add EM_ANDAMENTO if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ItemStatus' AND e.enumlabel = 'EM_ANDAMENTO'
  ) THEN
    BEGIN
      ALTER TYPE public."ItemStatus" ADD VALUE 'EM_ANDAMENTO' AFTER 'PENDENTE';
    EXCEPTION
      WHEN duplicate_object THEN
        -- value already exists (race)
        NULL;
    END;
  END IF;

  -- 2) Make sure we end with CONCLUIDO (rename FEITO when possible)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ItemStatus' AND e.enumlabel = 'CONCLUIDO'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'ItemStatus' AND e.enumlabel = 'FEITO'
    ) THEN
      BEGIN
        ALTER TYPE public."ItemStatus" RENAME VALUE 'FEITO' TO 'CONCLUIDO';
      EXCEPTION
        WHEN invalid_parameter_value THEN
          -- older postgres versions or unexpected state
          NULL;
      END;
    ELSE
      BEGIN
        ALTER TYPE public."ItemStatus" ADD VALUE 'CONCLUIDO' BEFORE 'NA';
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END IF;
  END IF;
END $$;


-- =====================================================================
-- 07. 20260301215112_teste
-- Arquivo original: 20260301215112_teste/migration.sql
-- =====================================================================

-- DropForeignKey
ALTER TABLE IF EXISTS "ChecklistItemRun" DROP CONSTRAINT IF EXISTS "ChecklistItemRun_runId_fkey";

-- AlterTable
ALTER TABLE IF EXISTS "ChecklistRun" ALTER COLUMN "templateId" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanyPartner" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nomeCompleto" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "telefoneEmpresa" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "outros" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CompanyPartner_companyId_idx" ON "CompanyPartner"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChecklistItemRun_runId_idx" ON "ChecklistItemRun"("runId");

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."CompanyPartner"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'CompanyPartner_companyId_fkey'
         AND conrelid = to_regclass('public."CompanyPartner"')
     ) THEN
    ALTER TABLE IF EXISTS "CompanyPartner" ADD CONSTRAINT "CompanyPartner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('public."ChecklistItemRun"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ChecklistItemRun_runId_fkey'
         AND conrelid = to_regclass('public."ChecklistItemRun"')
     ) THEN
    ALTER TABLE IF EXISTS "ChecklistItemRun" ADD CONSTRAINT "ChecklistItemRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;


-- =====================================================================
-- 08. 20260301230000_add_em_andamento_status
-- Arquivo original: 20260301230000_add_em_andamento_status/migration.sql
-- =====================================================================

-- Add new status used by the frontend dropdown
DO $$
BEGIN
  ALTER TYPE public."ItemStatus" ADD VALUE 'EM_ANDAMENTO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================================
-- 09. 20260420120000_company_status_and_email_account
-- Arquivo original: 20260420120000_company_status_and_email_account/migration.sql
-- =====================================================================

-- Company status fields
ALTER TABLE IF EXISTS "Company"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "inactivatedAt" TIMESTAMP(3);

-- Backfill current rows
UPDATE "Company"
SET "active" = true
WHERE "active" IS NULL;

-- Single SMTP account configuration
CREATE TABLE IF NOT EXISTS "EmailAccountConfig" (
  "id" TEXT NOT NULL,
  "singletonKey" TEXT NOT NULL DEFAULT 'main',
  "host" TEXT NOT NULL,
  "port" INTEGER NOT NULL DEFAULT 587,
  "secure" BOOLEAN NOT NULL DEFAULT false,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "fromName" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailAccountConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailAccountConfig_singletonKey_key"
  ON "EmailAccountConfig"("singletonKey");


-- =====================================================================
-- 10. 20260427190000_company_profile_fields
-- Arquivo original: 20260427190000_company_profile_fields/migration.sql
-- =====================================================================

-- Company fields used by the company edit form and status endpoints.
-- Safe to run more than once on PostgreSQL because every ADD COLUMN IF NOT EXISTS uses IF NOT EXISTS.
ALTER TABLE IF EXISTS "Company"
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
    ALTER TABLE IF EXISTS "Company" ALTER COLUMN "banco" TYPE TEXT USING "banco"::text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Company'
      AND column_name = 'licitacao'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE IF EXISTS "Company" ALTER COLUMN "licitacao" TYPE TEXT USING "licitacao"::text;
  END IF;
END $$;


-- =========================================================
-- Seed SQL equivalente ao prisma/seed.ts
-- Admin: admin@local.com / admin123
-- Execute depois das migrations.
-- =========================================================

BEGIN;

-- Roles
INSERT INTO "Role" ("id", "name")
VALUES
  ('seed_role_admin', 'ADMIN'::"RoleName"),
  ('seed_role_gestor_empresa', 'GESTOR_EMPRESA'::"RoleName"),
  ('seed_role_operador', 'OPERADOR'::"RoleName"),
  ('seed_role_leitura', 'LEITURA'::"RoleName")
ON CONFLICT ("name") DO NOTHING;

-- Usuário admin
-- Senha original: admin123
INSERT INTO "User" (
  "id",
  "name",
  "email",
  "passwordHash",
  "active",
  "createdAt",
  "updatedAt"
)
VALUES (
  'seed_user_admin',
  'Admin',
  'admin@local.com',
  '$2b$10$lwYfwMHdbIi.Qpg6vF.0k.MnoyjDdLUsEuiOJyMWTHkVjTOfydxGa',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

-- Vincula ADMIN ao usuário admin, sem duplicar
INSERT INTO "UserRole" ("id", "userId", "roleId")
SELECT
  'seed_user_role_admin',
  u."id",
  r."id"
FROM "User" u
JOIN "Role" r ON r."name" = 'ADMIN'::"RoleName"
WHERE u."email" = 'admin@local.com'
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Setores
INSERT INTO "Sector" ("id", "name", "active", "createdAt", "updatedAt")
VALUES
  ('seed_sector_comercial', 'Comercial', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_sector_societario', 'Societário', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_sector_fiscal', 'Fiscal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_sector_contabil', 'Contábil', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_sector_dp', 'DP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_sector_compliance', 'Compliance', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

COMMIT;
