import { Router } from "express";
import { prisma } from "../prisma.js";

export const integrationRoutes = Router();

function normalizeCnpj(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function buildCnpjWhere(rawCnpj, cnpj) {
  const or = [];

  if (rawCnpj) or.push({ cnpj: rawCnpj });
  if (cnpj) or.push({ cnpj });

  // Compatibilidade com empresas antigas salvas com máscara no banco.
  if (cnpj.length === 14) {
    or.push({ cnpj: `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}` });
  }

  // Evita quebra caso algum registro legado tenha apenas parte do CNPJ.
  if (cnpj.length >= 8) or.push({ cnpj: { contains: cnpj } });

  return { OR: or };
}

function mapAttendant(responsible) {
  return {
    id: responsible.user.id,
    name: responsible.user.name,
    email: responsible.user.email,
    active: responsible.user.active,
    sector: {
      id: responsible.sector.id,
      name: responsible.sector.name,
      active: responsible.sector.active,
    },
    assignedAt: responsible.assignedAt,
    assignedBy: responsible.assignedBy,
  };
}

async function getResponsiblesByCnpj(req, res) {
  // Aceita /cnpj/:cnpj, /cnpj/12.345.678/0001-90 sem encode e /cnpj?cnpj=...
  const rawCnpj = String(req.params.cnpj ?? req.params[0] ?? req.query.cnpj ?? "").trim();
  const cnpj = normalizeCnpj(rawCnpj);

  if (cnpj.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Informe os 14 dígitos." });
  }

  try {
    const company = await prisma.company.findFirst({
      where: buildCnpjWhere(rawCnpj, cnpj),
      include: {
        responsibles: {
          orderBy: { assignedAt: "desc" },
          include: {
            sector: true,
            user: true,
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: "Empresa não encontrada para o CNPJ informado." });
    }

    const attendants = company.responsibles.map(mapAttendant);

    return res.json({ attendants });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao consultar responsáveis da empresa." });
  }
}

// Consulta interna: retorna apenas os atendentes responsáveis pelo CNPJ e seus setores.
integrationRoutes.get("/cnpj", getResponsiblesByCnpj);
integrationRoutes.get("/cnpj/:cnpj", getResponsiblesByCnpj);
integrationRoutes.get("/cnpj/*", getResponsiblesByCnpj);
