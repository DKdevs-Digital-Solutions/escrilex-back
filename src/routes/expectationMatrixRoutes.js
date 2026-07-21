import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";
import { sendTeamsNotification } from "../teams.js";

export const expectationMatrixRoutes = Router();

const MATRIX_TABLE = '"CompanyExpectationMatrix"';

const STATUS_OPTIONS = [
  "Em Implantação",
  "Pendente de Documentação",
  "Ativo",
  "Sem atividade",
  "Sem Movimento",
  "Baixada",
  "Em Saída",
  "Encerrado",
  "Bloqueado",
  "Doméstica",
];

const MATRIX_OPTIONS = {
  matrizFilial: ["Matriz", "Filial", "Matriz-Filial", "Pessoa Física"],
  tributacao: ["Simples Nacional", "Lucro Presumido", "Lucro Real Trimestral", "Lucro Real Anual (Estimativa Mensal)"],
  ramo: ["Serviço", "Comércio", "Indústria", "Serviço + Comércio", "Serviço + Indústria", "Comércio + Indústria", "Serviço + Comércio + Indústria"],
  perfilComercial: ["Black", "Blue", "Light"],
  reunioesFechamentos: ["Mensal", "Trimestral", "Semestral", "Sob demanda", "Não se aplica"],
  consultoria: ["24 horas", "48 horas", "Sob demanda", "Não se aplica"],
  fechamentoContabil: ["Mensal", "Trimestral", "Anual", "Não se aplica"],
  analiseCompliance: ["Mensal", "Trimestral", "Semestral", "Anual", "Não se aplica"],
  cobrancaServExtras: ["Sim", "Não"],
  complexidade: ["Baixa", "Média", "Alta", "Não se aplica"],
  status: STATUS_OPTIONS,
  clientContactAreas: ["Folha", "Fiscal", "Contábil", "Financeiro"],
  uf: [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ],
};

// Colunas estáticas da matriz.
// As colunas de responsável por setor são geradas dinamicamente a partir da tabela Sector.
const STATIC_MATRIX_COLUMNS = [
  { key: "codigo",              label: "CÓDIGO",                  type: "automatic", source: "Company.cod" },
  { key: "empresa",             label: "EMPRESA",                 type: "text",      source: "Company.razaoSocial" },
  { key: "cnpjCpf",            label: "CNPJ/CPF",                type: "text",      source: "Company.cnpj" },
  { key: "grupo",               label: "GRUPO",                   type: "text",      source: "Company.grupo" },
  { key: "municipio",           label: "MUNICÍPIO",               type: "text",      source: "Company.municipio" },
  { key: "uf",                  label: "UF",                      type: "select",    optionsKey: "uf",                  source: "Company.uf" },
  { key: "matrizFilial",        label: "MATRIZ/FILIAL",           type: "select",    optionsKey: "matrizFilial",        source: "Company.filial" },
  { key: "tributacao",          label: "TRIBUTAÇÃO",              type: "select",    optionsKey: "tributacao",          source: "Company.tributacao" },
  { key: "observacoes",         label: "OBSERVAÇÕES",             type: "textarea",  source: "CompanyExpectationMatrix.observacoes" },
  { key: "ramo",                label: "RAMO",                    type: "select",    optionsKey: "ramo",                source: "Company.ramo" },
  { key: "perfilComercial",     label: "PERFIL COMERCIAL",        type: "select",    optionsKey: "perfilComercial",     source: "Company.perfil" },
  { key: "reunioesFechamentos", label: "REUNIÕES FECHAMENTOS",    type: "select",    optionsKey: "reunioesFechamentos" },
  { key: "consultoria",         label: "CONSULTORIA",             type: "select",    optionsKey: "consultoria",         source: "Company.consultoria" },
  { key: "fechamentoContabil",  label: "FECHAMENTO CONTÁBIL",     type: "select",    optionsKey: "fechamentoContabil" },
  { key: "analiseCompliance",   label: "ANÁLISE COMPLIANCE",      type: "select",    optionsKey: "analiseCompliance" },
  { key: "cobrancaServExtras",  label: "COBRANÇA SERV. EXTRAS",   type: "select",    optionsKey: "cobrancaServExtras" },
  // >>> colunas dinâmicas de setor são injetadas aqui no GET /options <<<
  { key: "complexidadeFiscal",  label: "COMPLEXIDADE FISCAL",     type: "select",    optionsKey: "complexidade" },
  { key: "complexidadeContabil",label: "COMPLEXIDADE CONTÁBIL",   type: "select",    optionsKey: "complexidade" },
  { key: "status",              label: "STATUS",                  type: "select",    optionsKey: "status",              source: "Company.situacao" },
  { key: "entrada",             label: "ENTRADA",                 type: "date",      source: "Company.dataEntrada" },
  { key: "saida",               label: "SAÍDA",                   type: "date",      source: "CompanyExpectationMatrix.dataSaida" },
];

// Índice onde as colunas de setor serão inseridas (antes de complexidade)
const SECTOR_COLUMNS_INSERT_INDEX = STATIC_MATRIX_COLUMNS.findIndex((c) => c.key === "complexidadeFiscal");

const nullableString = z.preprocess((value) => (value === "" ? null : value), z.string().nullable().optional());
const nullableDate   = z.preprocess((value) => (value === "" || value === null ? null : value), z.coerce.date().nullable().optional());
const nullableInt    = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return value === undefined ? undefined : null;
  return value;
}, z.coerce.number().int().nullable().optional());
const nullableJson   = z.preprocess((value) => (value === "" ? null : value), z.unknown().nullable().optional());

const matrixSaveSchema = z.object({
  codigo:                       nullableString,
  cod:                          nullableString,
  empresa:                      nullableString,
  razaoSocial:                  nullableString,
  cnpjCpf:                      nullableString,
  cnpj:                         nullableString,
  grupo:                        nullableString,
  municipio:                    nullableString,
  uf:                           nullableString,
  matrizFilial:                 nullableString,
  filial:                       nullableString,
  tributacao:                   nullableString,
  ramo:                         nullableString,
  perfilComercial:              nullableString,
  perfil:                       nullableString,
  consultoria:                  nullableString,
  status:                       nullableString,
  situacao:                     nullableString,
  entrada:                      nullableDate,
  dataEntrada:                  nullableDate,
  ie:                           nullableString,
  ieAtual:                      nullableString,
  motivoEntrada:                nullableString,
  motivoSaida:                  nullableString,
  motivoSaidaResumo:            nullableString,
  observacoes:                  nullableString,
  reunioesFechamentos:          nullableString,
  fechamentoContabil:           nullableString,
  analiseCompliance:            nullableString,
  cobrancaServExtras:           nullableString,
  complexidadeFiscal:           nullableString,
  complexidadeContabil:         nullableString,
  quantidadeFolha:              nullableInt,
  saida:                        nullableDate,
  dataSaida:                    nullableDate,
  dataEntradaFiscal:            nullableDate,
  dataSaidaFiscal:              nullableDate,
  dataEntradaContabil:          nullableDate,
  dataSaidaContabil:            nullableDate,
  dataEntradaFolha:             nullableDate,
  dataSaidaFolha:               nullableDate,
  dataEntradaConsultoria:       nullableDate,
  dataSaidaConsultoria:         nullableDate,
  dataInicioCobrancaFiscal:     nullableDate,
  dataFimCobrancaFiscal:        nullableDate,
  dataInicioCobrancaContabil:   nullableDate,
  dataFimCobrancaContabil:      nullableDate,
  dataInicioCobrancaFolha:      nullableDate,
  dataFimCobrancaFolha:         nullableDate,
  dataInicioCobrancaConsultoria:nullableDate,
  dataFimCobrancaConsultoria:   nullableDate,
  acessos:                      nullableJson,
  // responsaveis: { "Nome do Setor": "userId" | null }
  // null remove a atribuição; userId atribui o responsável ao setor
  responsaveis: z.record(z.string(), z.string().nullable()).optional(),
}).passthrough();

const companyFieldMap = {
  codigo:            "cod",
  cod:               "cod",
  empresa:           "razaoSocial",
  razaoSocial:       "razaoSocial",
  cnpjCpf:           "cnpj",
  cnpj:              "cnpj",
  grupo:             "grupo",
  municipio:         "municipio",
  uf:                "uf",
  matrizFilial:      "filial",
  filial:            "filial",
  tributacao:        "tributacao",
  ramo:              "ramo",
  perfilComercial:   "perfil",
  perfil:            "perfil",
  consultoria:       "consultoria",
  status:            "situacao",
  situacao:          "situacao",
  entrada:           "dataEntrada",
  dataEntrada:       "dataEntrada",
  ie:                "ieAtual",
  ieAtual:           "ieAtual",
  motivoEntrada:     "motivoEntrada",
  motivoSaida:       "motivoSaidaResumo",
  motivoSaidaResumo: "motivoSaidaResumo",
};

// Campos da tabela CompanyExpectationMatrix.
// Os campos de responsável por setor foram removidos — agora vivem em CompanySectorResponsible.
const matrixFieldMap = {
  observacoes:                  "observacoes",
  reunioesFechamentos:          "reunioesFechamentos",
  fechamentoContabil:           "fechamentoContabil",
  analiseCompliance:            "analiseCompliance",
  cobrancaServExtras:           "cobrancaServExtras",
  complexidadeFiscal:           "complexidadeFiscal",
  complexidadeContabil:         "complexidadeContabil",
  quantidadeFolha:              "quantidadeFolha",
  saida:                        "dataSaida",
  dataSaida:                    "dataSaida",
  dataEntradaFiscal:            "dataEntradaFiscal",
  dataSaidaFiscal:              "dataSaidaFiscal",
  dataEntradaContabil:          "dataEntradaContabil",
  dataSaidaContabil:            "dataSaidaContabil",
  dataEntradaFolha:             "dataEntradaFolha",
  dataSaidaFolha:               "dataSaidaFolha",
  dataEntradaConsultoria:       "dataEntradaConsultoria",
  dataSaidaConsultoria:         "dataSaidaConsultoria",
  dataInicioCobrancaFiscal:     "dataInicioCobrancaFiscal",
  dataFimCobrancaFiscal:        "dataFimCobrancaFiscal",
  dataInicioCobrancaContabil:   "dataInicioCobrancaContabil",
  dataFimCobrancaContabil:      "dataFimCobrancaContabil",
  dataInicioCobrancaFolha:      "dataInicioCobrancaFolha",
  dataFimCobrancaFolha:         "dataFimCobrancaFolha",
  dataInicioCobrancaConsultoria:"dataInicioCobrancaConsultoria",
  dataFimCobrancaConsultoria:   "dataFimCobrancaConsultoria",
  acessos:                      "acessos",
};

function isFullAccess(user) {
  const roles = user?.roles || [];
  return roles.some((role) => ["ADMIN", "GESTOR_EMPRESA", "LEITURA"].includes(role));
}

function parseLimitOffset(query) {
  const limit  = Math.min(Math.max(parseInt(String(query.limit  || "100"), 10) || 100, 1), 500);
  const offset = Math.max(parseInt(String(query.offset || "0"),  10) || 0, 0);
  return { limit, offset };
}

function normalizeDocument(value) {
  if (value === null || value === undefined) return value;
  return String(value).trim();
}

function addWhere(clauses, params, sql, value) {
  params.push(value);
  clauses.push(sql.replace("?", `$${params.length}`));
}

function buildListWhere(req) {
  const clauses = ["1=1"];
  const params  = [];

  const search = String(req.query.search || "").trim();
  if (search) {
    params.push(`%${search}%`);
    const i = `$${params.length}`;
    clauses.push(`(
      c."cod" ILIKE ${i}
      OR c."razaoSocial" ILIKE ${i}
      OR c."nomeFantasia" ILIKE ${i}
      OR c."cnpj" ILIKE ${i}
      OR c."grupo" ILIKE ${i}
      OR c."municipio" ILIKE ${i}
      OR c."uf" ILIKE ${i}
    )`);
  }

  const status    = String(req.query.status    || "").trim();
  if (status)    addWhere(clauses, params, `COALESCE(c."situacao", '') = ?`,       status);

  const grupo     = String(req.query.grupo     || "").trim();
  if (grupo)     addWhere(clauses, params, `COALESCE(c."grupo", '') ILIKE ?`,      `%${grupo}%`);

  const municipio = String(req.query.municipio || "").trim();
  if (municipio) addWhere(clauses, params, `COALESCE(c."municipio", '') ILIKE ?`, `%${municipio}%`);

  const uf        = String(req.query.uf        || "").trim();
  if (uf)        addWhere(clauses, params, `COALESCE(c."uf", '') = ?`,            uf);

  const tributacao = String(req.query.tributacao || "").trim();
  if (tributacao) addWhere(clauses, params, `COALESCE(c."tributacao", '') = ?`,    tributacao);

  const ramo      = String(req.query.ramo      || "").trim();
  if (ramo)      addWhere(clauses, params, `COALESCE(c."ramo", '') = ?`,           ramo);

  const perfil    = String(req.query.perfil    || "").trim();
  if (perfil)    addWhere(clauses, params, `COALESCE(c."perfil", '') = ?`,         perfil);

  const onlyActive = String(req.query.active || "").trim().toLowerCase();
  if (["true",  "1", "sim", "yes"].includes(onlyActive)) clauses.push(`c."active" = true`);
  if (["false", "0", "nao", "não", "no"].includes(onlyActive)) clauses.push(`c."active" = false`);

  if (!isFullAccess(req.user)) {
    params.push(req.user.id);
    clauses.push(`EXISTS (SELECT 1 FROM "CompanySectorResponsible" csr_access WHERE csr_access."companyId" = c."id" AND csr_access."userId" = $${params.length})`);
  }

  return { whereSql: clauses.join(" AND "), params };
}

// SQL base — sem colunas fixas de responsável por setor (agora vindas de CompanySectorResponsible)
const matrixSelectSql = `
  SELECT
    c."id"                    AS "companyId",
    c."cod"                   AS "codigo",
    c."razaoSocial"           AS "empresa",
    c."nomeFantasia",
    c."cnpj"                  AS "cnpjCpf",
    c."grupo",
    c."municipio",
    c."uf",
    c."filial"                AS "matrizFilial",
    c."tributacao",
    c."ieAtual"               AS "ie",
    c."ramo",
    c."perfil"                AS "perfilComercial",
    c."consultoria",
    c."situacao"              AS "status",
    c."dataEntrada"           AS "entrada",
    c."motivoEntrada",
    c."motivoSaidaResumo"     AS "motivoSaida",
    c."active",
    c."createdAt",
    c."updatedAt",
    m."id"                    AS "matrixId",
    m."observacoes",
    m."reunioesFechamentos",
    m."fechamentoContabil",
    m."analiseCompliance",
    m."cobrancaServExtras",
    m."complexidadeFiscal",
    m."complexidadeContabil",
    m."quantidadeFolha",
    m."dataSaida"             AS "saida",
    m."dataEntradaFiscal",
    m."dataSaidaFiscal",
    m."dataEntradaContabil",
    m."dataSaidaContabil",
    m."dataEntradaFolha",
    m."dataSaidaFolha",
    m."dataEntradaConsultoria",
    m."dataSaidaConsultoria",
    m."dataInicioCobrancaFiscal",
    m."dataFimCobrancaFiscal",
    m."dataInicioCobrancaContabil",
    m."dataFimCobrancaContabil",
    m."dataInicioCobrancaFolha",
    m."dataFimCobrancaFolha",
    m."dataInicioCobrancaConsultoria",
    m."dataFimCobrancaConsultoria",
    m."statusBloqueadoAt",
    m."statusBloqueadoByUserId",
    m."acessos",
    m."updatedByUserId",
    m."createdAt"             AS "matrixCreatedAt",
    m."updatedAt"             AS "matrixUpdatedAt"
  FROM "Company" c
  LEFT JOIN ${MATRIX_TABLE} m ON m."companyId" = c."id"
`;

// ─── Helpers dinâmicos de setor ─────────────────────────────────────────────

/** Retorna todos os setores ativos ordenados por nome. */
async function getActiveSectors() {
  return prisma.sector.findMany({
    where:   { active: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true },
  });
}

/**
 * Enriquece cada row com colunas dinâmicas de setor.
 * Chave = sector.name  |  Valor = user.email do responsável atribuído (ou null).
 */
async function enrichRowsWithSectorResponsibles(rows, sectors) {
  if (!rows.length || !sectors.length) return rows;

  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  const sectorIds  = sectors.map((s) => s.id);

  const responsibles = await prisma.companySectorResponsible.findMany({
    where:  { companyId: { in: companyIds }, sectorId: { in: sectorIds } },
    select: {
      companyId: true,
      sector: { select: { name: true } },
      user:   { select: { name: true, email: true } },
    },
  });

  // Indexa: companyId → sectorName → [nome, nome, ...]
  // Exibimos o nome do usuário (e-mail apenas como fallback quando o nome estiver vazio).
  const byCompany = {};
  for (const r of responsibles) {
    if (!byCompany[r.companyId]) byCompany[r.companyId] = {};
    const key = r.sector.name;
    if (!byCompany[r.companyId][key]) byCompany[r.companyId][key] = [];
    byCompany[r.companyId][key].push(r.user.name || r.user.email);
  }

  return rows.map((row) => {
    const sectorData = Object.fromEntries(
      sectors.map((s) => {
        const names = byCompany[row.companyId]?.[s.name];
        // null quando sem responsável; array com 1 ou mais nomes quando há atribuição
        return [s.name, names && names.length > 0 ? names : null];
      }),
    );
    return { ...row, ...sectorData };
  });
}

/**
 * Atualiza CompanySectorResponsible com base no objeto { sectorName: userId | null }.
 * null → remove a atribuição do setor.
 */
async function updateSectorResponsibles(companyId, responsaveis, actorId, sectors) {
  if (!responsaveis || typeof responsaveis !== "object") return;

  const sectorByName = Object.fromEntries(sectors.map((s) => [s.name, s]));

  for (const [sectorName, userId] of Object.entries(responsaveis)) {
    const sector = sectorByName[sectorName];
    if (!sector) continue;

    if (!userId) {
      await prisma.companySectorResponsible.deleteMany({
        where: { companyId, sectorId: sector.id },
      });
      continue;
    }

    const existing = await prisma.companySectorResponsible.findUnique({
      where: { companyId_sectorId: { companyId, sectorId: sector.id } },
    });

    if (existing) {
      await prisma.companySectorResponsible.update({
        where: { id: existing.id },
        data:  { userId, assignedAt: new Date(), assignedBy: actorId },
      });
    } else {
      await prisma.companySectorResponsible.create({
        data: { companyId, sectorId: sector.id, userId, assignedBy: actorId },
      });
    }
  }
}

// ─── Funções internas de acesso ─────────────────────────────────────────────

async function getMatrixRow(companyId, req) {
  const params = [companyId];
  let accessSql = "";
  if (!isFullAccess(req.user)) {
    params.push(req.user.id);
    accessSql = `AND EXISTS (SELECT 1 FROM "CompanySectorResponsible" csr_access WHERE csr_access."companyId" = c."id" AND csr_access."userId" = $${params.length})`;
  }

  const rows = await prisma.$queryRawUnsafe(
    `${matrixSelectSql} WHERE c."id" = $1 ${accessSql} LIMIT 1`,
    ...params,
  );
  if (!rows[0]) return null;

  const sectors  = await getActiveSectors();
  const enriched = await enrichRowsWithSectorResponsibles(rows, sectors);
  return enriched[0];
}

/**
 * Notifica no Teams quando a empresa é bloqueada ou desbloqueada,
 * listando os responsáveis de setor como destinatários.
 * Usa CompanySectorResponsible em vez de colunas fixas.
 */
async function sendStatusChangeNotification(eventKey, title, row, actorEmail, novoStatus) {
  try {
    const responsibles = await prisma.companySectorResponsible.findMany({
      where:   { companyId: row.companyId },
      include: { user: { select: { email: true, active: true } } },
    });

    const emails = [
      ...new Set(
        responsibles
          .map((r) => r.user)
          .filter((u) => u.active && u.email)
          .map((u) => u.email),
      ),
    ];

    const facts = [
      { name: "Empresa", value: row.empresa || "—" },
      { name: "CNPJ",    value: row.cnpjCpf || "—" },
    ];
    if (novoStatus) facts.push({ name: "Novo status", value: novoStatus });

    await sendTeamsNotification({ eventKey, recipients: emails, actorEmail, title, facts });
  } catch (error) {
    console.error("[STATUS_CHANGE_NOTIFY_ERROR]", error);
  }
}

function collectFields(data, map) {
  const out = new Map();
  for (const [inputName, columnName] of Object.entries(map)) {
    if (data[inputName] !== undefined && !out.has(columnName)) {
      const value =
        inputName === "cnpj" || inputName === "cnpjCpf"
          ? normalizeDocument(data[inputName])
          : data[inputName];
      out.set(columnName, value);
    }
  }
  return out;
}

function requireClosureFieldsIfNeeded(data) {
  const status = data.status ?? data.situacao;
  if (status !== "Encerrado") return null;

  const required = [
    "dataSaidaFiscal",
    "dataSaidaContabil",
    "dataSaidaFolha",
    "dataSaidaConsultoria",
    "dataFimCobrancaFiscal",
    "dataFimCobrancaContabil",
    "dataFimCobrancaFolha",
    "dataFimCobrancaConsultoria",
    "motivoSaida",
  ];
  const missing = required.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === "",
  );
  return missing.length ? missing : null;
}

async function ensureMatrixRow(tx, companyId, userId) {
  const existing = await tx.$queryRawUnsafe(
    `SELECT "id" FROM ${MATRIX_TABLE} WHERE "companyId" = $1 LIMIT 1`,
    companyId,
  );
  if (existing[0]) return existing[0].id;

  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO ${MATRIX_TABLE} ("id", "companyId", "updatedByUserId", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    id,
    companyId,
    userId,
  );
  return id;
}

async function updateFields(tx, tableName, idColumn, idValue, fields) {
  if (fields.size === 0) return;
  const assignments = [];
  const values      = [];
  let i = 1;
  for (const [columnName, value] of fields.entries()) {
    assignments.push(`"${columnName}" = $${i++}`);
    values.push(value);
  }
  assignments.push(`"updatedAt" = CURRENT_TIMESTAMP`);
  values.push(idValue);
  await tx.$executeRawUnsafe(
    `UPDATE ${tableName} SET ${assignments.join(", ")} WHERE "${idColumn}" = $${i}`,
    ...values,
  );
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

/**
 * GET /api/expectation-matrix/options
 * Retorna: colunas (estáticas + dinâmicas por setor), opções de select e usuários ativos.
 * As colunas de setor têm type "sector-user" e key = sector.name.
 * O valor nos dados é o nome do responsável (não o userId nem o e-mail).
 */
expectationMatrixRoutes.get("/options", async (_req, res) => {
  const [users, sectors] = await Promise.all([
    prisma.user.findMany({
      where:   { active: true },
      select:  { id: true, name: true, email: true, sectorId: true, sector: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    }),
    getActiveSectors(),
  ]);

  // Gera colunas dinâmicas: uma coluna por setor ativo
  const sectorColumns = sectors.map((s) => ({
    key:      s.name,
    label:    `RESP. ${s.name.toUpperCase()}`,
    type:     "sector-user",
    sectorId: s.id,
  }));

  // Injeta as colunas de setor na posição original (antes de complexidade)
  const columns = [
    ...STATIC_MATRIX_COLUMNS.slice(0, SECTOR_COLUMNS_INSERT_INDEX),
    ...sectorColumns,
    ...STATIC_MATRIX_COLUMNS.slice(SECTOR_COLUMNS_INSERT_INDEX),
  ];

  res.json({ columns, options: MATRIX_OPTIONS, users, setores: sectors });
});

/**
 * GET /api/expectation-matrix/
 * Lista empresas com dados da matriz.
 * Cada row inclui colunas dinâmicas com o nome do responsável por setor.
 */
expectationMatrixRoutes.get("/", async (req, res) => {
  const { limit, offset }      = parseLimitOffset(req.query);
  const { whereSql, params }   = buildListWhere(req);

  const [rows, countRows, sectors] = await Promise.all([
    prisma.$queryRawUnsafe(
      `${matrixSelectSql} WHERE ${whereSql} ORDER BY COALESCE(c."cod", c."razaoSocial", c."cnpj") ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...params,
      limit,
      offset,
    ),
    prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM "Company" c LEFT JOIN ${MATRIX_TABLE} m ON m."companyId" = c."id" WHERE ${whereSql}`,
      ...params,
    ),
    getActiveSectors(),
  ]);

  const enrichedRows = await enrichRowsWithSectorResponsibles(rows, sectors);

  res.json({ total: Number(countRows[0]?.total || 0), limit, offset, items: enrichedRows });
});

/**
 * GET /api/expectation-matrix/:companyId
 * Retorna a linha da matriz de uma empresa específica.
 */
expectationMatrixRoutes.get("/:companyId", async (req, res) => {
  const row = await getMatrixRow(req.params.companyId, req);
  if (!row) return res.status(404).json({ error: "Empresa não encontrada" });
  res.json(row);
});

/**
 * PUT /api/expectation-matrix/:companyId
 * Atualiza campos da matriz e/ou responsáveis por setor.
 *
 * Para atribuir responsáveis por setor inclua no body:
 *   "responsaveis": { "Nome do Setor": "userId", "Outro Setor": null }
 * null remove a atribuição do setor.
 */
expectationMatrixRoutes.put("/:companyId", async (req, res) => {
  const body = matrixSaveSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await getMatrixRow(req.params.companyId, req);
  if (!before) return res.status(404).json({ error: "Empresa não encontrada" });

  const missingClosureFields = requireClosureFieldsIfNeeded(body.data);
  if (missingClosureFields) {
    return res.status(400).json({
      error:   "Para status Encerrado, informe as datas de saída/fim de cobrança por departamento e o motivo da saída.",
      missing: missingClosureFields,
    });
  }

  const companyFields = collectFields(body.data, companyFieldMap);
  const matrixFields  = collectFields(body.data, matrixFieldMap);

  const newStatus = body.data.status ?? body.data.situacao;
  if (newStatus !== undefined) {
    companyFields.set("situacao",    newStatus);
    companyFields.set("dataSituacao", new Date());

    if (["Encerrado", "Baixada"].includes(newStatus)) {
      companyFields.set("active",       false);
      companyFields.set("inactivatedAt", new Date());
    } else if ([
      "Ativo", "Bloqueado", "Em Implantação", "Pendente de Documentação",
      "Sem atividade", "Sem Movimento", "Em Saída", "Doméstica",
    ].includes(newStatus)) {
      companyFields.set("active",       true);
      companyFields.set("inactivatedAt", null);
    }

    // Auto-registro do bloqueio (data + hora + usuário)
    if (newStatus === "Bloqueado" && !before.statusBloqueadoAt) {
      matrixFields.set("statusBloqueadoAt",      new Date());
      matrixFields.set("statusBloqueadoByUserId", req.user.id);
    }
  }

  matrixFields.set("updatedByUserId", req.user.id);

  const sectors = await getActiveSectors();

  await prisma.$transaction(async (tx) => {
    await ensureMatrixRow(tx, req.params.companyId, req.user.id);
    await updateFields(tx, '"Company"',  "id",        req.params.companyId, companyFields);
    await updateFields(tx, MATRIX_TABLE, "companyId", req.params.companyId, matrixFields);
  });

  // Atualiza responsáveis por setor via CompanySectorResponsible
  if (body.data.responsaveis) {
    await updateSectorResponsibles(req.params.companyId, body.data.responsaveis, req.user.id, sectors);
  }

  const after = await getMatrixRow(req.params.companyId, req);
  await audit(req, "EXPECTATION_MATRIX_UPDATE", "Company", req.params.companyId, before, after);

  // Notifica só na transição — evita reenviar ao salvar uma empresa já bloqueada.
  if (newStatus !== undefined) {
    const prevNorm = String(before.status ?? "").trim().toUpperCase();
    const nextNorm = String(newStatus).trim().toUpperCase();

    if (nextNorm === "BLOQUEADO" && prevNorm !== "BLOQUEADO") {
      await sendStatusChangeNotification("company_blocked", "Empresa bloqueada", after, req.user?.email);
    } else if (prevNorm === "BLOQUEADO" && nextNorm !== "BLOQUEADO") {
      await sendStatusChangeNotification("company_unblocked", "Empresa desbloqueada", after, req.user?.email, newStatus);
    }
  }

  res.json(after);
});

expectationMatrixRoutes.patch("/:companyId", async (req, res) => {
  req.method = "PUT";
  return expectationMatrixRoutes.handle(req, res);
});
