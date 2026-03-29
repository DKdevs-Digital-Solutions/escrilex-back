-- Add due rule support to template items
DO $$ BEGIN
  CREATE TYPE "DueRuleType" AS ENUM ('OFFSET_DAYS', 'DAY_OF_NEXT_MONTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ChecklistTemplateItem"
  ADD COLUMN IF NOT EXISTS "dueRuleType" "DueRuleType" NOT NULL DEFAULT 'OFFSET_DAYS',
  ADD COLUMN IF NOT EXISTS "dueRuleParam" INTEGER;

-- Backfill dueRuleParam from legacy offsetDaysFromAnchor when present
UPDATE "ChecklistTemplateItem"
SET "dueRuleParam" = "offsetDaysFromAnchor"
WHERE "dueRuleParam" IS NULL AND "offsetDaysFromAnchor" IS NOT NULL;
