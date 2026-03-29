-- Make historical checklist runs/items independent from templates by:
-- 1) Dropping FKs from history -> template/templateItem
-- 2) Allowing templateItemId to be nullable (optional reference only)
-- 3) Adding snapshot columns to persist the content used at creation time

-- 1) ChecklistRun: drop FK to ChecklistTemplate and add snapshot metadata
ALTER TABLE public."ChecklistRun"
  DROP CONSTRAINT IF EXISTS "ChecklistRun_templateId_fkey";

ALTER TABLE public."ChecklistRun"
  ADD COLUMN IF NOT EXISTS "snapshotTemplateName" text,
  ADD COLUMN IF NOT EXISTS "snapshotTemplateVersion" int4;

-- 2) ChecklistItemRun: drop FK to ChecklistTemplateItem, allow null, add snapshot fields
ALTER TABLE public."ChecklistItemRun"
  DROP CONSTRAINT IF EXISTS "ChecklistItemRun_templateItemId_fkey";

ALTER TABLE public."ChecklistItemRun"
  ALTER COLUMN "templateItemId" DROP NOT NULL;

ALTER TABLE public."ChecklistItemRun"
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
