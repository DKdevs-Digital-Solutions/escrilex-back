import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

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
  qtdeInicialFolha: nullableInt,
  qtdeFolha: nullableInt,
  qtde_folha: nullableInt,
  "QTDE Folha": nullableInt,
  active: optionalBoolean,
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

const companyInclude = { responsibles: { include: { sector: true, user: true } } };


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
  res.json(company);
});

companyRoutes.put("/:id", async (req, res) => {
  const body = companyBaseSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const updateData = buildCompanyWriteData(body.data);

  const updated = await prisma.company.update({
    where: { id: req.params.id },
    data: updateData,
    include: companyInclude,
  });

  await audit(req, "COMPANY_UPDATE", "Company", updated.id, before, updated);
  res.json(updated);
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

  const updated = await prisma.company.update({
    where: { id: req.params.id },
    data: {
      active,
      inactivatedAt: active ? null : new Date(),
      ...(status ? { situacao: status, dataSituacao: new Date() } : {}),
    },
  });

  await audit(req, active ? "COMPANY_STATUS_UPDATE" : "COMPANY_INACTIVATE", "Company", updated.id, before, updated);
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

companyRoutes.get("/:id/checklists", async (req, res) => {
  const type = String(req.query.type || "").trim();
  const companyId = req.params.id;
  if (type && !["ENTRADA", "SAIDA"].includes(type)) return res.status(400).json({ error: "invalid type" });

  const runs = await prisma.checklistRun.findMany({
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

  await audit(req, "COMPANY_RESPONSIBLES_SET", "Company", company.id, before, {
    input: body.data,
    updated: updated.map(formatResponsibleRow),
  });

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
