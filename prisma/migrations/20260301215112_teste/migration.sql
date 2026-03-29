-- DropForeignKey
ALTER TABLE "ChecklistItemRun" DROP CONSTRAINT "ChecklistItemRun_runId_fkey";

-- AlterTable
ALTER TABLE "ChecklistRun" ALTER COLUMN "templateId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CompanyPartner" (
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
CREATE INDEX "CompanyPartner_companyId_idx" ON "CompanyPartner"("companyId");

-- CreateIndex
CREATE INDEX "ChecklistItemRun_runId_idx" ON "ChecklistItemRun"("runId");

-- AddForeignKey
ALTER TABLE "CompanyPartner" ADD CONSTRAINT "CompanyPartner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemRun" ADD CONSTRAINT "ChecklistItemRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
