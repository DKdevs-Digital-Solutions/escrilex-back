import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

const ChecklistTypeEnum = z.enum(["ENTRADA","SAIDA"]);
const DueRuleTypeEnum = z.enum(["OFFSET_DAYS","DAY_OF_NEXT_MONTH"]);


export const templateRoutes = Router();

// List templates (lightweight)
templateRoutes.get("/", async (_req, res) => {
  const templates = await prisma.checklistTemplate.findMany({ orderBy: { createdAt: "desc" } });
  res.json(templates);
});


// Get default (active latest) template for a given type (includes sections + items)
templateRoutes.get("/default/by-type/:type", async (req, res) => {
  const parsed = ChecklistTypeEnum.safeParse(req.params.type);
  if (!parsed.success) return res.status(400).json({ error: "Tipo inválido" });

  const t = await prisma.checklistTemplate.findFirst({
    where: { type: parsed.data, active: true },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
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
  const t = await prisma.checklistTemplate.findUnique({
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
  const body = z.object({ type: ChecklistTypeEnum, name: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const t = await prisma.checklistTemplate.create({ data: body.data });
  await audit(req, "TEMPLATE_CREATE", "ChecklistTemplate", t.id, undefined, t);
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

  const before = await prisma.checklistTemplate.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Template não encontrado" });

  const after = await prisma.checklistTemplate.update({ where: { id: req.params.id }, data: body.data });
  await audit(req, "TEMPLATE_UPDATE", "ChecklistTemplate", after.id, before, after);
  res.json(after);
});

// --- Sections ---

templateRoutes.post("/:id/sections", async (req, res) => {
  const body = z.object({ name: z.string().min(1), order: z.number().int().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const s = await prisma.checklistTemplateSection.create({
    data: { templateId: req.params.id, name: body.data.name, order: body.data.order ?? 0 },
  });
  await audit(req, "TEMPLATE_SECTION_CREATE", "ChecklistTemplateSection", s.id, undefined, s);
  res.status(201).json(s);
});

templateRoutes.put("/sections/:sectionId", async (req, res) => {
  const body = z.object({ name: z.string().min(1).optional(), order: z.number().int().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.checklistTemplateSection.findUnique({ where: { id: req.params.sectionId } });
  if (!before) return res.status(404).json({ error: "Seção não encontrada" });

  const after = await prisma.checklistTemplateSection.update({ where: { id: req.params.sectionId }, data: body.data });
  await audit(req, "TEMPLATE_SECTION_UPDATE", "ChecklistTemplateSection", after.id, before, after);
  res.json(after);
});

templateRoutes.delete("/sections/:sectionId", async (req, res) => {
  const before = await prisma.checklistTemplateSection.findUnique({
    where: { id: req.params.sectionId },
    include: { items: true },
  });
  if (!before) return res.status(404).json({ error: "Seção não encontrada" });

  await prisma.checklistTemplateItem.deleteMany({ where: { sectionId: req.params.sectionId } });
  await prisma.checklistTemplateSection.delete({ where: { id: req.params.sectionId } });

  await audit(req, "TEMPLATE_SECTION_DELETE", "ChecklistTemplateSection", before.id, before, undefined);
  res.json({ ok: true });
});

// --- Items ---

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
  const it = await prisma.checklistTemplateItem.create({
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

  await audit(req, "TEMPLATE_ITEM_CREATE", "ChecklistTemplateItem", it.id, undefined, it);
  res.status(201).json(it);
});

templateRoutes.put("/items/:itemId", async (req, res) => {
  const body = itemSchema.partial().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.checklistTemplateItem.findUnique({ where: { id: req.params.itemId } });
  if (!before) return res.status(404).json({ error: "Item não encontrado" });

  const after = await prisma.checklistTemplateItem.update({
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

  await audit(req, "TEMPLATE_ITEM_UPDATE", "ChecklistTemplateItem", after.id, before, after);
  res.json(after);
});

templateRoutes.delete("/items/:itemId", async (req, res) => {
  const before = await prisma.checklistTemplateItem.findUnique({ where: { id: req.params.itemId } });
  if (!before) return res.status(404).json({ error: "Item não encontrado" });

  await prisma.checklistTemplateItem.delete({ where: { id: req.params.itemId } });
  await audit(req, "TEMPLATE_ITEM_DELETE", "ChecklistTemplateItem", before.id, before, undefined);
  res.json({ ok: true });
});
