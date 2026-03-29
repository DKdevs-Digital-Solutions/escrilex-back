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
ALTER TABLE "CompanyPartner" DROP CONSTRAINT "CompanyPartner_companyId_fkey";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "banco",
DROP COLUMN "cod",
DROP COLUMN "consultoria",
DROP COLUMN "dataEntrada",
DROP COLUMN "dataFimCobranca",
DROP COLUMN "dataInicioCobranca",
DROP COLUMN "dataSituacao",
DROP COLUMN "dataTributacao",
DROP COLUMN "filial",
DROP COLUMN "grupo",
DROP COLUMN "ieAtual",
DROP COLUMN "licitacao",
DROP COLUMN "motivoEntrada",
DROP COLUMN "motivoSaidaResumo",
DROP COLUMN "perfil",
DROP COLUMN "qtdeInicialFolha",
DROP COLUMN "ramo",
DROP COLUMN "responsavelComercial",
DROP COLUMN "situacao",
DROP COLUMN "tributacao";

-- DropTable
DROP TABLE "CompanyPartner";
