import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";
import { sendMail } from "../email.js";
import { RoleName } from "../auth.js";
import XLSX from "xlsx";

export const companyRoutes = Router();

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

function hasAnyRole(req, roles) {
  return (req.user?.roles || []).some((r) => roles.includes(r));
}

function ownCompaniesWhere(req) {
  if (hasAnyRole(req, [RoleName.ADMIN, RoleName.GESTOR_EMPRESA])) return {};
  return { responsibles: { some: { userId: req.user.id } } };
}

const emptyToNull = (value) => (value === "" || value === null ? null : value);
const nullableString = z.preprocess(emptyToNull, z.string().nullable().optional());
const nullableDate = z.preprocess(emptyToNull, z.coerce.date().nullable().optional());
const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = parseBooleanParam(value);
  return parsed === undefined ? value : parsed;
}, z.boolean().optional());
const nullableInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return value === undefined ? undefined : null;
  return value;
}, z.coerce.number().int().nullable().optional());
const cnpjString = z.preprocess((value) => normalizeCnpj(value), z.string().min(8));

const companyWritableFields = [
  "cnpj", "razaoSocial", "nomeFantasia", "dataCadastro", "cod", "filial", "grupo", "tributacao", "ieAtual",
  "dataTributacao", "motivoEntrada", "situacao", "status", "dataSituacao", "ramo", "consultoria", "banco",
  "perfil", "perfilComercial", "licitacao", "responsavelComercial", "matrizFilial", "observacoes", "reunioesFechamentos",
  "fechamentoContabil", "analiseCompliance", "cobrancaServExtras", "complexidadeFiscal", "complexidadeContabil",
  "informacoesNegociosMarketing", "dataEntrada", "dataSaida", "dataEntradaFiscal", "dataSaidaFiscal", "dataEntradaContabil",
  "dataSaidaContabil", "dataEntradaFolha", "dataSaidaFolha", "dataEntradaConsultoria", "dataSaidaConsultoria",
  "dataInicioCobranca", "dataFimCobranca", "dataInicioCobrancaFiscal", "dataFimCobrancaFiscal",
  "dataInicioCobrancaContabil", "dataFimCobrancaContabil", "dataInicioCobrancaFolha", "dataFimCobrancaFolha",
  "dataInicioCobrancaConsultoria", "dataFimCobrancaConsultoria", "motivoSaidaResumo", "motivoSaida", "qtdeInicialFolha",
  "prefeituraLogin", "prefeituraSenha", "sefazLogin", "sefazSenha", "active",
];

const companyBaseSchema = z.object({
  cnpj: cnpjString,
  razaoSocial: nullableString,
  nomeFantasia: nullableString,
  dataCadastro: nullableDate,
  cod: nullableString,
  filial: nullableString,
  grupo: nullableString,
  tributacao: nullableString,
  ieAtual: nullableString,
  dataTributacao: nullableDate,
  motivoEntrada: nullableString,
  situacao: nullableString,
  status: nullableString,
  dataSituacao: nullableDate,
  ramo: nullableString,
  consultoria: nullableString,
  banco: nullableString,
  perfil: nullableString,
  perfilComercial: nullableString,
  licitacao: nullableString,
  responsavelComercial: nullableString,
  matrizFilial: nullableString,
  observacoes: nullableString,
  reunioesFechamentos: nullableString,
  fechamentoContabil: nullableString,
  analiseCompliance: nullableString,
  cobrancaServExtras: optionalBoolean,
  complexidadeFiscal: nullableString,
  complexidadeContabil: nullableString,
  informacoesNegociosMarketing: nullableString,
  dataEntrada: nullableDate,
  dataSaida: nullableDate,
  dataEntradaFiscal: nullableDate,
  dataSaidaFiscal: nullableDate,
  dataEntradaContabil: nullableDate,
  dataSaidaContabil: nullableDate,
  dataEntradaFolha: nullableDate,
  dataSaidaFolha: nullableDate,
  dataEntradaConsultoria: nullableDate,
  dataSaidaConsultoria: nullableDate,
  dataInicioCobranca: nullableDate,
  dataFimCobranca: nullableDate,
  dataInicioCobrancaFiscal: nullableDate,
  dataFimCobrancaFiscal: nullableDate,
  dataInicioCobrancaContabil: nullableDate,
  dataFimCobrancaContabil: nullableDate,
  dataInicioCobrancaFolha: nullableDate,
  dataFimCobrancaFolha: nullableDate,
  dataInicioCobrancaConsultoria: nullableDate,
  dataFimCobrancaConsultoria: nullableDate,
  motivoSaidaResumo: nullableString,
  motivoSaida: nullableString,
  qtdeInicialFolha: nullableInt,
  qtdeFolha: nullableInt,
  qtde_folha: nullableInt,
  "QTDE Folha": nullableInt,
  prefeituraLogin: nullableString,
  prefeituraSenha: nullableString,
  sefazLogin: nullableString,
  sefazSenha: nullableString,
  active: optionalBoolean,
});

const companyInclude = {
  responsibles: { include: { sector: true, user: true } },
  partners: true,
  clientContacts: true,
  accessCredentials: true,
};

function pickDefined(data, fields) {
  return fields.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});
}

function buildCompanyWriteData(data, req) {
  const normalized = { ...data };
  if (normalized.qtdeInicialFolha === undefined) {
    for (const alias of ["qtdeFolha", "qtde_folha", "QTDE Folha"]) {
      if (normalized[alias] !== undefined) normalized.qtdeInicialFolha = normalized[alias];
    }
  }
  if (normalized.status === undefined && normalized.situacao !== undefined) normalized.status = normalized.situacao;
  if (normalized.situacao === undefined && normalized.status !== undefined) normalized.situacao = normalized.status;
  if (normalized.perfilComercial === undefined && normalized.perfil !== undefined) normalized.perfilComercial = normalized.perfil;
  if (normalized.perfil === undefined && normalized.perfilComercial !== undefined) normalized.perfil = normalized.perfilComercial;

  const writeData = pickDefined(normalized, companyWritableFields);
  if (writeData.dataCadastro === null) delete writeData.dataCadastro;

  if (writeData.active !== undefined) writeData.inactivatedAt = writeData.active ? null : new Date();
  if (writeData.status === "Bloqueado" || writeData.situacao === "Bloqueado") {
    writeData.blockedAt = new Date();
    writeData.blockedBy = req.user.id;
  }
  if (writeData.status === "Encerrado" || writeData.situacao === "Encerrado") {
    writeData.active = false;
    writeData.inactivatedAt = new Date();
    if (!writeData.dataSaida) writeData.dataSaida = new Date();
  }
  return writeData;
}

function validateStatusRules(nextData) {
  const status = nextData.status ?? nextData.situacao;
  if (status && !STATUS_OPTIONS.includes(status)) return `Status inválido. Use: ${STATUS_OPTIONS.join(", ")}`;
  if (status === "Encerrado") {
    const required = [
      "dataSaidaFiscal", "dataSaidaContabil", "dataSaidaFolha", "dataSaidaConsultoria",
      "dataFimCobrancaFiscal", "dataFimCobrancaContabil", "dataFimCobrancaFolha", "dataFimCobrancaConsultoria", "motivoSaida",
    ];
    const missing = required.filter((field) => !nextData[field]);
    if (missing.length) return `Para status Encerrado, informe: ${missing.join(", ")}`;
  }
  return null;
}

function diffFields(before, after) {
  const changes = [];
  for (const field of companyWritableFields) {
    const a = before?.[field] instanceof Date ? before[field].toISOString() : before?.[field] ?? null;
    const b = after?.[field] instanceof Date ? after[field].toISOString() : after?.[field] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ field, before: a, after: b });
  }
  return changes;
}

async function notifyCompanyResponsibles(companyId, subject, text) {
  const rows = await prisma.companySectorResponsible.findMany({
    where: { companyId },
    include: { user: true },
  });
  const emails = Array.from(new Set(rows.map((r) => r.user.email).filter(Boolean)));
  if (!emails.length) return;
  await sendMail(emails.join(","), subject, text);
}

async function assertCanAccessCompany(req, companyId) {
  if (hasAnyRole(req, [RoleName.ADMIN, RoleName.GESTOR_EMPRESA])) return true;
  const count = await prisma.companySectorResponsible.count({ where: { companyId, userId: req.user.id } });
  return count > 0;
}

companyRoutes.get("/", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();
  const normalizedSearchCnpj = normalizeCnpj(search);
  const active = parseBooleanParam(req.query.active);
  const companies = await prisma.company.findMany({
    where: {
      ...ownCompaniesWhere(req),
      ...(active === undefined ? {} : { active }),
      ...(status ? { OR: [{ status }, { situacao: status }] } : {}),
      ...(search ? { OR: [
        { cnpj: { contains: search } },
        ...(normalizedSearchCnpj && normalizedSearchCnpj !== search ? [{ cnpj: { contains: normalizedSearchCnpj } }] : []),
        { razaoSocial: { contains: search, mode: "insensitive" } },
        { nomeFantasia: { contains: search, mode: "insensitive" } },
        { cod: { contains: search, mode: "insensitive" } },
        { grupo: { contains: search, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: [{ cod: "asc" }, { createdAt: "desc" }],
  });
  res.json(companies);
});

companyRoutes.post("/", async (req, res) => {
  const body = companyBaseSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const createData = buildCompanyWriteData(body.data, req);
  const err = validateStatusRules(createData);
  if (err) return res.status(400).json({ error: err });
  const company = await prisma.company.create({ data: createData, include: companyInclude });
  await audit(req, "COMPANY_CREATE", "Company", company.id, undefined, company);
  res.status(201).json(company);
});


companyRoutes.get("/export", async (req, res) => {
  const format = String(req.query.format || "xlsx").toLowerCase();
  const search = String(req.query.search || "").trim();
  const status = String(req.query.status || "").trim();
  const normalizedSearchCnpj = normalizeCnpj(search);
  const rows = await prisma.company.findMany({
    where: {
      ...ownCompaniesWhere(req),
      ...(status ? { OR: [{ status }, { situacao: status }] } : {}),
      ...(search ? { OR: [
        { cnpj: { contains: search } },
        ...(normalizedSearchCnpj && normalizedSearchCnpj !== search ? [{ cnpj: { contains: normalizedSearchCnpj } }] : []),
        { razaoSocial: { contains: search, mode: "insensitive" } },
        { nomeFantasia: { contains: search, mode: "insensitive" } },
        { cod: { contains: search, mode: "insensitive" } },
        { grupo: { contains: search, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: [{ cod: "asc" }, { createdAt: "desc" }],
  });
  const data = rows.map((c) => ({
    Código: c.cod, Empresa: c.razaoSocial || c.nomeFantasia, "CNPJ/CPF": c.cnpj, Grupo: c.grupo, "Matriz/Filial": c.matrizFilial || c.filial, Tributação: c.tributacao, Ramo: c.ramo, Perfil: c.perfilComercial || c.perfil, Status: c.status || c.situacao, Entrada: c.dataEntrada, Saída: c.dataSaida, "Motivo da saída": c.motivoSaida || c.motivoSaidaResumo, "Qtde Folha": c.qtdeInicialFolha, Observações: c.observacoes,
  }));
  if (format === "csv") {
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=empresas.csv");
    return res.send(csv);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Empresas");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=empresas.xlsx");
  res.send(buffer);
});

companyRoutes.get("/responsibles/by-cnpj", async (req, res) => {
  const rawCnpj = String(req.query.cnpj || "").trim();
  const cnpj = normalizeCnpj(rawCnpj);
  if (!cnpj) return res.status(400).json({ error: "cnpj is required" });
  const company = await prisma.company.findFirst({
    where: { OR: [{ cnpj: rawCnpj }, { cnpj }, ...(cnpj.length >= 8 ? [{ cnpj: { contains: cnpj } }] : [])] },
    include: { responsibles: { include: { sector: true, user: true } } },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });
  if (!(await assertCanAccessCompany(req, company.id))) return res.status(403).json({ error: "Forbidden" });
  res.json({ cnpj: company.cnpj, companyId: company.id, razaoSocial: company.razaoSocial, responsibles: company.responsibles.map((r) => ({ sector: { id: r.sector.id, name: r.sector.name }, user: { id: r.user.id, name: r.user.name, email: r.user.email } })) });
});

companyRoutes.get("/:id", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const company = await prisma.company.findUnique({ where: { id: req.params.id }, include: companyInclude });
  if (!company) return res.status(404).json({ error: "Not found" });
  res.json(company);
});

companyRoutes.put("/:id", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = companyBaseSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  const updateData = buildCompanyWriteData(body.data, req);
  const nextData = { ...before, ...updateData };
  const err = validateStatusRules(nextData);
  if (err) return res.status(400).json({ error: err });
  const updated = await prisma.company.update({ where: { id: req.params.id }, data: updateData, include: companyInclude });
  const changes = diffFields(before, updated);
  await audit(req, "COMPANY_UPDATE", "Company", updated.id, before, { ...updated, changes });
  if (changes.length) {
    await notifyCompanyResponsibles(updated.id, `SGE - Alteração cadastral: ${updated.razaoSocial || updated.nomeFantasia || updated.cnpj}`, `Foram alterados campos da empresa.\n\n${changes.map((c) => `${c.field}: ${c.before ?? ""} -> ${c.after ?? ""}`).join("\n")}`);
  }
  if (updateData.status === "Bloqueado" || updateData.situacao === "Bloqueado") {
    await notifyCompanyResponsibles(updated.id, `SGE - Empresa bloqueada: ${updated.razaoSocial || updated.cnpj}`, `A empresa foi marcada como Bloqueada em ${updated.blockedAt?.toISOString?.() || new Date().toISOString()} por ${req.user.email}.`);
  }
  res.json(updated);
});

companyRoutes.patch("/:id/status", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = z.object({ status: z.string().optional(), situacao: z.string().optional(), active: optionalBoolean }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  const status = body.data.status ?? body.data.situacao ?? (body.data.active === false ? "Encerrado" : "Ativo");
  const updateData = buildCompanyWriteData({ status, situacao: status, active: body.data.active }, req);
  const nextData = { ...before, ...updateData };
  const err = validateStatusRules(nextData);
  if (err) return res.status(400).json({ error: err });
  const updated = await prisma.company.update({ where: { id: req.params.id }, data: updateData });
  await audit(req, "COMPANY_STATUS_UPDATE", "Company", updated.id, before, updated);
  if (status === "Bloqueado") await notifyCompanyResponsibles(updated.id, `SGE - Empresa bloqueada: ${updated.razaoSocial || updated.cnpj}`, `A empresa foi bloqueada por ${req.user.email}.`);
  res.json(updated);
});

companyRoutes.delete("/:id", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.company.update({ where: { id: req.params.id }, data: { active: false, inactivatedAt: new Date(), status: "Encerrado", situacao: "Encerrado" } });
  await audit(req, "COMPANY_INACTIVATE", "Company", updated.id, before, updated);
  res.json(updated);
});

companyRoutes.get("/:id/checklists", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const type = String(req.query.type || "").trim();
  if (type && !["ENTRADA", "SAIDA"].includes(type)) return res.status(400).json({ error: "invalid type" });
  const runs = await prisma.checklistRun.findMany({
    where: { companyId: req.params.id, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, templateId: true, snapshotTemplateName: true, snapshotTemplateVersion: true, createdAt: true, anchorAt: true, items: { where: { status: "CONCLUIDO" }, orderBy: { doneAt: "asc" }, take: 1, select: { snapshotItemCode: true, snapshotItemDescription: true } } },
  });
  res.json(runs.map((r) => ({ id: r.id, type: r.type, template: { id: r.templateId, name: r.snapshotTemplateName ?? null, version: r.snapshotTemplateVersion ?? null }, firstDoneActionCode: r.items?.[0]?.snapshotItemCode ?? null, firstDoneActionText: r.items?.[0]?.snapshotItemDescription ?? null, createdAt: r.createdAt, anchorAt: r.anchorAt })));
});

companyRoutes.put("/:id/responsibles", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = z.object({ responsibles: z.array(z.object({ sectorId: z.string(), userId: z.string() })), reason: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const actorId = req.user.id;
  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: "Company not found" });
  const before = await prisma.companySectorResponsible.findMany({ where: { companyId: company.id }, include: { sector: true, user: true } });
  for (const r of body.data.responsibles) {
    const existing = await prisma.companySectorResponsible.findUnique({ where: { companyId_sectorId: { companyId: company.id, sectorId: r.sectorId } } });
    if (existing) {
      if (existing.userId === r.userId) continue;
      await prisma.companySectorResponsibleHistory.updateMany({ where: { companyId: company.id, sectorId: r.sectorId, endAt: null }, data: { endAt: new Date() } });
      await prisma.companySectorResponsible.update({ where: { id: existing.id }, data: { userId: r.userId, assignedAt: new Date(), assignedBy: actorId } });
    } else {
      await prisma.companySectorResponsible.create({ data: { companyId: company.id, sectorId: r.sectorId, userId: r.userId, assignedBy: actorId } });
    }
    await prisma.companySectorResponsibleHistory.create({ data: { companyId: company.id, sectorId: r.sectorId, userId: r.userId, startAt: new Date(), changedBy: actorId, reason: body.data.reason } });
  }
  const after = await prisma.companySectorResponsible.findMany({ where: { companyId: company.id }, include: { sector: true, user: true } });
  await audit(req, "COMPANY_RESPONSIBLES_SET", "Company", company.id, before, after);
  await notifyCompanyResponsibles(company.id, `SGE - Responsáveis alterados: ${company.razaoSocial || company.cnpj}`, `A carteira/responsáveis da empresa foram alterados por ${req.user.email}.`);
  res.json({ ok: true });
});

companyRoutes.get("/:id/partners", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  res.json(await prisma.companyPartner.findMany({ where: { companyId: req.params.id }, orderBy: { createdAt: "desc" } }));
});

companyRoutes.post("/:id/partners", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = z.object({ nomeCompleto: z.string().min(1), whatsapp: nullableString, email: z.string().email().optional().nullable(), telefoneEmpresa: nullableString, dataNascimento: nullableDate, outros: nullableString }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const partner = await prisma.companyPartner.create({ data: { companyId: req.params.id, ...body.data } });
  await audit(req, "COMPANY_PARTNER_CREATE", "CompanyPartner", partner.id, undefined, partner);
  res.status(201).json(partner);
});

companyRoutes.put("/:id/partners/:partnerId", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = z.object({ nomeCompleto: z.string().min(1).optional(), whatsapp: nullableString, email: z.string().email().optional().nullable(), telefoneEmpresa: nullableString, dataNascimento: nullableDate, outros: nullableString }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const existing = await prisma.companyPartner.findFirst({ where: { id: req.params.partnerId, companyId: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Partner not found" });
  const updated = await prisma.companyPartner.update({ where: { id: req.params.partnerId }, data: body.data });
  await audit(req, "COMPANY_PARTNER_UPDATE", "CompanyPartner", updated.id, existing, updated);
  res.json(updated);
});

companyRoutes.delete("/:id/partners/:partnerId", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const existing = await prisma.companyPartner.findFirst({ where: { id: req.params.partnerId, companyId: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Partner not found" });
  await prisma.companyPartner.delete({ where: { id: req.params.partnerId } });
  await audit(req, "COMPANY_PARTNER_DELETE", "CompanyPartner", existing.id, existing, undefined);
  res.json({ ok: true });
});

const contactSchema = z.object({
  area: z.string().min(1),
  nome: nullableString,
  // Campo legado aceito para compatibilidade com front antigo.
  email: z.string().email().optional().nullable(),
  // Novo campo: permite 1+n e-mails no responsável interno do cliente.
  emails: z.array(z.string().email()).optional(),
});

function normalizeContactEmails(data, existing = null) {
  const hasEmails = Array.isArray(data.emails);
  const rawEmails = hasEmails
    ? data.emails
    : (data.email ? [data.email] : (existing?.emails?.length ? existing.emails : []));

  const emails = [...new Set(rawEmails.map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
  return { ...data, emails, email: emails[0] ?? data.email ?? null };
}

function formatClientContact(row) {
  const emails = row.emails?.length ? row.emails : (row.email ? [row.email] : []);
  return { ...row, email: row.email ?? emails[0] ?? null, emails };
}

companyRoutes.get("/:id/client-contacts", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const rows = await prisma.companyClientContact.findMany({ where: { companyId: req.params.id }, orderBy: [{ area: "asc" }, { createdAt: "desc" }] });
  res.json(rows.map(formatClientContact));
});
companyRoutes.post("/:id/client-contacts", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = contactSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const row = await prisma.companyClientContact.create({ data: { companyId: req.params.id, ...normalizeContactEmails(body.data) } });
  await audit(req, "COMPANY_CLIENT_CONTACT_CREATE", "CompanyClientContact", row.id, undefined, row);
  res.status(201).json(formatClientContact(row));
});
companyRoutes.put("/:id/client-contacts/:contactId", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = contactSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const before = await prisma.companyClientContact.findFirst({ where: { id: req.params.contactId, companyId: req.params.id } });
  if (!before) return res.status(404).json({ error: "Contact not found" });
  const row = await prisma.companyClientContact.update({ where: { id: req.params.contactId }, data: normalizeContactEmails(body.data, before) });
  await audit(req, "COMPANY_CLIENT_CONTACT_UPDATE", "CompanyClientContact", row.id, before, row);
  res.json(formatClientContact(row));
});
companyRoutes.delete("/:id/client-contacts/:contactId", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const before = await prisma.companyClientContact.findFirst({ where: { id: req.params.contactId, companyId: req.params.id } });
  if (!before) return res.status(404).json({ error: "Contact not found" });
  await prisma.companyClientContact.delete({ where: { id: req.params.contactId } });
  await audit(req, "COMPANY_CLIENT_CONTACT_DELETE", "CompanyClientContact", before.id, before, undefined);
  res.json({ ok: true });
});

const credentialSchema = z.object({ service: z.string().min(1), login: nullableString, password: nullableString });
companyRoutes.get("/:id/access-credentials", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  res.json(await prisma.companyAccessCredential.findMany({ where: { companyId: req.params.id }, orderBy: { service: "asc" } }));
});
companyRoutes.put("/:id/access-credentials", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const body = z.object({ credentials: z.array(credentialSchema) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const rows = [];
  for (const c of body.data.credentials) {
    rows.push(await prisma.companyAccessCredential.upsert({
      where: { companyId_service: { companyId: req.params.id, service: c.service } },
      create: { companyId: req.params.id, ...c },
      update: { login: c.login, password: c.password },
    }));
  }
  await audit(req, "COMPANY_ACCESS_CREDENTIALS_UPSERT", "Company", req.params.id, undefined, rows.map((r) => ({ ...r, password: r.password ? "***" : null })));
  res.json(rows.map((r) => ({ ...r, password: r.password ? "***" : null })));
});

companyRoutes.get("/:id/history", async (req, res) => {
  if (!(await assertCanAccessCompany(req, req.params.id))) return res.status(403).json({ error: "Forbidden" });
  const rows = await prisma.auditLog.findMany({ where: { OR: [{ entity: "Company", entityId: req.params.id }, { entity: { startsWith: "Company" }, afterJson: { path: ["companyId"], equals: req.params.id } }] }, include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows);
});
