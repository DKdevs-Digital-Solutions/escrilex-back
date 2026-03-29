import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

export const companyRoutes = Router();

companyRoutes.get("/", async (req, res) => {
  const search = (req.query.search || "").trim();
  const companies = await prisma.company.findMany({
    where: search ? { OR: [
      { cnpj: { contains: search } },
      { razaoSocial: { contains: search, mode: "insensitive" } },
      { nomeFantasia: { contains: search, mode: "insensitive" } },
    ] } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(companies);
});

companyRoutes.post("/", async (req, res) => {
  const body = z.object({
    cnpj: z.string().min(8),
    razaoSocial: z.string().optional(),
    nomeFantasia: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const company = await prisma.company.create({ data: body.data });
  await audit(req, "COMPANY_CREATE", "Company", company.id, undefined, company);
  res.status(201).json(company);
});

companyRoutes.get("/:id", async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id },
    include: { responsibles: { include: { sector: true, user: true } } },
  });
  if (!company) return res.status(404).json({ error: "Not found" });
  res.json(company);
});

companyRoutes.get("/:id/checklists", async (req, res) => {
  const type = (req.query.type || "").toString().trim();
  const companyId = req.params.id;
  if (type && !["ENTRADA", "SAIDA"].includes(type)) return res.status(400).json({ error: "invalid type" });
  const where = {
    companyId,
    ...(type ? { type } : {}),
  };

  const runs = await prisma.checklistRun.findMany({
    where,
    orderBy: { createdAt: "desc" },
    // IMPORTANT: run history must be immutable.
    // So we do NOT join template/templateItem here (they can change over time).
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

  res.json(runs.map((r) => ({
    id: r.id,
    type: r.type,
    // Keep template info for internal/debug purposes, but UI should not rely on it.
    template: { id: r.templateId, name: r.snapshotTemplateName ?? null, version: r.snapshotTemplateVersion ?? null },
    firstDoneActionCode: r.items?.[0]?.snapshotItemCode ?? null,
    firstDoneActionText: r.items?.[0]?.snapshotItemDescription ?? null,
    createdAt: r.createdAt,
    anchorAt: r.anchorAt,
  })));
});

companyRoutes.put("/:id/responsibles", async (req, res) => {
  const body = z.object({
    responsibles: z.array(z.object({ sectorId: z.string(), userId: z.string() })),
    reason: z.string().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const actorId = req.user.id;

  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  for (const r of body.data.responsibles) {
    const existing = await prisma.companySectorResponsible.findUnique({
      where: { companyId_sectorId: { companyId: company.id, sectorId: r.sectorId } },
    });

    if (existing) {
      await prisma.companySectorResponsibleHistory.updateMany({
        where: { companyId: company.id, sectorId: r.sectorId, endAt: null },
        data: { endAt: new Date() },
      });
      await prisma.companySectorResponsible.update({
        where: { id: existing.id },
        data: { userId: r.userId, assignedAt: new Date(), assignedBy: actorId },
      });
    } else {
      await prisma.companySectorResponsible.create({
        data: { companyId: company.id, sectorId: r.sectorId, userId: r.userId, assignedBy: actorId },
      });
      await prisma.companySectorResponsibleHistory.updateMany({
        where: { companyId: company.id, sectorId: r.sectorId, endAt: null },
        data: { endAt: new Date() },
      });
    }

    await prisma.companySectorResponsibleHistory.create({
      data: {
        companyId: company.id,
        sectorId: r.sectorId,
        userId: r.userId,
        startAt: new Date(),
        changedBy: actorId,
        reason: body.data.reason,
      },
    });
  }

  await audit(req, "COMPANY_RESPONSIBLES_SET", "Company", company.id, undefined, body.data);
  res.json({ ok: true });
});

companyRoutes.get("/responsibles/by-cnpj", async (req, res) => {
  const cnpj = (req.query.cnpj || "").trim();
  if (!cnpj) return res.status(400).json({ error: "cnpj is required" });

  const company = await prisma.company.findUnique({
    where: { cnpj },
    include: { responsibles: { include: { sector: true, user: true } } },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });

  res.json({
    cnpj: company.cnpj,
    companyId: company.id,
    razaoSocial: company.razaoSocial,
    responsibles: company.responsibles.map((r) => ({
      sector: { id: r.sector.id, name: r.sector.name },
      user: { id: r.user.id, name: r.user.name, email: r.user.email },
    })),
  });
});

// ---- SOCIOS (CompanyPartner) ----

companyRoutes.get("/:id/partners", async (req, res) => {
  const companyId = req.params.id;

  const partners = await prisma.companyPartner.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  res.json(partners);
});

companyRoutes.post("/:id/partners", async (req, res) => {
  const companyId = req.params.id;

  const body = z.object({
    nomeCompleto: z.string().min(1),
    whatsapp: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    telefoneEmpresa: z.string().optional().nullable(),
    dataNascimento: z.coerce.date().optional().nullable(),
    outros: z.string().optional().nullable(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const partner = await prisma.companyPartner.create({
    data: { companyId, ...body.data },
  });

  await audit(req, "COMPANY_PARTNER_CREATE", "CompanyPartner", partner.id, undefined, partner);
  res.status(201).json(partner);
});

companyRoutes.put("/:id/partners/:partnerId", async (req, res) => {
  const companyId = req.params.id;
  const partnerId = req.params.partnerId;

  const body = z.object({
    nomeCompleto: z.string().min(1).optional(),
    whatsapp: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    telefoneEmpresa: z.string().optional().nullable(),
    dataNascimento: z.coerce.date().optional().nullable(),
    outros: z.string().optional().nullable(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.companyPartner.findFirst({
    where: { id: partnerId, companyId },
  });
  if (!existing) return res.status(404).json({ error: "Partner not found" });

  const updated = await prisma.companyPartner.update({
    where: { id: partnerId },
    data: body.data,
  });

  await audit(req, "COMPANY_PARTNER_UPDATE", "CompanyPartner", updated.id, existing, updated);
  res.json(updated);
});

companyRoutes.delete("/:id/partners/:partnerId", async (req, res) => {
  const companyId = req.params.id;
  const partnerId = req.params.partnerId;

  const existing = await prisma.companyPartner.findFirst({
    where: { id: partnerId, companyId },
  });
  if (!existing) return res.status(404).json({ error: "Partner not found" });

  await prisma.companyPartner.delete({ where: { id: partnerId } });
  await audit(req, "COMPANY_PARTNER_DELETE", "CompanyPartner", existing.id, existing, undefined);

  res.json({ ok: true });
});