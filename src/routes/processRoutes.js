import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";
import { sendTeamsNotification } from "../teams.js";

const ProcessTypeEnum = z.enum(["ENTRADA","SAIDA"]);
// We use CONCLUIDO as the canonical "done" status.
// FEITO is kept only for backward compatibility with older frontends/databases.
const ItemStatusEnum = z.enum(["PENDENTE","EM_ANDAMENTO","CONCLUIDO","NA","FEITO"]);

function normalizeStatus(s) {
  if (!s) return s;
  return s === "FEITO" ? "CONCLUIDO" : s;
}


function computeDueDate(anchorAt, itemSnapshot) {
  if (!anchorAt) return null;

  const ruleType = itemSnapshot.snapshotDueRuleType || "OFFSET_DAYS";
  const param =
    typeof itemSnapshot.snapshotDueRuleParam === "number"
      ? itemSnapshot.snapshotDueRuleParam
      : typeof itemSnapshot.snapshotOffsetDaysFromAnchor === "number"
        ? itemSnapshot.snapshotOffsetDaysFromAnchor
        : null;

  if (ruleType === "DAY_OF_NEXT_MONTH") {
    if (typeof param !== "number") return null;
    const base = new Date(anchorAt);
    // Always next month
    const year = base.getFullYear();
    const month = base.getMonth();
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    // Clamp day to the number of days in the next month
    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const day = Math.max(1, Math.min(param, daysInNextMonth));
    return new Date(nextYear, nextMonth, day, 23, 59, 59, 999);
  }

  // Default OFFSET_DAYS
  if (typeof param !== "number") return null;
  const due = new Date(anchorAt);
  due.setDate(due.getDate() + param);
  return due;
}

export const processRoutes = Router();

async function backfillRunSnapshotsIfMissing(runId) {
  // Best-effort self-heal for runs created before snapshot fields existed.
  const run = await prisma.processRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      templateId: true,
      snapshotTemplateName: true,
      snapshotTemplateVersion: true,
      items: {
        select: {
          id: true,
          templateItemId: true,
          snapshotSectionName: true,
          snapshotItemCode: true,
          snapshotItemDescription: true,
          snapshotItemOrder: true,
          snapshotIsRequired: true,
          snapshotSectorId: true,
          snapshotOffsetDaysFromAnchor: true,
          snapshotDueRuleType: true,
          snapshotDueRuleParam: true,
        },
      },
    },
  });
  if (!run || !run.templateId) return;

  const needsTemplateSnapshot = !run.snapshotTemplateName || run.snapshotTemplateVersion == null;
  const missingItems = run.items.filter((i) => !i.snapshotItemDescription && i.templateItemId);
  if (!needsTemplateSnapshot && missingItems.length === 0) return;

  const template = await prisma.processTemplate.findUnique({
    where: { id: run.templateId },
    include: { sections: { include: { items: true } } },
  });
  if (!template) return;

  const templateItemMap = new Map();
  for (const s of template.sections) {
    for (const it of s.items) {
      templateItemMap.set(it.id, { sectionName: s.name, it });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (needsTemplateSnapshot) {
      await tx.processRun.update({
        where: { id: run.id },
        data: {
          snapshotTemplateName: template.name,
          snapshotTemplateVersion: template.version,
        },
      });
    }

    for (const ir of missingItems) {
      const found = templateItemMap.get(ir.templateItemId);
      if (!found) continue; // item may have been deleted from template; can't recover
      const { sectionName, it } = found;
      await tx.processItemRun.update({
        where: { id: ir.id },
        data: {
          snapshotSectionName: ir.snapshotSectionName ?? sectionName,
          snapshotItemCode: ir.snapshotItemCode ?? it.code,
          snapshotItemDescription: ir.snapshotItemDescription ?? it.description,
          snapshotItemOrder: ir.snapshotItemOrder ?? it.order,
          snapshotIsRequired: ir.snapshotIsRequired ?? it.isRequired,
          snapshotSectorId: ir.snapshotSectorId ?? it.sectorId,
          snapshotOffsetDaysFromAnchor: ir.snapshotOffsetDaysFromAnchor ?? it.offsetDaysFromAnchor,
          snapshotDueRuleType: ir.snapshotDueRuleType ?? it.dueRuleType,
          snapshotDueRuleParam: ir.snapshotDueRuleParam ?? it.dueRuleParam,
        },
      });
    }
  });
}

// Get a run with its template structure + current item statuses
processRoutes.get("/run/:runId", async (req, res) => {
  await backfillRunSnapshotsIfMissing(req.params.runId);

  const run = await prisma.processRun.findUnique({
    where: { id: req.params.runId },
    select: {
      id: true,
      type: true,
      createdAt: true,
      anchorAt: true,
      templateId: true,
      snapshotTemplateName: true,
      snapshotTemplateVersion: true,
      company: true,
      items: {
        orderBy: [{ snapshotItemOrder: "asc" }],
        select: {
          id: true,
          templateItemId: true,
          status: true,
          observation: true,
          dueDate: true,
          doneAt: true,
          doneBy: true,
          snapshotSectionName: true,
          snapshotItemCode: true,
          snapshotItemDescription: true,
          snapshotItemOrder: true,
          snapshotIsRequired: true,
          snapshotSectorId: true,
          snapshotOffsetDaysFromAnchor: true,
          snapshotDueRuleType: true,
          snapshotDueRuleParam: true,
        },
      },
    },
  });
  if (!run) return res.status(404).json({ error: "Not found" });

  // Build a sector lookup so UI can show a friendly name.
  const sectorIds = Array.from(new Set(run.items.map((i) => i.snapshotSectorId).filter(Boolean)));
  const sectors = sectorIds.length
    ? await prisma.sector.findMany({ where: { id: { in: sectorIds } }, select: { id: true, name: true } })
    : [];
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  // Group items by section snapshot (history must be immutable).
  const bySection = new Map();
  for (const it of run.items) {
    const sectionName = it.snapshotSectionName || "";
    if (!bySection.has(sectionName)) bySection.set(sectionName, []);
    bySection.get(sectionName).push(it);
  }

  const sections = Array.from(bySection.entries())
    .map(([name, items]) => ({
      name,
      // best-effort ordering: use the minimum item order inside the section
      _minOrder: Math.min(...items.map((i) => (typeof i.snapshotItemOrder === "number" ? i.snapshotItemOrder : 0))),
      items: items
        .slice()
        .sort((a, b) => (a.snapshotItemOrder ?? 0) - (b.snapshotItemOrder ?? 0))
        .map((i) => ({
          templateItemId: i.templateItemId,
          itemRunId: i.id,
          code: i.snapshotItemCode,
          // If the template item was deleted before snapshots were captured,
          // keep history readable instead of returning null.
          description: i.snapshotItemDescription ?? "Item removido do template",
          order: i.snapshotItemOrder ?? 0,
          isRequired: i.snapshotIsRequired ?? false,
          offsetDaysFromAnchor: i.snapshotOffsetDaysFromAnchor,
          dueRuleType: i.snapshotDueRuleType,
          dueRuleParam: i.snapshotDueRuleParam,
          sector: i.snapshotSectorId ? sectorMap.get(i.snapshotSectorId) ?? { id: i.snapshotSectorId, name: "" } : null,
          status: i.status,
          observation: i.observation,
          dueDate: i.dueDate,
          doneAt: i.doneAt,
          doneBy: i.doneBy,
        })),
    }))
    .sort((a, b) => a._minOrder - b._minOrder)
    .map(({ _minOrder, ...rest }) => rest);

  res.json({
    id: run.id,
    type: run.type,
    company: { id: run.company.id, cnpj: run.company.cnpj, razaoSocial: run.company.razaoSocial, nomeFantasia: run.company.nomeFantasia },
    template: {
      id: run.templateId,
      name: run.snapshotTemplateName ?? "",
      version: run.snapshotTemplateVersion ?? null,
      sections,
    },
    createdAt: run.createdAt,
    anchorAt: run.anchorAt,
  });
});

processRoutes.post("/start", async (req, res) => {
  const body = z.object({
    companyId: z.string(),
    templateId: z.string().optional(),
    type: ProcessTypeEnum,
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const actorId = req.user.id;

  // Idempotency: if a run for this company+type already exists, reuse it.
  // This prevents creating multiple runs when the first checkbox is clicked more than once.
  const existing = await prisma.processRun.findFirst({
    where: { companyId: body.data.companyId, type: body.data.type },
    orderBy: [{ createdAt: "desc" }],
    include: { items: true },
  });

  if (existing) {
    // Runs created before snapshots existed may not have immutable history.
    // Attempt to backfill snapshots (best-effort) before reusing.
    await backfillRunSnapshotsIfMissing(existing.id);
    const itemRunMap = {};
    for (const ir of existing.items) {
      if (ir.templateItemId) itemRunMap[ir.templateItemId] = ir.id;
    }
    return res.status(200).json({ runId: existing.id, templateId: existing.templateId, itemRunMap, reused: true });
  }

  let template;
  if (body.data.templateId) {
    template = await prisma.processTemplate.findUnique({
      where: { id: body.data.templateId },
      include: { sections: { include: { items: true } } },
    });
  } else {
    template = await prisma.processTemplate.findFirst({
      where: { type: body.data.type, active: true },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: { sections: { include: { items: true } } },
    });
  }
  if (!template) return res.status(404).json({ error: "Template not found" });

  const run = await prisma.processRun.create({
    data: {
      companyId: body.data.companyId,
      templateId: template.id,
      type: body.data.type,
      createdBy: actorId,
      snapshotTemplateName: template.name,
      snapshotTemplateVersion: template.version,
    },
  });

  const items = template.sections.flatMap((s) => s.items.map((it) => ({ sectionName: s.name, it })));
  const itemRunMap = {};
  for (const { sectionName, it } of items) {
    const ir = await prisma.processItemRun.create({
      data: {
        runId: run.id,
        templateItemId: it.id,
        snapshotSectionName: sectionName,
        snapshotItemCode: it.code,
        snapshotItemDescription: it.description,
        snapshotItemOrder: it.order,
        snapshotIsRequired: it.isRequired,
        snapshotSectorId: it.sectorId,
        snapshotOffsetDaysFromAnchor: it.offsetDaysFromAnchor,
        snapshotDueRuleType: it.dueRuleType,
        snapshotDueRuleParam: it.dueRuleParam,
      },
    });
    itemRunMap[it.id] = ir.id;
  }

  await audit(req, "PROCESS_START", "ProcessRun", run.id, undefined, body.data);

  const company = await prisma.company.findUnique({ where: { id: body.data.companyId }, select: { razaoSocial: true, nomeFantasia: true, cnpj: true } });
  sendTeamsNotification({
    eventKey: "process_started",
    title: "Processo iniciado",
    facts: [
      { name: "Empresa", value: company?.razaoSocial ?? company?.nomeFantasia ?? body.data.companyId },
      { name: "Tipo",    value: body.data.type },
      { name: "Template", value: template.name },
      { name: "Data",    value: new Date().toLocaleString("pt-BR") },
    ],
  }).catch(() => {});

  res.status(201).json({ runId: run.id, templateId: template.id, itemRunMap });
});

processRoutes.patch("/item/:itemRunId", async (req, res) => {
  const body = z.object({
    status: ItemStatusEnum.optional(),
    observation: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const actorId = req.user.id;

  const itemRun = await prisma.processItemRun.findUnique({
    where: { id: req.params.itemRunId },
    include: { run: true },
  });
  if (!itemRun) return res.status(404).json({ error: "Not found" });

  const data = {};
  if (body.data.status !== undefined) {
    const nextStatus = normalizeStatus(body.data.status);
    data.status = nextStatus;
    if (nextStatus === "CONCLUIDO") {
      data.doneAt = new Date();
      data.doneBy = actorId;
    } else {
      data.doneAt = null;
      data.doneBy = null;
    }
  }
  if (body.data.observation !== undefined) data.observation = body.data.observation;

  const updated = await prisma.processItemRun.update({ where: { id: itemRun.id }, data });

  // Anchor: the process starts when the first item is marked as CONCLUIDO.
  // (Users expect "any first check" to start, not only "required" items.)
  if (normalizeStatus(body.data.status) === "CONCLUIDO") {
    const run = await prisma.processRun.findUnique({ where: { id: itemRun.runId } });
    if (run && !run.anchorAt) {
      const anchorAt = updated.doneAt || new Date();
      await prisma.processRun.update({ where: { id: run.id }, data: { anchorAt } });

      const runItems = await prisma.processItemRun.findMany({
        where: { runId: run.id },
        select: {
          id: true,
          snapshotDueRuleType: true,
          snapshotDueRuleParam: true,
          snapshotOffsetDaysFromAnchor: true,
        },
      });

      for (const ri of runItems) {
        const due = computeDueDate(anchorAt, ri);
        if (due) await prisma.processItemRun.update({ where: { id: ri.id }, data: { dueDate: due } });
      }
    }
  }

  await audit(req, "PROCESS_ITEM_UPDATE", "ProcessItemRun", updated.id, itemRun, updated);

  // Verifica se todos os itens obrigatórios estão concluídos → processo concluído.
  if (["CONCLUIDO", "NA"].includes(normalizeStatus(body.data.status ?? ""))) {
    const allItems = await prisma.processItemRun.findMany({
      where: { runId: itemRun.runId },
      select: { status: true, snapshotIsRequired: true },
    });
    const requiredItems = allItems.filter((i) => i.snapshotIsRequired);
    const checkItems = requiredItems.length > 0 ? requiredItems : allItems;
    const allDone = checkItems.every((i) => ["CONCLUIDO", "NA"].includes(i.status));
    if (allDone) {
      const run = await prisma.processRun.findUnique({
        where: { id: itemRun.runId },
        include: { company: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } } },
      });
      if (run) {
        sendTeamsNotification({
          eventKey: "process_completed",
          title: "Processo concluído",
          facts: [
            { name: "Empresa",  value: run.company?.razaoSocial ?? run.company?.nomeFantasia ?? run.companyId },
            { name: "Tipo",     value: run.type },
            { name: "Data",     value: new Date().toLocaleString("pt-BR") },
          ],
        }).catch(() => {});
      }
    }
  }

  res.json({ ok: true });
});
