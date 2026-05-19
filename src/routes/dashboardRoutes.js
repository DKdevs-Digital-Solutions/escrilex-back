import { Router } from "express";
import { prisma } from "../prisma.js";

export const dashboardRoutes = Router();

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
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

dashboardRoutes.get("/summary", async (req, res) => {
  const parsedStart = parseDate(req.query.startDate);
  const parsedEnd = parseDate(req.query.endDate);

  if (req.query.startDate && !parsedStart) {
    return res.status(400).json({ error: "startDate inválida" });
  }
  if (req.query.endDate && !parsedEnd) {
    return res.status(400).json({ error: "endDate inválida" });
  }

  const startDate = parsedStart ?? startOfMonth(new Date());
  const endDate = endOfDay(parsedEnd ?? new Date());

  if (startDate > endDate) {
    return res.status(400).json({ error: "startDate deve ser menor ou igual a endDate" });
  }

  const [newClients, inactiveClients, totalActive, totalInactive] = await Promise.all([
    prisma.company.count({
      where: {
        dataCadastro: {
          gte: startDate,
          lte: endDate,
        },
      },
    }),
    prisma.company.count({
      where: {
        active: false,
        inactivatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    }),
    prisma.company.count({ where: { active: true } }),
    prisma.company.count({ where: { active: false } }),
  ]);

  res.json({
    period: {
      startDate,
      endDate,
    },
    cards: {
      newClients,
      inactiveClients,
      totalActive,
      totalInactive,
    },
  });
});
