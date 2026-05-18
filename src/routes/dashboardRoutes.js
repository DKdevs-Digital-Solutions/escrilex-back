import { Router } from "express";
import { prisma } from "../prisma.js";
import { RoleName } from "../auth.js";

export const dashboardRoutes = Router();

function endOfDay(date) { const v = new Date(date); v.setHours(23,59,59,999); return v; }
function parseDate(value) { if (!value) return null; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? null : d; }
function subtractDays(date, days) { const d = new Date(date); d.setDate(d.getDate() - days); return d; }
function periodFromReq(req) {
  const preset = String(req.query.period || "7d").toLowerCase();
  const parsedStart = parseDate(req.query.startDate);
  const parsedEnd = parseDate(req.query.endDate);
  if (req.query.startDate && !parsedStart) return { error: "startDate inválida" };
  if (req.query.endDate && !parsedEnd) return { error: "endDate inválida" };
  const endDate = endOfDay(parsedEnd ?? new Date());
  let startDate = parsedStart;
  if (!startDate) {
    if (["30d", "30", "last30"].includes(preset)) startDate = subtractDays(endDate, 30);
    else if (["365d", "365", "last365"].includes(preset)) startDate = subtractDays(endDate, 365);
    else startDate = subtractDays(endDate, 7);
  }
  if (startDate > endDate) return { error: "startDate deve ser menor ou igual a endDate" };
  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - (endDate.getTime() - startDate.getTime()));
  return { startDate, endDate, previousStart, previousEnd };
}
function hasAnyRole(req, roles) { return (req.user?.roles || []).some((r) => roles.includes(r)); }
function companyScope(req) { return hasAnyRole(req, [RoleName.ADMIN, RoleName.GESTOR_EMPRESA]) ? {} : { responsibles: { some: { userId: req.user.id } } }; }
function percentGrowth(current, previous) { if (!previous) return current ? 100 : 0; return Number((((current - previous) / previous) * 100).toFixed(2)); }
function groupToObject(rows, field) { return rows.map((r) => ({ key: r[field] || "Não informado", total: r._count._all })); }

async function listCompaniesBy(req, extraWhere) {
  return prisma.company.findMany({
    where: { ...companyScope(req), ...extraWhere },
    select: { id: true, cod: true, razaoSocial: true, nomeFantasia: true, cnpj: true, grupo: true, status: true, situacao: true, tributacao: true, ramo: true, perfilComercial: true, perfil: true, dataEntrada: true, dataSaida: true, inactivatedAt: true, motivoSaida: true, motivoSaidaResumo: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
}

dashboardRoutes.get("/summary", async (req, res) => {
  const p = periodFromReq(req);
  if (p.error) return res.status(400).json({ error: p.error });
  const scope = companyScope(req);
  const dateWhere = { gte: p.startDate, lte: p.endDate };
  const prevDateWhere = { gte: p.previousStart, lte: p.previousEnd };

  const [entries, previousEntries, exits, previousExits, totalActive, totalInactive, byTributacao, byRamo, byPerfil, byExitReason, responsibleChanges, companyChanges] = await Promise.all([
    prisma.company.count({ where: { ...scope, OR: [{ dataEntrada: dateWhere }, { dataCadastro: dateWhere }] } }),
    prisma.company.count({ where: { ...scope, OR: [{ dataEntrada: prevDateWhere }, { dataCadastro: prevDateWhere }] } }),
    prisma.company.count({ where: { ...scope, OR: [{ dataSaida: dateWhere }, { inactivatedAt: dateWhere }], active: false } }),
    prisma.company.count({ where: { ...scope, OR: [{ dataSaida: prevDateWhere }, { inactivatedAt: prevDateWhere }], active: false } }),
    prisma.company.count({ where: { ...scope, active: true } }),
    prisma.company.count({ where: { ...scope, active: false } }),
    prisma.company.groupBy({ by: ["tributacao"], where: { ...scope }, _count: { _all: true } }),
    prisma.company.groupBy({ by: ["ramo"], where: { ...scope }, _count: { _all: true } }),
    prisma.company.groupBy({ by: ["perfilComercial"], where: { ...scope }, _count: { _all: true } }),
    prisma.company.groupBy({ by: ["motivoSaida"], where: { ...scope, OR: [{ dataSaida: dateWhere }, { inactivatedAt: dateWhere }] }, _count: { _all: true } }),
    prisma.companySectorResponsibleHistory.findMany({ where: { startAt: dateWhere }, include: { company: true, sector: true, user: true }, orderBy: { startAt: "desc" }, take: 500 }),
    prisma.auditLog.findMany({ where: { entity: "Company", action: { contains: "UPDATE" }, createdAt: dateWhere }, include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const responsibleByDepartment = Object.values(responsibleChanges.reduce((acc, row) => {
    const key = row.sector?.name || "Não informado";
    acc[key] ??= { department: key, total: 0 };
    acc[key].total += 1;
    return acc;
  }, {}));

  res.json({
    period: { startDate: p.startDate, endDate: p.endDate, previousStart: p.previousStart, previousEnd: p.previousEnd },
    cards: {
      entries: { total: entries, previous: previousEntries, growthPercent: percentGrowth(entries, previousEntries) },
      exits: { total: exits, previous: previousExits, growthPercent: percentGrowth(exits, previousExits) },
      totalActive,
      totalInactive,
      companyChanges: companyChanges.length,
      responsibleChanges: responsibleChanges.length,
    },
    charts: {
      tributacao: groupToObject(byTributacao, "tributacao"),
      ramo: groupToObject(byRamo, "ramo"),
      perfil: groupToObject(byPerfil, "perfilComercial"),
      exitReasons: groupToObject(byExitReason, "motivoSaida"),
      responsibleByDepartment,
    },
  });
});

dashboardRoutes.get("/drilldown", async (req, res) => {
  const p = periodFromReq(req);
  if (p.error) return res.status(400).json({ error: p.error });
  const type = String(req.query.type || "").trim();
  const key = String(req.query.key || "").trim();
  const dateWhere = { gte: p.startDate, lte: p.endDate };

  if (type === "entries") return res.json({ items: await listCompaniesBy(req, { OR: [{ dataEntrada: dateWhere }, { dataCadastro: dateWhere }] }) });
  if (type === "exits") return res.json({ items: await listCompaniesBy(req, { OR: [{ dataSaida: dateWhere }, { inactivatedAt: dateWhere }], active: false }) });
  if (type === "tributacao") return res.json({ items: await listCompaniesBy(req, { tributacao: key === "Não informado" ? null : key }) });
  if (type === "ramo") return res.json({ items: await listCompaniesBy(req, { ramo: key === "Não informado" ? null : key }) });
  if (type === "perfil") return res.json({ items: await listCompaniesBy(req, { perfilComercial: key === "Não informado" ? null : key }) });
  if (type === "responsibles") {
    const rows = await prisma.companySectorResponsibleHistory.findMany({ where: { startAt: dateWhere, ...(key ? { sector: { name: key } } : {}) }, include: { company: true, sector: true, user: true }, orderBy: { startAt: "desc" }, take: 500 });
    return res.json({ items: rows.map((r) => ({ company: r.company, department: r.sector?.name, newResponsible: r.user, changedBy: r.changedBy, date: r.startAt })) });
  }
  if (type === "changes") {
    const rows = await prisma.auditLog.findMany({ where: { entity: "Company", action: { contains: "UPDATE" }, createdAt: dateWhere }, include: { actor: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
    return res.json({ items: rows.flatMap((r) => (r.afterJson?.changes || []).map((c) => ({ companyId: r.entityId, field: c.field, before: c.before, after: c.after, user: r.actor, date: r.createdAt }))) });
  }
  return res.status(400).json({ error: "type inválido. Use entries, exits, tributacao, ramo, perfil, responsibles ou changes." });
});
