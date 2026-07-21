import { prisma } from "./prisma.js";

/**
 * E-mails ativos dos responsáveis de setor de uma empresa.
 * Usados como destinatários e base das @menções nas notificações do Teams.
 */
export async function responsibleEmails(companyId) {
  if (!companyId) return [];

  const rows = await prisma.companySectorResponsible.findMany({
    where:   { companyId },
    include: { user: { select: { email: true, active: true } } },
  });

  return [
    ...new Set(
      rows.map((r) => r.user).filter((u) => u?.active && u.email).map((u) => u.email),
    ),
  ];
}
