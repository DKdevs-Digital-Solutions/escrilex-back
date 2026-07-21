import { prisma } from "./prisma.js";
import { sendTeamsNotification } from "./teams.js";


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

    const empresa = item.run.company.razaoSocial ?? item.run.company.cnpj;
    const facts = [
      { name: "Empresa", value: empresa },
      { name: "Setor", value: responsible.sector.name },
    ];
    if (item.snapshotItemDescription) facts.push({ name: "Item", value: item.snapshotItemDescription });
    if (item.dueDate) facts.push({ name: "Vencimento", value: item.dueDate.toLocaleDateString("pt-BR") });

    await sendTeamsNotification({
      eventKey: "process_overdue",
      recipients: [responsible.user.email],
      title: `Prazo vencido — ${item.run.company.cnpj}`,
      text: `Há um item de processo com prazo vencido sob sua responsabilidade.`,
      facts,
    });

    await prisma.processItemRun.update({
      where: { id: item.id },
      data: { overdueNotifiedAt: new Date() },
    });
  }

  return { overdue: overdue.length };
}
