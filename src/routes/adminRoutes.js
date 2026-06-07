import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

import { RoleName } from "../auth.js";

const RoleNameEnum = z.enum(["ADMIN","GESTOR_EMPRESA","OPERADOR","LEITURA"]); 

export const adminRoutes = Router();

adminRoutes.get("/users", async (req, res) => {
  const search = (req.query.search || "").trim();
  const users = await prisma.user.findMany({
    where: search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : undefined,
    include: { sector: true, roles: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map((u) => ({
    id: u.id, name: u.name, email: u.email, active: u.active,
    sector: u.sector ? { id: u.sector.id, name: u.sector.name } : null,
    roles: u.roles.map((r) => r.role.name),
  })));
});

adminRoutes.post("/users", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    sectorId: z.string().optional(),
    roles: z.array(RoleNameEnum).default([RoleName.OPERADOR]),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const passwordHash = await bcrypt.hash(body.data.password, 10);
  const user = await prisma.user.create({ data: { name: body.data.name, email: body.data.email, passwordHash, sectorId: body.data.sectorId } });

  for (const r of body.data.roles) {
    const role = await prisma.role.findUnique({ where: { name: r } });
    if (role) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }

  await audit(req, "USER_CREATE", "User", user.id, undefined, { email: user.email });
  res.status(201).json({ id: user.id });
});

// Update user (ADMIN only)
adminRoutes.put("/users/:id", async (req, res) => {
  const body = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    sectorId: z.string().nullable().optional(),
    roles: z.array(RoleNameEnum).optional(),
    active: z.boolean().optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { roles: { include: { role: true } } },
  });
  if (!before) return res.status(404).json({ error: "Not found" });

  const data = {};
  if (body.data.name !== undefined) data.name = body.data.name;
  if (body.data.email !== undefined) data.email = body.data.email;
  if (body.data.active !== undefined) data.active = body.data.active;
  if (body.data.sectorId !== undefined) data.sectorId = body.data.sectorId || null;
  if (body.data.password) data.passwordHash = await bcrypt.hash(body.data.password, 10);

  const updated = await prisma.user.update({ where: { id: req.params.id }, data });

  // Replace roles if provided
  if (body.data.roles) {
    await prisma.userRole.deleteMany({ where: { userId: updated.id } });
    for (const r of body.data.roles) {
      const role = await prisma.role.findUnique({ where: { name: r } });
      if (role) await prisma.userRole.create({ data: { userId: updated.id, roleId: role.id } });
    }
  }

  const after = await prisma.user.findUnique({
    where: { id: updated.id },
    include: { roles: { include: { role: true } } },
  });

  await audit(req, "USER_UPDATE", "User", updated.id, {
    id: before.id,
    name: before.name,
    email: before.email,
    active: before.active,
    sectorId: before.sectorId,
    roles: before.roles.map((x) => x.role.name),
  }, {
    id: after.id,
    name: after.name,
    email: after.email,
    active: after.active,
    sectorId: after.sectorId,
    roles: after.roles.map((x) => x.role.name),
  });

  res.json({ ok: true });
});

adminRoutes.delete("/users/:id", async (req, res) => {
  const before = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
  await audit(req, "USER_DISABLE", "User", updated.id, before, updated);
  res.json({ ok: true });
});

adminRoutes.get("/sectors", async (req, res) => {
  const search = (req.query.search || "").trim();
  const sectors = await prisma.sector.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
  });
  res.json(sectors);
});

adminRoutes.post("/sectors", async (req, res) => {
  const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const sector = await prisma.sector.create({ data: { name: body.data.name } });
  await audit(req, "SECTOR_CREATE", "Sector", sector.id, undefined, sector);
  res.status(201).json(sector);
});

// Update sector name (ADMIN only)
adminRoutes.put("/sectors/:id", async (req, res) => {
  const body = z.object({ name: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const before = await prisma.sector.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.sector.update({ where: { id: req.params.id }, data: { name: body.data.name } });
  await audit(req, "SECTOR_UPDATE", "Sector", updated.id, before, updated);
  res.json(updated);
});

adminRoutes.delete("/sectors/:id", async (req, res) => {
  const before = await prisma.sector.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.sector.update({ where: { id: req.params.id }, data: { active: false } });
  await audit(req, "SECTOR_DISABLE", "Sector", updated.id, before, updated);
  res.json({ ok: true });
});

// Reactivate sector (ADMIN only)
adminRoutes.put("/sectors/:id/activate", async (req, res) => {
  const before = await prisma.sector.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.sector.update({ where: { id: req.params.id }, data: { active: true } });
  await audit(req, "SECTOR_ENABLE", "Sector", updated.id, before, updated);
  res.json(updated);
});

// Calcula diff campo a campo entre dois snapshots JSON
function computeFieldDiff(before, after) {
  if (!before && !after) return [];
  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes = [];
  for (const campo of allKeys) {
    const valorAnterior = before?.[campo] ?? null;
    const novoValor     = after?.[campo]  ?? null;
    if (JSON.stringify(valorAnterior) !== JSON.stringify(novoValor)) {
      changes.push({ campo, valorAnterior, novoValor });
    }
  }
  return changes;
}

// GET /api/admin/audit
// Retorna: nomeEmpresa, usuarioResponsavel, data, hora, camposAlterados, valorAnterior, novoValor
adminRoutes.get("/audit", async (req, res) => {
  const entity    = (req.query.entity    || "").toString().trim() || undefined;
  const entityId  = (req.query.entityId  || "").toString().trim() || undefined;
  const companyId = (req.query.companyId || "").toString().trim() || undefined;
  const action    = (req.query.action    || "").toString().trim() || undefined;
  const startDate = (req.query.startDate || "").toString().trim() || undefined;
  const endDate   = (req.query.endDate   || "").toString().trim() || undefined;
  const limit  = Math.min(parseInt((req.query.limit  || "50").toString(), 10) || 50, 200);
  const offset = Math.max(parseInt((req.query.offset || "0").toString(),  10) || 0,   0);

  const parsedStart = startDate ? new Date(startDate) : undefined;
  const parsedEnd   = endDate   ? new Date(endDate)   : undefined;

  const rows = await prisma.auditLog.findMany({
    where: {
      // companyId é atalho para entity=Company + entityId=companyId
      ...(companyId ? { entity: "Company", entityId: companyId } : {
        ...(entity   ? { entity }   : {}),
        ...(entityId ? { entityId } : {}),
      }),
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(parsedStart || parsedEnd ? {
        createdAt: {
          ...(parsedStart ? { gte: parsedStart } : {}),
          ...(parsedEnd   ? { lte: parsedEnd   } : {}),
        },
      } : {}),
    },
    include: { actor: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  // Resolve nome da empresa para logs de entidade Company (batch para evitar N+1)
  const companyIds = [...new Set(
    rows.filter((r) => r.entity === "Company" && r.entityId).map((r) => r.entityId),
  )];
  const companies = companyIds.length
    ? await prisma.company.findMany({
        where:  { id: { in: companyIds } },
        select: { id: true, razaoSocial: true, nomeFantasia: true },
      })
    : [];
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));

  res.json({
    limit,
    offset,
    items: rows.map((r) => {
      const compRecord = r.entity === "Company" ? companyMap[r.entityId] : null;
      // Fallback para snapshot em caso de empresa excluída
      const nomeEmpresa =
        compRecord?.razaoSocial ??
        compRecord?.nomeFantasia ??
        r.afterJson?.razaoSocial  ??
        r.beforeJson?.razaoSocial ??
        null;

      const iso  = r.createdAt.toISOString();
      const data = iso.slice(0, 10);        // "YYYY-MM-DD"
      const hora = iso.slice(11, 19);       // "HH:MM:SS"

      return {
        id: r.id,
        data,
        hora,
        nomeEmpresa,
        usuarioResponsavel: r.actor,
        action:    r.action,
        entity:    r.entity,
        entityId:  r.entityId,
        camposAlterados: computeFieldDiff(r.beforeJson, r.afterJson),
        valorAnterior:   r.beforeJson,
        novoValor:       r.afterJson,
        ip:        r.ip,
        userAgent: r.userAgent,
      };
    }),
  });
});
