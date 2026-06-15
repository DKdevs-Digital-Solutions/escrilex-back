import { prisma } from "./prisma.js";
import { sendMail } from "./email.js";


export async function scanAndNotifyOverdue() {
  const now = new Date();
  const overdue = await prisma.processItemRun.findMany({
    where: { status: "PENDENTE", dueDate: { lt: now }, overdueNotifiedAt: null },
    select: {
      id: true,
      dueDate: true,
      snapshotSectorId: true,
      snapshotItemDescription: true,
      run: { select: { companyId: true, company: true } },
    },
    take: 200,
  });

  for (const item of overdue) {
    const sectorId = item.snapshotSectorId;
    if (!sectorId) continue;

    const responsible = await prisma.companySectorResponsible.findUnique({
      where: { companyId_sectorId: { companyId: item.run.companyId, sectorId } },
      include: { user: true, sector: true },
    });
    if (!responsible?.user?.email) continue;

    const subject = `Prazo vencido - ${item.run.company.cnpj}`;
    const text =
      `Empresa: ${item.run.company.razaoSocial ?? item.run.company.cnpj}\n` +
      `Setor: ${responsible.sector.name}\n` +
      (item.snapshotItemDescription ? `Item: ${item.snapshotItemDescription}\n` : "") +
      `Vencimento: ${item.dueDate?.toISOString()}\n`;

    await sendMail(responsible.user.email, subject, text);

    await prisma.processItemRun.update({
      where: { id: item.id },
      data: { overdueNotifiedAt: new Date() },
    });
  }

  return { overdue: overdue.length };
}
