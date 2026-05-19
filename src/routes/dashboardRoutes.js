import { Router } from "express";
import { prisma } from "../prisma.js";

export const dashboardRoutes = Router();

function addDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePeriod(req) {
  const parsedStart = parseDate(req.query.startDate);
  const parsedEnd = parseDate(req.query.endDate);

  if (req.query.startDate && !parsedStart) return { error: "startDate inválida" };
  if (req.query.endDate && !parsedEnd) return { error: "endDate inválida" };

  // Documento V5: padrão da home/dashboard = últimos 7 dias.
  const endDate = endOfDay(parsedEnd ?? new Date());
  const startDate = startOfDay(parsedStart ?? addDays(endDate, -6));

  if (startDate > endDate) return { error: "startDate deve ser menor ou igual a endDate" };

  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = addDays(startDate, -days);

  return { startDate, endDate, previousStartDate, previousEndDate };
}

function growthPercent(current, previous) {
  if (!previous && !current) return 0;
  if (!previous && current) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function first(row, key, fallback = 0) {
  if (!row) return fallback;
  return row[key] ?? fallback;
}

async function countScalar(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return Number(first(rows[0], "total", 0));
}

async function groupRows(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return rows.map((row) => ({ label: row.label || "Não informado", total: Number(row.total || 0) }));
}

dashboardRoutes.get("/summary", async (req, res) => {
  const period = parsePeriod(req);
  if (period.error) return res.status(400).json({ error: period.error });

  const { startDate, endDate, previousStartDate, previousEndDate } = period;

  const [
    newClients,
    previousNewClients,
    inactiveClients,
    previousInactiveClients,
    totalActive,
    totalInactive,
    alterationRows,
    taxation,
    activityBranch,
    profile,
    statusGroups,
    responsibleRows,
  ] = await Promise.all([
    countScalar(
      `SELECT COUNT(*)::int AS total FROM "Company" WHERE "dataCadastro" BETWEEN $1 AND $2`,
      startDate,
      endDate,
    ),
    countScalar(
      `SELECT COUNT(*)::int AS total FROM "Company" WHERE "dataCadastro" BETWEEN $1 AND $2`,
      previousStartDate,
      previousEndDate,
    ),
    countScalar(
      `SELECT COUNT(*)::int AS total
       FROM "Company" c
       LEFT JOIN "CompanyExpectationMatrix" m ON m."companyId" = c."id"
       WHERE COALESCE(c."inactivatedAt", m."dataSaida", c."dataSituacao") BETWEEN $1 AND $2
         AND (c."active" = false OR c."situacao" IN ('Baixada', 'Encerrado', 'Em Saída'))`,
      startDate,
      endDate,
    ),
    countScalar(
      `SELECT COUNT(*)::int AS total
       FROM "Company" c
       LEFT JOIN "CompanyExpectationMatrix" m ON m."companyId" = c."id"
       WHERE COALESCE(c."inactivatedAt", m."dataSaida", c."dataSituacao") BETWEEN $1 AND $2
         AND (c."active" = false OR c."situacao" IN ('Baixada', 'Encerrado', 'Em Saída'))`,
      previousStartDate,
      previousEndDate,
    ),
    countScalar(`SELECT COUNT(*)::int AS total FROM "Company" WHERE "active" = true`),
    countScalar(`SELECT COUNT(*)::int AS total FROM "Company" WHERE "active" = false`),
    prisma.$queryRawUnsafe(
      `SELECT "action" AS label, COUNT(*)::int AS total
       FROM "AuditLog"
       WHERE "createdAt" BETWEEN $1 AND $2
         AND (
           "entity" = 'Company'
           OR "action" IN ('COMPANY_UPDATE', 'COMPANY_RESPONSIBLES_SET', 'EXPECTATION_MATRIX_UPDATE')
         )
       GROUP BY "action"
       ORDER BY total DESC`,
      startDate,
      endDate,
    ),
    groupRows(
      `SELECT COALESCE(NULLIF("tributacao", ''), 'Não informado') AS label, COUNT(*)::int AS total
       FROM "Company"
       GROUP BY 1
       ORDER BY total DESC`,
    ),
    groupRows(
      `SELECT COALESCE(NULLIF("ramo", ''), 'Não informado') AS label, COUNT(*)::int AS total
       FROM "Company"
       GROUP BY 1
       ORDER BY total DESC`,
    ),
    groupRows(
      `SELECT COALESCE(NULLIF("perfil", ''), 'Não informado') AS label, COUNT(*)::int AS total
       FROM "Company"
       GROUP BY 1
       ORDER BY total DESC`,
    ),
    groupRows(
      `SELECT COALESCE(NULLIF("situacao", ''), CASE WHEN "active" THEN 'Ativo' ELSE 'Inativo' END) AS label, COUNT(*)::int AS total
       FROM "Company"
       GROUP BY 1
       ORDER BY total DESC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT
         s."name" AS label,
         COUNT(*)::int AS total,
         COUNT(DISTINCT h."companyId")::int AS "companiesTotal"
       FROM "CompanySectorResponsibleHistory" h
       JOIN "Sector" s ON s."id" = h."sectorId"
       WHERE h."startAt" BETWEEN $1 AND $2
       GROUP BY s."name"
       ORDER BY total DESC`,
      startDate,
      endDate,
    ),
  ]);

  const alterationsTotal = alterationRows.reduce((acc, row) => acc + Number(row.total || 0), 0);
  const responsibleChangesTotal = responsibleRows.reduce((acc, row) => acc + Number(row.total || 0), 0);
  const responsibleChangedCompanies = responsibleRows.reduce((acc, row) => acc + Number(row.companiesTotal || 0), 0);

  res.json({
    period: { startDate, endDate, previousStartDate, previousEndDate },
    cards: {
      newClients,
      inactiveClients,
      totalActive,
      totalInactive,
      alterations: alterationsTotal,
      responsibleChanges: responsibleChangesTotal,
    },
    comparisons: {
      entries: { current: newClients, previous: previousNewClients, growthPercent: growthPercent(newClients, previousNewClients) },
      exits: { current: inactiveClients, previous: previousInactiveClients, growthPercent: growthPercent(inactiveClients, previousInactiveClients) },
    },
    charts: {
      taxation,
      activityBranch,
      profile,
      status: statusGroups,
      alterations: alterationRows.map((row) => ({ label: row.label, total: Number(row.total || 0) })),
      responsibleChanges: {
        totalCompanies: responsibleChangedCompanies,
        byDepartment: responsibleRows.map((row) => ({ label: row.label, total: Number(row.total || 0), companiesTotal: Number(row.companiesTotal || 0) })),
      },
    },
    drilldownEndpoint: "/api/dashboard/details",
    expectationMatrixEndpoint: "/api/expectation-matrix",
  });
});

dashboardRoutes.get("/details", async (req, res) => {
  const period = parsePeriod(req);
  if (period.error) return res.status(400).json({ error: period.error });

  const { startDate, endDate } = period;
  const type = String(req.query.type || "").trim();
  const value = String(req.query.value || "").trim();
  const limit = Math.min(parseInt(String(req.query.limit || "100"), 10) || 100, 500);
  const offset = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);

  const companyColumns = `
    c."id", c."cod", c."razaoSocial", c."nomeFantasia", c."cnpj", c."grupo", c."situacao",
    c."tributacao", c."ramo", c."perfil", c."dataCadastro", c."dataEntrada", c."inactivatedAt"
  `;

  let rows;

  if (type === "entries") {
    rows = await prisma.$queryRawUnsafe(
      `SELECT ${companyColumns}
       FROM "Company" c
       WHERE c."dataCadastro" BETWEEN $1 AND $2
       ORDER BY c."dataCadastro" DESC
       LIMIT $3 OFFSET $4`,
      startDate,
      endDate,
      limit,
      offset,
    );
  } else if (type === "exits") {
    rows = await prisma.$queryRawUnsafe(
      `SELECT ${companyColumns}, m."dataSaida", c."motivoSaidaResumo" AS "motivoSaida"
       FROM "Company" c
       LEFT JOIN "CompanyExpectationMatrix" m ON m."companyId" = c."id"
       WHERE COALESCE(c."inactivatedAt", m."dataSaida", c."dataSituacao") BETWEEN $1 AND $2
         AND (c."active" = false OR c."situacao" IN ('Baixada', 'Encerrado', 'Em Saída'))
       ORDER BY COALESCE(c."inactivatedAt", m."dataSaida", c."dataSituacao") DESC
       LIMIT $3 OFFSET $4`,
      startDate,
      endDate,
      limit,
      offset,
    );
  } else if (["tributacao", "ramo", "perfil", "status"].includes(type)) {
    const column = type === "status" ? "situacao" : type;
    rows = await prisma.$queryRawUnsafe(
      `SELECT ${companyColumns}
       FROM "Company" c
       WHERE COALESCE(c."${column}", '') = $1
       ORDER BY c."razaoSocial" ASC
       LIMIT $2 OFFSET $3`,
      value,
      limit,
      offset,
    );
  } else if (type === "alterations") {
    rows = await prisma.$queryRawUnsafe(
      `SELECT
         a."id", a."action", a."entity", a."entityId", a."beforeJson", a."afterJson", a."createdAt",
         u."name" AS "actorName", u."email" AS "actorEmail"
       FROM "AuditLog" a
       LEFT JOIN "User" u ON u."id" = a."actorUserId"
       WHERE a."createdAt" BETWEEN $1 AND $2
         AND (a."entity" = 'Company' OR a."action" IN ('COMPANY_UPDATE', 'COMPANY_RESPONSIBLES_SET', 'EXPECTATION_MATRIX_UPDATE'))
       ORDER BY a."createdAt" DESC
       LIMIT $3 OFFSET $4`,
      startDate,
      endDate,
      limit,
      offset,
    );
  } else if (type === "responsible") {
    rows = await prisma.$queryRawUnsafe(
      `SELECT
         c."id" AS "companyId",
         c."cod",
         c."razaoSocial",
         c."cnpj",
         s."name" AS "department",
         old_u."name" AS "previousResponsible",
         new_u."name" AS "newResponsible",
         actor."name" AS "changedBy",
         h."startAt" AS "changedAt"
       FROM "CompanySectorResponsibleHistory" h
       JOIN "Company" c ON c."id" = h."companyId"
       JOIN "Sector" s ON s."id" = h."sectorId"
       LEFT JOIN LATERAL (
         SELECT ph."userId"
         FROM "CompanySectorResponsibleHistory" ph
         WHERE ph."companyId" = h."companyId"
           AND ph."sectorId" = h."sectorId"
           AND ph."id" <> h."id"
           AND ph."startAt" <= h."startAt"
         ORDER BY ph."startAt" DESC
         LIMIT 1
       ) previous_h ON true
       LEFT JOIN "User" old_u ON old_u."id" = previous_h."userId"
       LEFT JOIN "User" new_u ON new_u."id" = h."userId"
       LEFT JOIN "User" actor ON actor."id" = h."changedBy"
       WHERE h."startAt" BETWEEN $1 AND $2
         AND ($3 = '' OR s."name" = $3)
       ORDER BY h."startAt" DESC
       LIMIT $4 OFFSET $5`,
      startDate,
      endDate,
      value,
      limit,
      offset,
    );
  } else {
    return res.status(400).json({ error: "type inválido", allowed: ["entries", "exits", "alterations", "tributacao", "ramo", "perfil", "status", "responsible"] });
  }

  res.json({ type, value: value || null, period: { startDate, endDate }, limit, offset, items: rows });
});
