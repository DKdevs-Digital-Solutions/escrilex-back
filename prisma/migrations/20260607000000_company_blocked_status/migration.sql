-- AlterTable: add blocked status tracking fields to Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "bloqueadoAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "bloqueadoPor" TEXT;
