import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";
import { sendTeamsNotification } from "../teams.js";
import { responsibleEmails } from "../responsibles.js";

export const companyRoutes = Router();

function parseBooleanParam(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "sim"].includes(normalized)) return true;
  if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  return undefined;
}

function normalizeCnpj(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isInactiveBusinessStatus(status) {
  return ["Encerrado", "Baixada"].includes(String(status || ""));
}

const emptyToNull = (value) => (value === "" || value === null ? null : value);

const nullableString = z.preprocess(emptyToNull, z.string().nullable().optional());

const nullableDate = z.preprocess(emptyToNull, z.coerce.date().nullable().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = parseBooleanParam(value);
  return parsed === undefined ? value : parsed;
}, z.boolean().optional());

const requiredBoolean = z.preprocess((value) => {
  const parsed = parseBooleanParam(value);
  return parsed === undefined ? value : parsed;
}, z.boolean());

const nullableInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return value === undefined ? undefined : null;
  return value;
}, z.coerce.number().int().nullable().optional());

const cnpjString = z.preprocess((value) => normalizeCnpj(value), z.string().min(8));

const companyBaseSchema = z.object({
  cnpj: cnpjString,
  razaoSocial: nullableString,
  nomeFantasia: nullableString,
  dataCadastro: nullableDate,
  cod: nullableString,
  filial: nullableString,
  grupo: nullableString,
  municipio: nullableString,
  uf: nullableString,
  tributacao: nullableString,
  ieAtual: nullableString,
  dataTributacao: nullableDate,
  motivoEntrada: nullableString,
  situacao: nullableString,
  dataSituacao: nullableDate,
  ramo: nullableString,
  consultoria: nullableString,
  banco: nullableString,
  perfil: nullableString,
  licitacao: nullableString,
  responsavelComercial: nullableString,
  dataEntrada: nullableDate,
  dataInicioCobranca: nullableDate,
  dataFimCobranca: nullableDate,
  motivoSaidaResumo: nullableString,
  motivoSaida: nullableString,
  qtdeInicialFolha: nullableInt,
  qtdeFolha: nullableInt,
  qtde_folha: nullableInt,
  "QTDE Folha": nullableInt,
  active: optionalBoolean,

  // Campos exibidos na tela de detalhe que são persistidos em CompanyExpectationMatrix.
  observacoes: nullableString,
  reunioesFechamentos: nullableString,
  fechamentoContabil: nullableString,
  analiseCompliance: nullableString,
  cobrancaServExtras: nullableString,
  complexidadeFiscal: nullableString,
  complexidadeContabil: nullableString,
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

  // Acessos (armazenados como JSON na matriz).
  prefeitura: nullableString,
  prefeituraLogin: nullableString,
  prefeituraSenha: nullableString,
  sefaz: nullableString,
  sefazLogin: nullableString,
  sefazSenha: nullableString,
});

function pickDefined(data, fields) {
  return fields.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});
}

function buildCompanyWriteData(data) {
  const normalized = { ...data };

  // Compatibilidade com nomes que o front/formulário pode enviar para o campo "QTDE Folha".
  if (normalized.qtdeInicialFolha === undefined) {
    for (const alias of ["qtdeFolha", "qtde_folha", "QTDE Folha"]) {
      if (normalized[alias] !== undefined) {
        normalized.qtdeInicialFolha = normalized[alias];
        break;
      }
    }
  }

  // O front do detalhe usa "motivoSaida"; a coluna da empresa é "motivoSaidaResumo".
  if (normalized.motivoSaidaResumo === undefined && normalized.motivoSaida !== undefined) {
    normalized.motivoSaidaResumo = normalized.motivoSaida;
  }

  const writeData = pickDefined(normalized, companyWritableFields);
  if (writeData.dataCadastro === null) delete writeData.dataCadastro;

  if (writeData.active !== undefined) {
    writeData.inactivatedAt = writeData.active ? null : new Date();
  }

  return writeData;
}

const companyWritableFields = [
  "cnpj",
  "razaoSocial",
  "nomeFantasia",
  "dataCadastro",
  "cod",
  "filial",
  "grupo",
  "municipio",
  "uf",
  "tributacao",
  "ieAtual",
  "dataTributacao",
  "motivoEntrada",
  "situacao",
  "dataSituacao",
  "ramo",
  "consultoria",
  "banco",
  "perfil",
  "licitacao",
  "responsavelComercial",
  "dataEntrada",
  "dataInicioCobranca",
  "dataFimCobranca",
  "motivoSaidaResumo",
  "qtdeInicialFolha",
  "active",
];

// Notifica um evento de empresa mencionando seus responsáveis (menos o autor).
// Fire-and-forget: falha aqui não derruba a request.
async function notifyCompanyEvent({ eventKey, title, company, actorEmail, novoStatus }) {
  const facts = [
    { name: "Empresa", value: company.razaoSocial ?? company.nomeFantasia ?? "—" },
    { name: "CNPJ",    value: company.cnpj },
  ];
  if (novoStatus) facts.push({ name: "Novo status", value: novoStatus });

  await sendTeamsNotification({
    eventKey,
    title,
    actorEmail,
    recipients: await responsibleEmails(company.id),
    facts,
  });
}

const companyInclude = {
  responsibles: {
    include: {
      sector: true,
      user: { select: { id: true, name: true, email: true, active: true, sectorId: true } },
    },
  },
};

// ─── CompanyExpectationMatrix ────────────────────────────────────────────────
// Vários campos exibidos no detalhe da empresa (observações, datas por setor,
// acessos) vivem na tabela CompanyExpectationMatrix — acessada via SQL bruto,
// pois não é um modelo Prisma. As funções abaixo permitem que o GET/PUT de
// /companies/:id leiam e gravem esses campos junto com os da própria empresa.
const MATRIX_TABLE = '"CompanyExpectationMatrix"';

const matrixStringFields = [
  "observacoes",
  "reunioesFechamentos",
  "fechamentoContabil",
  "analiseCompliance",
  "cobrancaServExtras",
  "complexidadeFiscal",
  "complexidadeContabil",
];

const matrixDateFields = [
  "dataSaida",
  "dataEntradaFiscal", "dataSaidaFiscal",
  "dataEntradaContabil", "dataSaidaContabil",
  "dataEntradaFolha", "dataSaidaFolha",
  "dataEntradaConsultoria", "dataSaidaConsultoria",
  "dataInicioCobrancaFiscal", "dataFimCobrancaFiscal",
  "dataInicioCobrancaContabil", "dataFimCobrancaContabil",
  "dataInicioCobrancaFolha", "dataFimCobrancaFolha",
  "dataInicioCobrancaConsultoria", "dataFimCobrancaConsultoria",
];

const matrixFieldNames = [...matrixStringFields, ...matrixDateFields];

// Campos "flat" de acesso guardados no JSON "acessos" da matriz.
const acessoFields = ["prefeitura", "prefeituraLogin", "prefeituraSenha", "sefaz", "sefazLogin", "sefazSenha"];

// Senhas não devem ser gravadas em texto claro no log de auditoria.
const sensitiveAcessoFields = ["prefeituraSenha", "sefazSenha"];

async function readMatrixRow(companyId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM ${MATRIX_TABLE} WHERE "companyId" = $1 LIMIT 1`,
    companyId,
  );
  return rows[0] ?? null;
}

// Mescla os campos da matriz (e aliases do detalhe) sobre o objeto da empresa.
function mergeCompanyWithMatrix(company, matrixRow) {
  if (!company) return company;
  const acessos = matrixRow?.acessos && typeof matrixRow.acessos === "object" ? matrixRow.acessos : {};

  const merged = {
    ...company,
    // Aliases usados pela tela de detalhe.
    motivoSaida: company.motivoSaidaResumo ?? null,
    qtdeFolha: company.qtdeInicialFolha ?? null,
  };

  for (const field of matrixFieldNames) {
    merged[field] = matrixRow?.[field] ?? null;
  }
  for (const key of acessoFields) {
    merged[key] = acessos?.[key] ?? null;
  }

  return merged;
}

// Snapshot para auditoria (sem senhas em texto claro).
function sanitizeForAudit(merged) {
  if (!merged) return merged;
  const clone = { ...merged };
  for (const key of sensitiveAcessoFields) {
    if (clone[key] !== undefined && clone[key] !== null && clone[key] !== "") {
      clone[key] = "••••••••";
    }
  }
  return clone;
}

async function ensureMatrixRow(companyId, userId) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT "id" FROM ${MATRIX_TABLE} WHERE "companyId" = $1 LIMIT 1`,
    companyId,
  );
  if (existing[0]) return existing[0].id;

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${MATRIX_TABLE} ("id", "companyId", "updatedByUserId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    id,
    companyId,
    userId,
  );
  return id;
}

// Monta o Map de colunas da matriz a gravar a partir do corpo da requisição.
function buildMatrixWriteData(data, existingAcessos) {
  const fields = new Map();

  for (const field of matrixFieldNames) {
    if (data[field] !== undefined) fields.set(field, data[field]);
  }

  const acessoUpdates = {};
  let hasAcesso = false;
  for (const key of acessoFields) {
    if (data[key] !== undefined) {
      acessoUpdates[key] = data[key];
      hasAcesso = true;
    }
  }
  if (hasAcesso) {
    fields.set("acessos", { ...(existingAcessos || {}), ...acessoUpdates });
  }

  return fields;
}

async function writeMatrixFields(companyId, fields) {
  if (fields.size === 0) return;
  const assignments = [];
  const values = [];
  let i = 1;
  for (const [column, value] of fields.entries()) {
    assignments.push(`"${column}" = $${i++}`);
    values.push(value);
  }
  assignments.push(`"updatedAt" = CURRENT_TIMESTAMP`);
  values.push(companyId);
  await prisma.$executeRawUnsafe(
    `UPDATE ${MATRIX_TABLE} SET ${assignments.join(", ")} WHERE "companyId" = $${i}`,
    ...values,
  );
}


const responsibleUserRefSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((value) => Boolean(value.userId || value.email), {
    message: "Informe userId ou email para o responsável.",
  });

const responsibleItemSchema = z
  .object({
    sectorId: z.string().min(1),
    userId: z.string().min(1).optional(),
    userIds: z.array(z.string().min(1)).optional(),
    email: z.string().email().optional(),
    emails: z.array(z.string().email()).optional(),
    users: z.array(responsibleUserRefSchema).optional(),
  })
  .refine(
    (value) =>
      value.userId !== undefined ||
      value.userIds !== undefined ||
      value.email !== undefined ||
      value.emails !== undefined ||
      value.users !== undefined,
    {
      message: "Informe userId, userIds, email, emails ou users. Para limpar o setor, envie userIds: [].",
    },
  );

const responsiblesPayloadSchema = z.object({
  responsibles: z.array(responsibleItemSchema),
  reason: z.string().optional(),
});

function normalizeEmailForLookup(value) {
  return String(value || "").trim().toLowerCase();
}

function groupResponsibleInput(responsibles) {
  const bySector = new Map();

  for (const item of responsibles) {
    const current = bySector.get(item.sectorId) || { sectorId: item.sectorId, userIds: new Set(), emails: new Set() };

    if (item.userId) current.userIds.add(item.userId);
    for (const userId of item.userIds || []) current.userIds.add(userId);

    if (item.email) current.emails.add(normalizeEmailForLookup(item.email));
    for (const email of item.emails || []) current.emails.add(normalizeEmailForLookup(email));

    for (const user of item.users || []) {
      if (user.userId) current.userIds.add(user.userId);
      if (user.email) current.emails.add(normalizeEmailForLookup(user.email));
    }

    bySector.set(item.sectorId, current);
  }

  return Array.from(bySector.values()).map((item) => ({
    sectorId: item.sectorId,
    userIds: Array.from(item.userIds),
    emails: Array.from(item.emails).filter(Boolean),
  }));
}

function formatResponsibleRow(row) {
  return {
    id: row.id,
    assignedAt: row.assignedAt,
    sector: row.sector ? { id: row.sector.id, name: row.sector.name } : { id: row.sectorId, name: null },
    user: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : { id: row.userId, name: null, email: null },
  };
}

// Snapshot amigável para auditoria: { "Nome do Setor": ["Fulano", "Ciclano"] }.
// Mantém before/after comparáveis campo a campo (por setor) na tela de auditoria.
function auditResponsiblesSnapshot(rows) {
  const bySector = {};
  for (const row of rows) {
    const sectorName = row.sector?.name ?? row.sectorId;
    const userName = row.user?.name ?? row.user?.email ?? row.userId;
    if (!bySector[sectorName]) bySector[sectorName] = [];
    bySector[sectorName].push(userName);
  }
  return bySector;
}

function groupResponsibleRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const sectorId = row.sector?.id ?? row.sectorId;
    const current = grouped.get(sectorId) || {
      sector: row.sector ? { id: row.sector.id, name: row.sector.name } : { id: sectorId, name: null },
      users: [],
    };

    current.users.push(
      row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : { id: row.userId, name: null, email: null },
    );
    grouped.set(sectorId, current);
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    emails: item.users.map((user) => user.email).filter(Boolean),
  }));
}

companyRoutes.get("/", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const normalizedSearchCnpj = normalizeCnpj(search);
  const active = parseBooleanParam(req.query.active);
  const status = String(req.query.status || "").trim();

  const companies = await prisma.company.findMany({
    where: {
      ...(active === undefined ? {} : { active }),
      ...(status ? { situacao: status } : {}),
      ...(search
        ? {
            OR: [
              { cnpj: { contains: search } },
              ...(normalizedSearchCnpj && normalizedSearchCnpj !== search ? [{ cnpj: { contains: normalizedSearchCnpj } }] : []),
              { cod: { contains: search, mode: "insensitive" } },
              { razaoSocial: { contains: search, mode: "insensitive" } },
              { nomeFantasia: { contains: search, mode: "insensitive" } },
              { grupo: { contains: search, mode: "insensitive" } },
              { municipio: { contains: search, mode: "insensitive" } },
              { uf: { contains: search, mode: "insensitive" } },
              { situacao: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ cod: "asc" }, { createdAt: "desc" }],
  });

  res.json(companies);
});

companyRoutes.post("/", async (req, res) => {
  const body = companyBaseSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const createData = buildCompanyWriteData(body.data);

  const company = await prisma.company.create({
    data: createData,
    include: companyInclude,
  });

  await audit(req, "COMPANY_CREATE", "Company", company.id, undefined, company);

  notifyCompanyEvent({
    eventKey: "company_created",
    title: "Novo cliente cadastrado",
    company,
    actorEmail: req.user?.email,
  }).catch(() => {});

  res.status(201).json(company);
});

companyRoutes.get("/responsibles/by-cnpj", async (req, res) => {
  const rawCnpj = String(req.query.cnpj || "").trim();
  const cnpj = normalizeCnpj(rawCnpj);
  if (!cnpj) return res.status(400).json({ error: "cnpj is required" });

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { cnpj: rawCnpj },
        { cnpj },
        ...(cnpj.length >= 8 ? [{ cnpj: { contains: cnpj } }] : []),
      ],
    },
    include: { responsibles: { include: { sector: true, user: true } } },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });

  res.json({
    cnpj: company.cnpj,
    companyId: company.id,
    razaoSocial: company.razaoSocial,
    responsibles: company.responsibles.map(formatResponsibleRow),
    grouped: groupResponsibleRows(company.responsibles),
  });
});

companyRoutes.get("/:id", async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id },
    include: companyInclude,
  });
  if (!company) return res.status(404).json({ error: "Not found" });

  const matrixRow = await readMatrixRow(company.id);
  res.json(mergeCompanyWithMatrix(company, matrixRow));
});

companyRoutes.put("/:id", async (req, res) => {
  const body = companyBaseSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const beforeMatrix = await readMatrixRow(req.params.id);

  const updateData = buildCompanyWriteData(body.data);

  // Ao mudar situacao para "Bloqueado" registra automaticamente data, hora e usuário responsável
  const prevSituacao = (before.situacao ?? "").trim().toUpperCase();
  const newSituacao  = (updateData.situacao ?? "").trim().toUpperCase();
  if (newSituacao === "BLOQUEADO" && prevSituacao !== "BLOQUEADO") {
    updateData.bloqueadoAt  = new Date();
    updateData.bloqueadoPor = req.user?.id ?? null;
  }

  const updated = await prisma.company.update({
    where: { id: req.params.id },
    data: updateData,
    include: companyInclude,
  });

  // Persiste os campos que vivem em CompanyExpectationMatrix (observações, datas
  // por setor, acessos) quando presentes no corpo da requisição.
  const matrixData = buildMatrixWriteData(body.data, beforeMatrix?.acessos);
  if (matrixData.size > 0) {
    await ensureMatrixRow(req.params.id, req.user?.id ?? null);
    matrixData.set("updatedByUserId", req.user?.id ?? null);
    await writeMatrixFields(req.params.id, matrixData);
  }

  const afterMatrix = await readMatrixRow(req.params.id);
  const response = mergeCompanyWithMatrix(updated, afterMatrix);

  await audit(
    req,
    "COMPANY_UPDATE",
    "Company",
    updated.id,
    sanitizeForAudit(mergeCompanyWithMatrix(before, beforeMatrix)),
    sanitizeForAudit(response),
  );

  if (newSituacao === "BLOQUEADO" && prevSituacao !== "BLOQUEADO") {
    notifyCompanyEvent({
      eventKey: "company_blocked", title: "Empresa bloqueada",
      company: updated, actorEmail: req.user?.email,
    }).catch(() => {});
  } else if (prevSituacao === "BLOQUEADO" && newSituacao && newSituacao !== "BLOQUEADO") {
    notifyCompanyEvent({
      eventKey: "company_unblocked", title: "Empresa desbloqueada",
      company: updated, actorEmail: req.user?.email, novoStatus: updated.situacao,
    }).catch(() => {});
  }

  res.json(response);
});

companyRoutes.patch("/:id/status", async (req, res) => {
  const body = z.object({
    active: requiredBoolean.optional(),
    status: z.string().min(1).optional(),
    situacao: z.string().min(1).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const status = body.data.status ?? body.data.situacao;
  const active = body.data.active ?? (status ? !isInactiveBusinessStatus(status) : before.active);

  // Ao definir status como "Bloqueado" registra automaticamente data, hora e usuário responsável
  const prevSituacaoPatch = (before.situacao ?? "").trim().toUpperCase();
  const newStatusNorm     = (status ?? "").trim().toUpperCase();
  const bloqueadoFields   =
    newStatusNorm === "BLOQUEADO" && prevSituacaoPatch !== "BLOQUEADO" && !before.bloqueadoAt
      ? { bloqueadoAt: new Date(), bloqueadoPor: req.user?.id ?? null }
      : {};

  const updated = await prisma.company.update({
    where: { id: req.params.id },
    data: {
      active,
      inactivatedAt: active ? null : new Date(),
      ...(status ? { situacao: status, dataSituacao: new Date() } : {}),
      ...bloqueadoFields,
    },
  });

  await audit(req, active ? "COMPANY_STATUS_UPDATE" : "COMPANY_INACTIVATE", "Company", updated.id, before, updated);

  if (newStatusNorm === "BLOQUEADO" && prevSituacaoPatch !== "BLOQUEADO") {
    notifyCompanyEvent({
      eventKey: "company_blocked", title: "Empresa bloqueada",
      company: updated, actorEmail: req.user?.email,
    }).catch(() => {});
  } else if (prevSituacaoPatch === "BLOQUEADO" && newStatusNorm && newStatusNorm !== "BLOQUEADO") {
    notifyCompanyEvent({
      eventKey: "company_unblocked", title: "Empresa desbloqueada",
      company: updated, actorEmail: req.user?.email, novoStatus: updated.situacao,
    }).catch(() => {});
  }

  res.json(updated);
});

companyRoutes.delete("/:id", async (req, res) => {
  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.company.update({
    where: { id: req.params.id },
    data: { active: false, inactivatedAt: new Date() },
  });

  await audit(req, "COMPANY_INACTIVATE", "Company", updated.id, before, updated);
  res.json(updated);
});

companyRoutes.get("/:id/process", async (req, res) => {
  const type = String(req.query.type || "").trim();
  const companyId = req.params.id;
  if (type && !["ENTRADA", "SAIDA"].includes(type)) return res.status(400).json({ error: "invalid type" });

  const runs = await prisma.processRun.findMany({
    where: {
      companyId,
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      templateId: true,
      snapshotTemplateName: true,
      snapshotTemplateVersion: true,
      createdAt: true,
      anchorAt: true,
      items: {
        where: { status: "CONCLUIDO" },
        orderBy: { doneAt: "asc" },
        take: 1,
        select: {
          snapshotItemCode: true,
          snapshotItemDescription: true,
        },
      },
    },
  });

  res.json(
    runs.map((r) => ({
      id: r.id,
      type: r.type,
      template: { id: r.templateId, name: r.snapshotTemplateName ?? null, version: r.snapshotTemplateVersion ?? null },
      firstDoneActionCode: r.items?.[0]?.snapshotItemCode ?? null,
      firstDoneActionText: r.items?.[0]?.snapshotItemDescription ?? null,
      createdAt: r.createdAt,
      anchorAt: r.anchorAt,
    })),
  );
});

companyRoutes.get("/:id/responsibles", async (req, res) => {
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const responsibles = await prisma.companySectorResponsible.findMany({
    where: { companyId: company.id },
    include: { sector: true, user: true },
    orderBy: [{ assignedAt: "desc" }],
  });

  res.json({
    companyId: company.id,
    responsibles: responsibles.map(formatResponsibleRow),
    grouped: groupResponsibleRows(responsibles),
  });
});

companyRoutes.put("/:id/responsibles", async (req, res) => {
  const body = responsiblesPayloadSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const actorId = req.user.id;
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const groupedInput = groupResponsibleInput(body.data.responsibles);
  const sectorIds = groupedInput.map((item) => item.sectorId);

  const sectors = await prisma.sector.findMany({ where: { id: { in: sectorIds } } });
  const foundSectorIds = new Set(sectors.map((sector) => sector.id));
  const missingSectorIds = sectorIds.filter((sectorId) => !foundSectorIds.has(sectorId));
  if (missingSectorIds.length) {
    return res.status(400).json({ error: "Sector not found", sectorIds: missingSectorIds });
  }

  const requestedUserIds = Array.from(new Set(groupedInput.flatMap((item) => item.userIds)));
  const requestedEmails = Array.from(new Set(groupedInput.flatMap((item) => item.emails)));
  const userOr = [
    ...(requestedUserIds.length ? [{ id: { in: requestedUserIds } }] : []),
    ...(requestedEmails.length ? [{ email: { in: requestedEmails, mode: "insensitive" } }] : []),
  ];

  const users = userOr.length ? await prisma.user.findMany({ where: { OR: userOr } }) : [];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByEmail = new Map(users.map((user) => [normalizeEmailForLookup(user.email), user]));

  const missingUsers = [];
  const desiredBySector = new Map();

  for (const item of groupedInput) {
    const desiredUserIds = new Set();

    for (const userId of item.userIds) {
      const user = usersById.get(userId);
      if (user) desiredUserIds.add(user.id);
      else missingUsers.push({ sectorId: item.sectorId, userId });
    }

    for (const email of item.emails) {
      const user = usersByEmail.get(normalizeEmailForLookup(email));
      if (user) desiredUserIds.add(user.id);
      else missingUsers.push({ sectorId: item.sectorId, email });
    }

    desiredBySector.set(item.sectorId, desiredUserIds);
  }

  if (missingUsers.length) {
    return res.status(400).json({
      error: "Responsible user not found",
      message: "Os e-mails informados precisam pertencer a usuários cadastrados no sistema.",
      missingUsers,
    });
  }

  const before = await prisma.companySectorResponsible.findMany({
    where: { companyId: company.id, sectorId: { in: sectorIds } },
    include: { sector: true, user: true },
    orderBy: [{ assignedAt: "desc" }],
  });

  const now = new Date();

  for (const sectorId of sectorIds) {
    const desiredUserIds = desiredBySector.get(sectorId) || new Set();
    const existingForSector = before.filter((row) => row.sectorId === sectorId);
    const seenExistingUsers = new Set();
    const duplicateRows = [];

    for (const row of existingForSector) {
      if (seenExistingUsers.has(row.userId)) duplicateRows.push(row);
      else seenExistingUsers.add(row.userId);
    }

    const toRemove = existingForSector.filter((row) => !desiredUserIds.has(row.userId)).concat(duplicateRows);
    const toRemoveIds = Array.from(new Set(toRemove.map((row) => row.id)));
    const toCloseHistoryUserIds = Array.from(new Set(existingForSector.filter((row) => !desiredUserIds.has(row.userId)).map((row) => row.userId)));

    if (toRemoveIds.length) {
      await prisma.companySectorResponsible.deleteMany({ where: { id: { in: toRemoveIds } } });
    }

    if (toCloseHistoryUserIds.length) {
      await prisma.companySectorResponsibleHistory.updateMany({
        where: { companyId: company.id, sectorId, userId: { in: toCloseHistoryUserIds }, endAt: null },
        data: { endAt: now },
      });
    }

    const existingKeptUserIds = new Set(existingForSector.filter((row) => !toRemoveIds.includes(row.id)).map((row) => row.userId));
    const toAddUserIds = Array.from(desiredUserIds).filter((userId) => !existingKeptUserIds.has(userId));

    for (const userId of toAddUserIds) {
      await prisma.companySectorResponsibleHistory.updateMany({
        where: { companyId: company.id, sectorId, userId, endAt: null },
        data: { endAt: now },
      });

      await prisma.companySectorResponsible.create({
        data: { companyId: company.id, sectorId, userId, assignedAt: now, assignedBy: actorId },
      });

      await prisma.companySectorResponsibleHistory.create({
        data: {
          companyId: company.id,
          sectorId,
          userId,
          startAt: now,
          changedBy: actorId,
          reason: body.data.reason,
        },
      });
    }
  }

  const updated = await prisma.companySectorResponsible.findMany({
    where: { companyId: company.id, sectorId: { in: sectorIds } },
    include: { sector: true, user: true },
    orderBy: [{ assignedAt: "desc" }],
  });

  await audit(
    req,
    "COMPANY_RESPONSIBLES_SET",
    "Company",
    company.id,
    auditResponsiblesSnapshot(before),
    auditResponsiblesSnapshot(updated),
  );

  sendTeamsNotification({
    eventKey: "responsible_changed",
    title: "Alteração de responsável",
    actorEmail: req.user?.email,
    // Menciona os responsáveis resultantes da alteração, não os anteriores.
    recipients: [...new Set(updated.map((r) => r.user?.email).filter(Boolean))],
    facts: [
      { name: "Empresa", value: company.razaoSocial ?? company.nomeFantasia ?? "—" },
      { name: "CNPJ",    value: company.cnpj },
    ],
  }).catch(() => {});

  res.json({
    ok: true,
    companyId: company.id,
    responsibles: updated.map(formatResponsibleRow),
    grouped: groupResponsibleRows(updated),
  });
});

companyRoutes.get("/:id/partners", async (req, res) => {
  const partners = await prisma.companyPartner.findMany({
    where: { companyId: req.params.id },
    orderBy: { createdAt: "desc" },
  });

  res.json(partners);
});

companyRoutes.post("/:id/partners", async (req, res) => {
  const body = z
    .object({
      nomeCompleto: z.string().min(1),
      whatsapp: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      telefoneEmpresa: z.string().optional().nullable(),
      dataNascimento: z.coerce.date().optional().nullable(),
      outros: z.string().optional().nullable(),
    })
    .safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const partner = await prisma.companyPartner.create({
    data: { companyId: req.params.id, ...body.data },
  });

  await audit(req, "COMPANY_PARTNER_CREATE", "CompanyPartner", partner.id, undefined, partner);
  res.status(201).json(partner);
});

companyRoutes.put("/:id/partners/:partnerId", async (req, res) => {
  const body = z
    .object({
      nomeCompleto: z.string().min(1).optional(),
      whatsapp: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      telefoneEmpresa: z.string().optional().nullable(),
      dataNascimento: z.coerce.date().optional().nullable(),
      outros: z.string().optional().nullable(),
    })
    .safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.companyPartner.findFirst({
    where: { id: req.params.partnerId, companyId: req.params.id },
  });
  if (!existing) return res.status(404).json({ error: "Partner not found" });

  const updated = await prisma.companyPartner.update({
    where: { id: req.params.partnerId },
    data: body.data,
  });

  await audit(req, "COMPANY_PARTNER_UPDATE", "CompanyPartner", updated.id, existing, updated);
  res.json(updated);
});

companyRoutes.delete("/:id/partners/:partnerId", async (req, res) => {
  const existing = await prisma.companyPartner.findFirst({
    where: { id: req.params.partnerId, companyId: req.params.id },
  });
  if (!existing) return res.status(404).json({ error: "Partner not found" });

  await prisma.companyPartner.delete({ where: { id: req.params.partnerId } });
  await audit(req, "COMPANY_PARTNER_DELETE", "CompanyPartner", existing.id, existing, undefined);

  res.json({ ok: true });
});


const clientContactSchema = z.object({
  area: z.enum(["Folha", "Fiscal", "Contábil", "Financeiro"]),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
});

companyRoutes.get("/:id/client-contacts", async (req, res) => {
  const contacts = await prisma.$queryRawUnsafe(
    `SELECT "id", "companyId", "area", "name", "email", "phone", "createdAt", "updatedAt"
     FROM "CompanyClientContact"
     WHERE "companyId" = $1
     ORDER BY "area" ASC, "name" ASC`,
    req.params.id,
  );
  res.json(contacts);
});

companyRoutes.post("/:id/client-contacts", async (req, res) => {
  const body = clientContactSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CompanyClientContact" ("id", "companyId", "area", "name", "email", "phone", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    id,
    req.params.id,
    body.data.area,
    body.data.name,
    body.data.email ?? null,
    body.data.phone ?? null,
  );

  const created = (await prisma.$queryRawUnsafe(`SELECT * FROM "CompanyClientContact" WHERE "id" = $1`, id))[0];
  await audit(req, "COMPANY_CLIENT_CONTACT_CREATE", "CompanyClientContact", id, undefined, created);
  res.status(201).json(created);
});

companyRoutes.put("/:id/client-contacts/:contactId", async (req, res) => {
  const body = clientContactSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "CompanyClientContact" WHERE "id" = $1 AND "companyId" = $2 LIMIT 1`,
    req.params.contactId,
    req.params.id,
  ))[0];
  if (!before) return res.status(404).json({ error: "Contact not found" });

  const fields = Object.entries(body.data).filter(([, value]) => value !== undefined);
  if (fields.length > 0) {
    const assignments = fields.map(([key], index) => `"${key}" = $${index + 1}`);
    const values = fields.map(([, value]) => value ?? null);
    values.push(req.params.contactId, req.params.id);
    await prisma.$executeRawUnsafe(
      `UPDATE "CompanyClientContact"
       SET ${assignments.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $${values.length - 1} AND "companyId" = $${values.length}`,
      ...values,
    );
  }

  const updated = (await prisma.$queryRawUnsafe(`SELECT * FROM "CompanyClientContact" WHERE "id" = $1`, req.params.contactId))[0];
  await audit(req, "COMPANY_CLIENT_CONTACT_UPDATE", "CompanyClientContact", req.params.contactId, before, updated);
  res.json(updated);
});

companyRoutes.delete("/:id/client-contacts/:contactId", async (req, res) => {
  const before = (await prisma.$queryRawUnsafe(
    `SELECT * FROM "CompanyClientContact" WHERE "id" = $1 AND "companyId" = $2 LIMIT 1`,
    req.params.contactId,
    req.params.id,
  ))[0];
  if (!before) return res.status(404).json({ error: "Contact not found" });

  await prisma.$executeRawUnsafe(`DELETE FROM "CompanyClientContact" WHERE "id" = $1 AND "companyId" = $2`, req.params.contactId, req.params.id);
  await audit(req, "COMPANY_CLIENT_CONTACT_DELETE", "CompanyClientContact", req.params.contactId, before, undefined);
  res.json({ ok: true });
});
