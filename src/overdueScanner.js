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

    const facts = [
      { name: "Empresa",    value: item.run.company.razaoSocial ?? item.run.company.nomeFantasia ?? "—" },
      { name: "CNPJ",       value: item.run.company.cnpj },
      { name: "Setor",      value: responsible.sector.name },
      { name: "Responsavel", value: responsible.user.email },
    ];
    if (item.snapshotItemDescription) facts.push({ name: "Item",       value: item.snapshotItemDescription });
    if (item.dueDate)                  facts.push({ name: "Vencimento", value: item.dueDate.toLocaleDateString("pt-BR") });

    await sendTeamsNotification({
      eventKey: "process_overdue",
      recipients: [responsible.user.email],
      title: "Processo atrasado",
      facts,
    });

    await prisma.processItemRun.update({
      where: { id: item.id },
      data: { overdueNotifiedAt: new Date() },
    });
  }

  return { overdue: overdue.length };
}
