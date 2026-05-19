import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";
import { sendMail } from "../email.js";

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
};

const MATRIX_COLUMNS = [
  { key: "codigo", label: "CÓDIGO", type: "automatic", source: "Company.cod" },
  { key: "empresa", label: "EMPRESA", type: "text", source: "Company.razaoSocial" },
  { key: "cnpjCpf", label: "CNPJ/CPF", type: "text", source: "Company.cnpj" },
  { key: "grupo", label: "GRUPO", type: "text", source: "Company.grupo" },
  { key: "matrizFilial", label: "MATRIZ/FILIAL", type: "select", optionsKey: "matrizFilial", source: "Company.filial" },
  { key: "tributacao", label: "TRIBUTAÇÃO", type: "select", optionsKey: "tributacao", source: "Company.tributacao" },
  { key: "observacoes", label: "OBSERVAÇÕES", type: "textarea", source: "CompanyExpectationMatrix.observacoes" },
  { key: "ramo", label: "RAMO", type: "select", optionsKey: "ramo", source: "Company.ramo" },
  { key: "perfilComercial", label: "PERFIL COMERCIAL", type: "select", optionsKey: "perfilComercial", source: "Company.perfil" },
  { key: "reunioesFechamentos", label: "REUNIÕES FECHAMENTOS", type: "select", optionsKey: "reunioesFechamentos" },
  { key: "consultoria", label: "CONSULTORIA", type: "select", optionsKey: "consultoria", source: "Company.consultoria" },
  { key: "fechamentoContabil", label: "FECHAMENTO CONTÁBIL", type: "select", optionsKey: "fechamentoContabil" },
  { key: "analiseCompliance", label: "ANÁLISE COMPLIANCE", type: "select", optionsKey: "analiseCompliance" },
  { key: "cobrancaServExtras", label: "COBRANÇA SERV. EXTRAS", type: "select", optionsKey: "cobrancaServExtras" },
  { key: "respFecRhUserId", label: "RESP. FEC. RH", type: "user" },
  { key: "analistaLiderFiscalUserId", label: "ANALISTA LÍDER FISCAL", type: "user" },
  { key: "respFecFiscalUserId", label: "RESP. FEC. FISCAL", type: "user" },
  { key: "analistaLiderContabilUserId", label: "ANALISTA LÍDER CONTÁBIL", type: "user" },
  { key: "respFecContabilUserId", label: "RESP. FEC. CONTÁBIL", type: "user" },
  { key: "respComplianceUserId", label: "RESP. COMPLIANCE", type: "user" },
  { key: "respQualidadeUserId", label: "RESP. QUALIDADE", type: "user" },
  { key: "respAtendimentoUserId", label: "RESP. ATENDIMENTO", type: "user" },
  { key: "complexidadeFiscal", label: "COMPLEXIDADE FISCAL", type: "select", optionsKey: "complexidade" },
  { key: "complexidadeContabil", label: "COMPLEXIDADE CONTÁBIL", type: "select", optionsKey: "complexidade" },
  { key: "status", label: "STATUS", type: "select", optionsKey: "status", source: "Company.situacao" },
  { key: "entrada", label: "ENTRADA", type: "date", source: "Company.dataEntrada" },
  { key: "saida", label: "SAÍDA", type: "date", source: "CompanyExpectationMatrix.dataSaida" },
];

const nullableString = z.preprocess((value) => (value === "" ? null : value), z.string().nullable().optional());
const nullableDate = z.preprocess((value) => (value === "" || value === null ? null : value), z.coerce.date().nullable().optional());
const nullableInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return value === undefined ? undefined : null;
  return value;
}, z.coerce.number().int().nullable().optional());
const nullableJson = z.preprocess((value) => (value === "" ? null : value), z.unknown().nullable().optional());

const matrixSaveSchema = z.object({
  codigo: nullableString,
  cod: nullableString,
  empresa: nullableString,
  razaoSocial: nullableString,
  cnpjCpf: nullableString,
  cnpj: nullableString,
  grupo: nullableString,
  matrizFilial: nullableString,
  filial: nullableString,
  tributacao: nullableString,
  ramo: nullableString,
  perfilComercial: nullableString,
  perfil: nullableString,
  consultoria: nullableString,
  status: nullableString,
  situacao: nullableString,
  entrada: nullableDate,
  dataEntrada: nullableDate,
  ie: nullableString,
  ieAtual: nullableString,
  motivoEntrada: nullableString,
  motivoSaida: nullableString,
  motivoSaidaResumo: nullableString,
  observacoes: nullableString,
  reunioesFechamentos: nullableString,
  fechamentoContabil: nullableString,
  analiseCompliance: nullableString,
  cobrancaServExtras: nullableString,
  respFecRhUserId: nullableString,
  analistaLiderFiscalUserId: nullableString,
  respFecFiscalUserId: nullableString,
  analistaLiderContabilUserId: nullableString,
  respFecContabilUserId: nullableString,
  respComplianceUserId: nullableString,
  respQualidadeUserId: nullableString,
  respAtendimentoUserId: nullableString,
  complexidadeFiscal: nullableString,
  complexidadeContabil: nullableString,
  quantidadeFolha: nullableInt,
  saida: nullableDate,
  dataSaida: nullableDate,
  dataEntradaFiscal: nullableDate,
  dataSaidaFiscal: nullableDate,
  dataEntradaContabil: nullableDate,
  dataSaidaContabil: nullableDate,
  dataEntradaFolha: nullableDate,
  dataSaidaFolha: nullableDate,
  dataEntradaConsultoria: nullableDate,
  dataSaidaConsultoria: nullableDate,
  dataInicioCobrancaFiscal: nullableDate,
  dataFimCobrancaFiscal: nullableDate,
  dataInicioCobrancaContabil: nullableDate,
  dataFimCobrancaContabil: nullableDate,
  dataInicioCobrancaFolha: nullableDate,
  dataFimCobrancaFolha: nullableDate,
  dataInicioCobrancaConsultoria: nullableDate,
  dataFimCobrancaConsultoria: nullableDate,
  acessos: nullableJson,
}).passthrough();

const companyFieldMap = {
  codigo: "cod",
  cod: "cod",
  empresa: "razaoSocial",
  razaoSocial: "razaoSocial",
  cnpjCpf: "cnpj",
  cnpj: "cnpj",
  grupo: "grupo",
  matrizFilial: "filial",
  filial: "filial",
  tributacao: "tributacao",
  ramo: "ramo",
  perfilComercial: "perfil",
  perfil: "perfil",
  consultoria: "consultoria",
  status: "situacao",
  situacao: "situacao",
  entrada: "dataEntrada",
  dataEntrada: "dataEntrada",
  ie: "ieAtual",
  ieAtual: "ieAtual",
  motivoEntrada: "motivoEntrada",
  motivoSaida: "motivoSaidaResumo",
  motivoSaidaResumo: "motivoSaidaResumo",
};

const matrixFieldMap = {
  observacoes: "observacoes",
  reunioesFechamentos: "reunioesFechamentos",
  fechamentoContabil: "fechamentoContabil",
  analiseCompliance: "analiseCompliance",
  cobrancaServExtras: "cobrancaServExtras",
  respFecRhUserId: "respFecRhUserId",
  analistaLiderFiscalUserId: "analistaLiderFiscalUserId",
  respFecFiscalUserId: "respFecFiscalUserId",
  analistaLiderContabilUserId: "analistaLiderContabilUserId",
  respFecContabilUserId: "respFecContabilUserId",
  respComplianceUserId: "respComplianceUserId",
  respQualidadeUserId: "respQualidadeUserId",
  respAtendimentoUserId: "respAtendimentoUserId",
  complexidadeFiscal: "complexidadeFiscal",
  complexidadeContabil: "complexidadeContabil",
  quantidadeFolha: "quantidadeFolha",
  saida: "dataSaida",
  dataSaida: "dataSaida",
  dataEntradaFiscal: "dataEntradaFiscal",
  dataSaidaFiscal: "dataSaidaFiscal",
  dataEntradaContabil: "dataEntradaContabil",
  dataSaidaContabil: "dataSaidaContabil",
  dataEntradaFolha: "dataEntradaFolha",
  dataSaidaFolha: "dataSaidaFolha",
  dataEntradaConsultoria: "dataEntradaConsultoria",
  dataSaidaConsultoria: "dataSaidaConsultoria",
  dataInicioCobrancaFiscal: "dataInicioCobrancaFiscal",
  dataFimCobrancaFiscal: "dataFimCobrancaFiscal",
  dataInicioCobrancaContabil: "dataInicioCobrancaContabil",
  dataFimCobrancaContabil: "dataFimCobrancaContabil",
  dataInicioCobrancaFolha: "dataInicioCobrancaFolha",
  dataFimCobrancaFolha: "dataFimCobrancaFolha",
  dataInicioCobrancaConsultoria: "dataInicioCobrancaConsultoria",
  dataFimCobrancaConsultoria: "dataFimCobrancaConsultoria",
  acessos: "acessos",
};

function isFullAccess(user) {
  const roles = user?.roles || [];
  return roles.some((role) => ["ADMIN", "GESTOR_EMPRESA", "LEITURA"].includes(role));
}

function parseLimitOffset(query) {
  const limit = Math.min(Math.max(parseInt(String(query.limit || "100"), 10) || 100, 1), 500);
  const offset = Math.max(parseInt(String(query.offset || "0"), 10) || 0, 0);
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

function buildAccessWhere(req, alias = "c") {
  if (isFullAccess(req.user)) return { sql: "", params: [] };
  return {
    sql: ` AND EXISTS (SELECT 1 FROM "CompanySectorResponsible" csr_access WHERE csr_access."companyId" = ${alias}."id" AND csr_access."userId" = $ACCESS_USER_ID$)`,
    params: [req.user.id],
  };
}

function buildListWhere(req) {
  const clauses = ["1=1"];
  const params = [];

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
    )`);
  }

  const status = String(req.query.status || "").trim();
  if (status) addWhere(clauses, params, `COALESCE(c."situacao", '') = ?`, status);

  const grupo = String(req.query.grupo || "").trim();
  if (grupo) addWhere(clauses, params, `COALESCE(c."grupo", '') ILIKE ?`, `%${grupo}%`);

  const tributacao = String(req.query.tributacao || "").trim();
  if (tributacao) addWhere(clauses, params, `COALESCE(c."tributacao", '') = ?`, tributacao);

  const ramo = String(req.query.ramo || "").trim();
  if (ramo) addWhere(clauses, params, `COALESCE(c."ramo", '') = ?`, ramo);

  const perfil = String(req.query.perfil || "").trim();
  if (perfil) addWhere(clauses, params, `COALESCE(c."perfil", '') = ?`, perfil);

  const onlyActive = String(req.query.active || "").trim().toLowerCase();
  if (["true", "1", "sim", "yes"].includes(onlyActive)) clauses.push(`c."active" = true`);
  if (["false", "0", "nao", "não", "no"].includes(onlyActive)) clauses.push(`c."active" = false`);

  if (!isFullAccess(req.user)) {
    params.push(req.user.id);
    clauses.push(`EXISTS (SELECT 1 FROM "CompanySectorResponsible" csr_access WHERE csr_access."companyId" = c."id" AND csr_access."userId" = $${params.length})`);
  }

  return { whereSql: clauses.join(" AND "), params };
}

const matrixSelectSql = `
  SELECT
    c."id" AS "companyId",
    c."cod" AS "codigo",
    c."razaoSocial" AS "empresa",
    c."nomeFantasia",
    c."cnpj" AS "cnpjCpf",
    c."grupo",
    c."filial" AS "matrizFilial",
    c."tributacao",
    c."ieAtual" AS "ie",
    c."ramo",
    c."perfil" AS "perfilComercial",
    c."consultoria",
    c."situacao" AS "status",
    c."dataEntrada" AS "entrada",
    c."motivoEntrada",
    c."motivoSaidaResumo" AS "motivoSaida",
    c."active",
    c."createdAt",
    c."updatedAt",
    m."id" AS "matrixId",
    m."observacoes",
    m."reunioesFechamentos",
    m."fechamentoContabil",
    m."analiseCompliance",
    m."cobrancaServExtras",
    m."respFecRhUserId",
    m."analistaLiderFiscalUserId",
    m."respFecFiscalUserId",
    m."analistaLiderContabilUserId",
    m."respFecContabilUserId",
    m."respComplianceUserId",
    m."respQualidadeUserId",
    m."respAtendimentoUserId",
    m."complexidadeFiscal",
    m."complexidadeContabil",
    m."quantidadeFolha",
    m."dataSaida" AS "saida",
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
    m."createdAt" AS "matrixCreatedAt",
    m."updatedAt" AS "matrixUpdatedAt"
  FROM "Company" c
  LEFT JOIN ${MATRIX_TABLE} m ON m."companyId" = c."id"
`;

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
  return rows[0] || null;
}

async function sendBlockedNotification(row, actorEmail) {
  try {
    const userIds = [
      row.respFecRhUserId,
      row.analistaLiderFiscalUserId,
      row.respFecFiscalUserId,
      row.analistaLiderContabilUserId,
      row.respFecContabilUserId,
      row.respComplianceUserId,
      row.respQualidadeUserId,
      row.respAtendimentoUserId,
    ].filter(Boolean);

    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] }, active: true }, select: { email: true } })
      : [];

    const emails = users.map((user) => user.email).filter(Boolean);
    if (emails.length === 0) return;

    await sendMail(
      emails.join(","),
      `Empresa bloqueada: ${row.empresa || row.cnpjCpf || row.companyId}`,
      [
        `A empresa ${row.empresa || "sem nome"} foi marcada como Bloqueada.`,
        `CNPJ/CPF: ${row.cnpjCpf || "-"}`,
        `Usuário responsável pela alteração: ${actorEmail || "-"}`,
        `Data/hora: ${new Date().toISOString()}`,
      ].join("\n"),
    );
  } catch (error) {
    console.error("[BLOCKED_STATUS_EMAIL_ERROR]", error);
  }
}

function collectFields(data, map) {
  const out = new Map();
  for (const [inputName, columnName] of Object.entries(map)) {
    if (data[inputName] !== undefined && !out.has(columnName)) {
      const value = inputName === "cnpj" || inputName === "cnpjCpf" ? normalizeDocument(data[inputName]) : data[inputName];
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
  const missing = required.filter((field) => data[field] === undefined || data[field] === null || data[field] === "");
  return missing.length ? missing : null;
}

async function ensureMatrixRow(tx, companyId, userId) {
  const existing = await tx.$queryRawUnsafe(`SELECT "id" FROM ${MATRIX_TABLE} WHERE "companyId" = $1 LIMIT 1`, companyId);
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
  const values = [];
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

expectationMatrixRoutes.get("/options", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, sectorId: true, sector: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  res.json({ columns: MATRIX_COLUMNS, options: MATRIX_OPTIONS, users });
});

expectationMatrixRoutes.get("/", async (req, res) => {
  const { limit, offset } = parseLimitOffset(req.query);
  const { whereSql, params } = buildListWhere(req);

  const rows = await prisma.$queryRawUnsafe(
    `${matrixSelectSql} WHERE ${whereSql} ORDER BY COALESCE(c."cod", c."razaoSocial", c."cnpj") ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    ...params,
    limit,
    offset,
  );

  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS total FROM "Company" c LEFT JOIN ${MATRIX_TABLE} m ON m."companyId" = c."id" WHERE ${whereSql}`,
    ...params,
  );

  res.json({ total: Number(countRows[0]?.total || 0), limit, offset, items: rows });
});

expectationMatrixRoutes.get("/:companyId", async (req, res) => {
  const row = await getMatrixRow(req.params.companyId, req);
  if (!row) return res.status(404).json({ error: "Empresa não encontrada" });
  res.json(row);
});

expectationMatrixRoutes.put("/:companyId", async (req, res) => {
  const body = matrixSaveSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await getMatrixRow(req.params.companyId, req);
  if (!before) return res.status(404).json({ error: "Empresa não encontrada" });

  const missingClosureFields = requireClosureFieldsIfNeeded(body.data);
  if (missingClosureFields) {
    return res.status(400).json({
      error: "Para status Encerrado, informe as datas de saída/fim de cobrança por departamento e o motivo da saída.",
      missing: missingClosureFields,
    });
  }

  const companyFields = collectFields(body.data, companyFieldMap);
  const matrixFields = collectFields(body.data, matrixFieldMap);

  const newStatus = body.data.status ?? body.data.situacao;
  if (newStatus !== undefined) {
    companyFields.set("situacao", newStatus);
    companyFields.set("dataSituacao", new Date());
    if (["Encerrado", "Baixada"].includes(newStatus)) {
      companyFields.set("active", false);
      companyFields.set("inactivatedAt", new Date());
    } else if (["Ativo", "Bloqueado", "Em Implantação", "Pendente de Documentação", "Sem atividade", "Sem Movimento", "Em Saída", "Doméstica"].includes(newStatus)) {
      companyFields.set("active", true);
      companyFields.set("inactivatedAt", null);
    }

    if (newStatus === "Bloqueado" && !before.statusBloqueadoAt) {
      matrixFields.set("statusBloqueadoAt", new Date());
      matrixFields.set("statusBloqueadoByUserId", req.user.id);
    }
  }

  matrixFields.set("updatedByUserId", req.user.id);

  await prisma.$transaction(async (tx) => {
    await ensureMatrixRow(tx, req.params.companyId, req.user.id);
    await updateFields(tx, '"Company"', "id", req.params.companyId, companyFields);
    await updateFields(tx, MATRIX_TABLE, "companyId", req.params.companyId, matrixFields);
  });

  const after = await getMatrixRow(req.params.companyId, req);
  await audit(req, "EXPECTATION_MATRIX_UPDATE", "Company", req.params.companyId, before, after);

  if ((body.data.status ?? body.data.situacao) === "Bloqueado") {
    await sendBlockedNotification(after, req.user.email);
  }

  res.json(after);
});

expectationMatrixRoutes.patch("/:companyId", async (req, res) => {
  req.method = "PUT";
  return expectationMatrixRoutes.handle(req, res);
});
