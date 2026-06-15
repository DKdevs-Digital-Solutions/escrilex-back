-- Renomeia o domínio "Checklist" para "Process" em todo o banco.
-- Tabelas, enum, chaves primárias/estrangeiras e índices são renomeados para
-- manter o schema alinhado com os nomes esperados pelo Prisma (@@map).
-- Os nomes de colunas e os valores do enum (ENTRADA/SAIDA) permanecem iguais,
-- portanto nenhum dado é perdido.

-- 1) Enum -------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChecklistType') THEN
    ALTER TYPE "ChecklistType" RENAME TO "ProcessType";
  END IF;
END$$;

-- 2) Tabelas ----------------------------------------------------------------
ALTER TABLE IF EXISTS "ChecklistTemplate"        RENAME TO "ProcessTemplate";
ALTER TABLE IF EXISTS "ChecklistTemplateSection" RENAME TO "ProcessTemplateSection";
ALTER TABLE IF EXISTS "ChecklistTemplateItem"    RENAME TO "ProcessTemplateItem";
ALTER TABLE IF EXISTS "ChecklistRun"             RENAME TO "ProcessRun";
ALTER TABLE IF EXISTS "ChecklistItemRun"         RENAME TO "ProcessItemRun";

-- 3) Chaves primárias e estrangeiras ---------------------------------------
DO $$
BEGIN
  -- Primary keys
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplate_pkey') THEN
    ALTER TABLE "ProcessTemplate" RENAME CONSTRAINT "ChecklistTemplate_pkey" TO "ProcessTemplate_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplateSection_pkey') THEN
    ALTER TABLE "ProcessTemplateSection" RENAME CONSTRAINT "ChecklistTemplateSection_pkey" TO "ProcessTemplateSection_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplateItem_pkey') THEN
    ALTER TABLE "ProcessTemplateItem" RENAME CONSTRAINT "ChecklistTemplateItem_pkey" TO "ProcessTemplateItem_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistRun_pkey') THEN
    ALTER TABLE "ProcessRun" RENAME CONSTRAINT "ChecklistRun_pkey" TO "ProcessRun_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItemRun_pkey') THEN
    ALTER TABLE "ProcessItemRun" RENAME CONSTRAINT "ChecklistItemRun_pkey" TO "ProcessItemRun_pkey";
  END IF;

  -- Foreign keys
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplateSection_templateId_fkey') THEN
    ALTER TABLE "ProcessTemplateSection" RENAME CONSTRAINT "ChecklistTemplateSection_templateId_fkey" TO "ProcessTemplateSection_templateId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplateItem_sectionId_fkey') THEN
    ALTER TABLE "ProcessTemplateItem" RENAME CONSTRAINT "ChecklistTemplateItem_sectionId_fkey" TO "ProcessTemplateItem_sectionId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistTemplateItem_sectorId_fkey') THEN
    ALTER TABLE "ProcessTemplateItem" RENAME CONSTRAINT "ChecklistTemplateItem_sectorId_fkey" TO "ProcessTemplateItem_sectorId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistRun_companyId_fkey') THEN
    ALTER TABLE "ProcessRun" RENAME CONSTRAINT "ChecklistRun_companyId_fkey" TO "ProcessRun_companyId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChecklistItemRun_runId_fkey') THEN
    ALTER TABLE "ProcessItemRun" RENAME CONSTRAINT "ChecklistItemRun_runId_fkey" TO "ProcessItemRun_runId_fkey";
  END IF;
END$$;

-- 4) Índices ----------------------------------------------------------------
ALTER INDEX IF EXISTS "ChecklistItemRun_runId_idx" RENAME TO "ProcessItemRun_runId_idx";
