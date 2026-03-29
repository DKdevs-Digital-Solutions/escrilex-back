-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "banco" BOOLEAN,
ADD COLUMN     "cod" TEXT,
ADD COLUMN     "consultoria" TEXT,
ADD COLUMN     "dataEntrada" TIMESTAMP(3),
ADD COLUMN     "dataFimCobranca" TIMESTAMP(3),
ADD COLUMN     "dataInicioCobranca" TIMESTAMP(3),
ADD COLUMN     "dataSituacao" TIMESTAMP(3),
ADD COLUMN     "dataTributacao" TIMESTAMP(3),
ADD COLUMN     "filial" TEXT,
ADD COLUMN     "grupo" TEXT,
ADD COLUMN     "ieAtual" TEXT,
ADD COLUMN     "licitacao" BOOLEAN,
ADD COLUMN     "motivoEntrada" TEXT,
ADD COLUMN     "motivoSaidaResumo" TEXT,
ADD COLUMN     "perfil" TEXT,
ADD COLUMN     "qtdeInicialFolha" INTEGER,
ADD COLUMN     "ramo" TEXT,
ADD COLUMN     "responsavelComercial" TEXT,
ADD COLUMN     "situacao" TEXT,
ADD COLUMN     "tributacao" TEXT;

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

-- AddForeignKey
ALTER TABLE "CompanyPartner" ADD CONSTRAINT "CompanyPartner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
