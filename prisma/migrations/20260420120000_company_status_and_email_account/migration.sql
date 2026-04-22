-- Company status fields
ALTER TABLE "Company"
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
