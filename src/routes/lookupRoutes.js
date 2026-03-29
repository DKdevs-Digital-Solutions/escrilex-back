import { Router } from "express";
import { prisma } from "../prisma.js";

export const lookupRoutes = Router();

lookupRoutes.get("/sectors", async (_req, res) => {
  const sectors = await prisma.sector.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  res.json(sectors);
});

lookupRoutes.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, sectorId: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});
