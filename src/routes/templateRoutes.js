import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

const ProcessTypeEnum = z.enum(["ENTRADA","SAIDA"]);
const DueRuleTypeEnum = z.enum(["OFFSET_DAYS","DAY_OF_NEXT_MONTH"]);


export const templateRoutes = Router();

// List templates (lightweight)
templateRoutes.get("/", async (_req, res) => {
  const templates = await prisma.processTemplate.findMany({ orderBy: { createdAt: "desc" } });
  res.json(templates);
});


// Get default (active latest) template for a given type (includes sections + items)
templateRoutes.get("/default/by-type/:type", async (req, res) => {
  const parsed = ProcessTypeEnum.safeParse(req.params.type);
  if (!parsed.success) return res.status(400).json({ error: "Tipo inválido" });

  const t = await prisma.processTemplate.findFirst({
    where: { type: parsed.data, active: true },
    orderBy: [{ createdAt: "desc" }],
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { sector: true } } },
      },
    },
  });
  if (!t) return res.status(404).json({ error: "Template não encontrado" });
  res.json(t);
});

// Get full template (sections + items)
templateRoutes.get("/:id", async (req, res) => {
  const t = await prisma.processTemplate.findUnique({
    where: { id: req.params.id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" }, include: { sector: true } } },
      },
    },
  });
  if (!t) return res.status(404).json({ error: "Template não encontrado" });
  res.json(t);
});

// Create template
templateRoutes.post("/", async (req, res) => {
  const body = z.object({ type: ProcessTypeEnum, name: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const t = await prisma.processTemplate.create({ data: body.data });
  await audit(req, "TEMPLATE_CREATE", "ProcessTemplate", t.id, undefined, t);
  res.status(201).json(t);
});

// Update template (admin/gestor)
templateRoutes.put("/:id", async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      active: z.boolean().optional(),
      version: z.number().int().min(1).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.processTemplate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Template não encontrado" });

  const after = await prisma.processTemplate.update({ where: { id: req.params.id }, data: body.data });
  await audit(req, "TEMPLATE_UPDATE", "ProcessTemplate", after.id, before, after);
  res.json(after);
});

// --- Sections ---

// Reordena as seções de um processo em lote. Recebe a lista de ids na nova ordem;
// o índice no array vira o valor de "order" (base 1). A ordem das seções define
// a cascata de prazos no engine (cada seção conta a partir do fim da anterior).
templateRoutes.put("/:id/sections/reorder", async (req, res) => {
  const body = z.object({ order: z.array(z.string().min(1)).min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const sections = await prisma.processTemplateSection.findMany({
    where: { templateId: req.params.id },
    select: { id: true },
  });
  const validIds = new Set(sections.map((s) => s.id));
  const ordered = body.data.order.filter((id) => validIds.has(id));
  if (ordered.length !== sections.length) {
    return res.status(400).json({ error: "A lista de ordem não corresponde às seções do processo." });
  }

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.processTemplateSection.update({ where: { id }, data: { order: index + 1 } }),
    ),
  );

  await audit(req, "TEMPLATE_SECTIONS_REORDER", "ProcessTemplate", req.params.id, undefined, { order: ordered });
  res.json({ ok: true });
});

templateRoutes.post("/:id/sections", async (req, res) => {
  const body = z.object({ name: z.string().min(1), order: z.number().int().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const s = await prisma.processTemplateSection.create({
    data: { templateId: req.params.id, name: body.data.name, order: body.data.order ?? 0 },
  });
  await audit(req, "TEMPLATE_SECTION_CREATE", "ProcessTemplateSection", s.id, undefined, s);
  res.status(201).json(s);
});

templateRoutes.put("/sections/:sectionId", async (req, res) => {
  const body = z.object({ name: z.string().min(1).optional(), order: z.number().int().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.processTemplateSection.findUnique({ where: { id: req.params.sectionId } });
  if (!before) return res.status(404).json({ error: "Seção não encontrada" });

  const after = await prisma.processTemplateSection.update({ where: { id: req.params.sectionId }, data: body.data });
  await audit(req, "TEMPLATE_SECTION_UPDATE", "ProcessTemplateSection", after.id, before, after);
  res.json(after);
});

templateRoutes.delete("/sections/:sectionId", async (req, res) => {
  const before = await prisma.processTemplateSection.findUnique({
    where: { id: req.params.sectionId },
    include: { items: true },
  });
  if (!before) return res.status(404).json({ error: "Seção não encontrada" });

  await prisma.processTemplateItem.deleteMany({ where: { sectionId: req.params.sectionId } });
  await prisma.processTemplateSection.delete({ where: { id: req.params.sectionId } });

  await audit(req, "TEMPLATE_SECTION_DELETE", "ProcessTemplateSection", before.id, before, undefined);
  res.json({ ok: true });
});

// --- Items ---

// Reordena os itens de uma seção em lote. O índice no array vira "order" (base 1).
// A ordem dos itens define a sequência dentro da seção (e a ordem de exibição).
templateRoutes.put("/sections/:sectionId/items/reorder", async (req, res) => {
  const body = z.object({ order: z.array(z.string().min(1)).min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const items = await prisma.processTemplateItem.findMany({
    where: { sectionId: req.params.sectionId },
    select: { id: true },
  });
  const validIds = new Set(items.map((i) => i.id));
  const ordered = body.data.order.filter((id) => validIds.has(id));
  if (ordered.length !== items.length) {
    return res.status(400).json({ error: "A lista de ordem não corresponde aos itens da seção." });
  }

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.processTemplateItem.update({ where: { id }, data: { order: index + 1 } }),
    ),
  );

  await audit(req, "TEMPLATE_ITEMS_REORDER", "ProcessTemplateSection", req.params.sectionId, undefined, { order: ordered });
  res.json({ ok: true });
});

const itemSchema = z.object({
  sectionId: z.string().min(1),
  code: z.string().optional().nullable(),
  description: z.string().min(1),
  order: z.number().int().optional(),
  sectorId: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
  dueRuleType: DueRuleTypeEnum.optional(),
  dueRuleParam: z.number().int().optional().nullable(),
  offsetDaysFromAnchor: z.number().int().optional().nullable(),
});

templateRoutes.post("/:id/items", async (req, res) => {
  const body = itemSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  // Basic guard: only allow editing templates to admin/gestor (already enforced at router level)
  const it = await prisma.processTemplateItem.create({
    data: {
      sectionId: body.data.sectionId,
      code: body.data.code ?? undefined,
      description: body.data.description,
      order: body.data.order ?? 0,
      sectorId: body.data.sectorId ?? undefined,
      isRequired: body.data.isRequired ?? false,
      dueRuleType: body.data.dueRuleType ?? undefined,
      dueRuleParam: body.data.dueRuleParam ?? undefined,
      offsetDaysFromAnchor: body.data.offsetDaysFromAnchor ?? undefined,
    },
  });

  await audit(req, "TEMPLATE_ITEM_CREATE", "ProcessTemplateItem", it.id, undefined, it);
  res.status(201).json(it);
});

templateRoutes.put("/items/:itemId", async (req, res) => {
  const body = itemSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.processTemplateItem.findUnique({ where: { id: req.params.itemId } });
  if (!before) return res.status(404).json({ error: "Item não encontrado" });

  const after = await prisma.processTemplateItem.update({
    where: { id: req.params.itemId },
    data: {
      sectionId: body.data.sectionId,
      code: body.data.code === null ? null : body.data.code,
      description: body.data.description,
      order: body.data.order,
      sectorId: body.data.sectorId === null ? null : body.data.sectorId,
      isRequired: body.data.isRequired,
      dueRuleType: body.data.dueRuleType,
      dueRuleParam: body.data.dueRuleParam === null ? null : body.data.dueRuleParam,
      offsetDaysFromAnchor: body.data.offsetDaysFromAnchor === null ? null : body.data.offsetDaysFromAnchor,
    },
  });

  await audit(req, "TEMPLATE_ITEM_UPDATE", "ProcessTemplateItem", after.id, before, after);
  res.json(after);
});

templateRoutes.delete("/items/:itemId", async (req, res) => {
  const before = await prisma.processTemplateItem.findUnique({ where: { id: req.params.itemId } });
  if (!before) return res.status(404).json({ error: "Item não encontrado" });

  await prisma.processTemplateItem.delete({ where: { id: req.params.itemId } });
  await audit(req, "TEMPLATE_ITEM_DELETE", "ProcessTemplateItem", before.id, before, undefined);
  res.json({ ok: true });
});
