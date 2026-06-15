/**
 * Importa as empresas da planilha "Matriz de Expectativas" (aba EMPRESAS).
 *
 * - Tabela Company: campos próprios do model (via Prisma client), upsert pelo CNPJ.
 * - Tabela CompanyExpectationMatrix: campos da matriz (via SQL bruto, pois essa
 *   tabela não é um model Prisma e é acessada por raw SQL nas rotas). É feita uma
 *   verificação prévia: se a tabela não existir, a parte da matriz é ignorada e a
 *   importação de Company continua normalmente.
 *
 * NÃO importa os responsáveis por setor (nomes de pessoas) — esses ficam em
 * CompanySectorResponsible e exigiriam casar nome -> usuário/setor.
 *
 * Uso:
 *   node prisma/importCompaniesFromXlsx.js "C:\\caminho\\planilha.xlsx"
 *   node prisma/importCompaniesFromXlsx.js "...planilha.xlsx" --dry
 */
import { randomUUID } from "crypto";
import xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_FILE =
  "C:\\Users\\Developer\\Downloads\\Matriz de Expectativas – Clientes Escrilex.xlsx";
const SHEET_NAME = "EMPRESAS";

// Índice (0-based) das colunas da aba EMPRESAS.
const COL = {
  // -> Company
  cod: 0, // CÓDIGO
  razaoSocial: 1, // EMPRESAS
  cnpj: 2, // CNPJ
  grupo: 3, // GRUPO
  filial: 4, // MATRIZ/FILIAL
  tributacao: 5, // TRIBUTAÇÃO
  ramo: 7, // RAMO
  perfil: 8, // PERFIL COMERCIAL
  consultoria: 10, // CONSULTORIA
  situacao: 24, // SITUAÇÃO
  dataEntrada: 25, // ENTRADA

  // -> CompanyExpectationMatrix
  observacoes: 6, // OBSERVAÇÕES
  reunioesFechamentos: 9, // REUNIÕES FECHAMENTOS
  fechamentoContabil: 11, // FECHAMENTO CONTÁBIL
  analiseCompliance: 12, // ANÁLISE COMPLIANCE
  cobrancaServExtras: 13, // COBRANÇA SERV. EXTRAS
  complexidadeFiscal: 22, // COMPLEXIDADE FISCAL
  complexidadeContabil: 23, // COMPLEXIDADE CONTÁBIL
  dataSaida: 26, // SAÍDA
};

const INACTIVE_STATUS = ["BAIXADA", "ENCERRADO", "ENCERRADA", "INATIVA", "INATIVO"];

function cell(row, idx) {
  const v = row[idx];
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

// Converte serial do Excel / Date / string em Date (ou null).
function toDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s || /não se aplica/i.test(s)) return null;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Colunas da matriz que serão preenchidas (ordem usada nos parâmetros SQL).
const MATRIX_COLS = [
  "observacoes",
  "reunioesFechamentos",
  "fechamentoContabil",
  "analiseCompliance",
  "cobrancaServExtras",
  "complexidadeFiscal",
  "complexidadeContabil",
  "dataSaida",
];

async function matrixTableExists() {
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM "CompanyExpectationMatrix" LIMIT 1');
    return true;
  } catch {
    return false;
  }
}

async function upsertMatrix(companyId, matrix, actorId) {
  const values = MATRIX_COLS.map((c) => matrix[c] ?? null);

  const existing = await prisma.$queryRawUnsafe(
    'SELECT "id" FROM "CompanyExpectationMatrix" WHERE "companyId" = $1 LIMIT 1',
    companyId,
  );

  if (existing.length) {
    // $1..$8 = colunas da matriz | $9 = companyId | $10 = actorId
    const setSql = MATRIX_COLS.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
    await prisma.$executeRawUnsafe(
      `UPDATE "CompanyExpectationMatrix"
         SET ${setSql},
             "updatedAt" = CURRENT_TIMESTAMP,
             "updatedByUserId" = COALESCE($${MATRIX_COLS.length + 2}, "updatedByUserId")
       WHERE "companyId" = $${MATRIX_COLS.length + 1}`,
      ...values,
      companyId,
      actorId,
    );
    return "updated";
  }

  // INSERT: id, companyId, colunas..., updatedByUserId, createdAt/updatedAt
  const colNames = ['"id"', '"companyId"', ...MATRIX_COLS.map((c) => `"${c}"`), '"updatedByUserId"'];
  const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ");
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CompanyExpectationMatrix" (${colNames.join(", ")}, "createdAt", "updatedAt")
     VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    randomUUID(),
    companyId,
    ...values,
    actorId,
  );
  return "created";
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const file = args.find((a) => !a.startsWith("--")) || DEFAULT_FILE;

  console.log(`[import] Lendo: ${file}`);
  console.log(`[import] Aba: ${SHEET_NAME}${dry ? "  (DRY-RUN)" : ""}`);

  const wb = xlsx.readFile(file, { cellDates: true });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Aba "${SHEET_NAME}" não encontrada. Abas: ${wb.SheetNames.join(", ")}`);

  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false, defval: null });

  const matrixAvailable = await matrixTableExists();
  if (!matrixAvailable) {
    console.warn('[import] AVISO: tabela "CompanyExpectationMatrix" não encontrada — campos da matriz serão ignorados.');
  }

  // Ator usado em updatedByUserId (primeiro usuário disponível). Pode ser null.
  const actor = matrixAvailable ? await prisma.user.findFirst({ select: { id: true } }) : null;
  const actorId = actor?.id ?? null;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let matrixCreated = 0;
  let matrixUpdated = 0;
  const skippedRows = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const cnpjDigits = onlyDigits(row[COL.cnpj]);
    const razaoSocial = cell(row, COL.razaoSocial);

    if (!cnpjDigits) {
      if (razaoSocial) {
        skipped++;
        skippedRows.push(`linha ${i + 1}: "${razaoSocial}" sem CNPJ/CPF`);
      }
      continue;
    }

    const situacao = cell(row, COL.situacao);
    const active = situacao ? !INACTIVE_STATUS.includes(situacao.toUpperCase()) : true;

    const companyData = {
      cod: cell(row, COL.cod),
      razaoSocial,
      grupo: cell(row, COL.grupo),
      filial: cell(row, COL.filial),
      tributacao: cell(row, COL.tributacao),
      ramo: cell(row, COL.ramo),
      perfil: cell(row, COL.perfil),
      consultoria: cell(row, COL.consultoria),
      situacao,
      dataEntrada: toDate(row[COL.dataEntrada]),
      active,
    };

    const matrixData = {
      observacoes: cell(row, COL.observacoes),
      reunioesFechamentos: cell(row, COL.reunioesFechamentos),
      fechamentoContabil: cell(row, COL.fechamentoContabil),
      analiseCompliance: cell(row, COL.analiseCompliance),
      cobrancaServExtras: cell(row, COL.cobrancaServExtras),
      complexidadeFiscal: cell(row, COL.complexidadeFiscal),
      complexidadeContabil: cell(row, COL.complexidadeContabil),
      dataSaida: toDate(row[COL.dataSaida]),
    };

    if (dry) {
      console.log(`[dry] ${cnpjDigits}  ${razaoSocial}`);
      continue;
    }

    const result = await prisma.company.upsert({
      where: { cnpj: cnpjDigits },
      update: companyData,
      create: { cnpj: cnpjDigits, ...companyData },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;

    if (matrixAvailable) {
      const action = await upsertMatrix(result.id, matrixData, actorId);
      if (action === "created") matrixCreated++;
      else matrixUpdated++;
    }
  }

  console.log("\n[import] Resumo");
  console.log(`  Company  criadas: ${created}  atualizadas: ${updated}  ignoradas: ${skipped}`);
  if (matrixAvailable) {
    console.log(`  Matriz   criadas: ${matrixCreated}  atualizadas: ${matrixUpdated}`);
  }
  if (skippedRows.length) {
    console.log("\n[import] Linhas ignoradas (sem CNPJ/CPF):");
    for (const s of skippedRows) console.log(`  - ${s}`);
  }
}

main()
  .catch((err) => {
    console.error("[import] ERRO:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
