import { prisma } from "./prisma.js";

// ─── Cálculo de prazo ────────────────────────────────────────────────────────

// Calcula a data de vencimento de um item a partir de uma data-base (anchor).
export function computeDueDate(anchorAt, itemSnapshot) {
  if (!anchorAt) return null;

  const ruleType = itemSnapshot.snapshotDueRuleType || "OFFSET_DAYS";
  const param =
    typeof itemSnapshot.snapshotDueRuleParam === "number"
      ? itemSnapshot.snapshotDueRuleParam
      : typeof itemSnapshot.snapshotOffsetDaysFromAnchor === "number"
        ? itemSnapshot.snapshotOffsetDaysFromAnchor
        : null;

  if (ruleType === "DAY_OF_NEXT_MONTH") {
    if (typeof param !== "number") return null;
    const base = new Date(anchorAt);
    const year = base.getFullYear();
    const month = base.getMonth();
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const day = Math.max(1, Math.min(param, daysInNextMonth));
    return new Date(nextYear, nextMonth, day, 23, 59, 59, 999);
  }

  if (typeof param !== "number") return null;
  const due = new Date(anchorAt);
  due.setDate(due.getDate() + param);
  return due;
}

// ─── Cascata por seção ───────────────────────────────────────────────────────

// Agrupa os itens por seção e ordena as seções pela menor ordem de item.
function orderRunSections(items) {
  const bySection = new Map();
  for (const it of items) {
    const name = it.snapshotSectionName || "";
    if (!bySection.has(name)) bySection.set(name, []);
    bySection.get(name).push(it);
  }
  return Array.from(bySection.entries())
    .map(([name, list]) => ({
      name,
      minOrder: Math.min(...list.map((i) => i.snapshotItemOrder ?? 0)),
      items: list,
    }))
    .sort((a, b) => a.minOrder - b.minOrder);
}

const isDoneStatus = (s) => ["CONCLUIDO", "NA"].includes(s);

// Uma seção está concluída quando todos os itens obrigatórios estão Concluído/NA.
// Sem itens obrigatórios, exige todos os itens.
function isSectionComplete(items) {
  const required = items.filter((i) => i.snapshotIsRequired);
  const check = required.length > 0 ? required : items;
  return check.length > 0 && check.every((i) => isDoneStatus(i.status));
}

/**
 * Cascata sequencial de prazos: cada seção conta o prazo a partir do momento em
 * que a seção ANTERIOR foi 100% concluída. A 1ª seção parte da âncora do run.
 * Seções ainda não iniciadas ficam com dueDate nulo (não entram no atraso).
 */
export async function recomputeCascadeDueDates(runId) {
  const run = await prisma.processRun.findUnique({ where: { id: runId }, select: { anchorAt: true } });
  if (!run) return;

  const items = await prisma.processItemRun.findMany({
    where: { runId },
    select: {
      id: true, status: true, doneAt: true, dueDate: true,
      snapshotSectionName: true, snapshotItemOrder: true, snapshotIsRequired: true,
      snapshotDueRuleType: true, snapshotDueRuleParam: true, snapshotOffsetDaysFromAnchor: true,
    },
  });

  const sections = orderRunSections(items);
  let sectionStart = run.anchorAt || null;

  for (const section of sections) {
    for (const it of section.items) {
      const nextDue = sectionStart ? computeDueDate(sectionStart, it) : null;
      const prev = it.dueDate ? it.dueDate.getTime() : null;
      const next = nextDue ? nextDue.getTime() : null;
      if (prev !== next) {
        await prisma.processItemRun.update({
          where: { id: it.id },
          data: { dueDate: nextDue, overdueNotifiedAt: null },
        });
      }
    }

    if (isSectionComplete(section.items)) {
      const doneTimes = section.items.map((i) => i.doneAt).filter(Boolean).map((d) => d.getTime());
      sectionStart = doneTimes.length ? new Date(Math.max(...doneTimes)) : (sectionStart || new Date());
    } else {
      sectionStart = null;
    }
  }
}

// ─── Âncora automática do processo ───────────────────────────────────────────

// Normaliza status para comparação: sem acento, maiúsculas, só alfanumérico.
// "Em Saída" e "EM_SAIDA" → "EMSAIDA".
export function normStatus(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Define quando a régua do processo começa a contar:
 *  - ENTRADA: a partir da data de cadastro da empresa.
 *  - SAIDA:   a partir do momento em que o status virou "Em Saída".
 * Retorna a data-âncora, ou null se ainda não deve começar (ex.: saída antes de
 * a empresa entrar em "Em Saída").
 */
export function resolveInitialAnchor({ type, company }) {
  if (!company) return null;
  if (type === "ENTRADA") {
    return company.dataCadastro ?? company.createdAt ?? new Date();
  }
  if (type === "SAIDA") {
    return normStatus(company.situacao) === "EMSAIDA" ? (company.dataSituacao ?? new Date()) : null;
  }
  return null;
}

/**
 * Ao mudar o status da empresa para "Em Saída", inicia a régua do processo de
 * SAÍDA (se existir e ainda não tiver âncora). Chamado pelas rotas que alteram
 * status (companyRoutes, expectationMatrixRoutes).
 */
export async function applyStatusChangeToSaidaRun(companyId, newStatus, whenDate) {
  if (normStatus(newStatus) !== "EMSAIDA") return;

  const run = await prisma.processRun.findFirst({
    where: { companyId, type: "SAIDA" },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, anchorAt: true },
  });
  if (!run || run.anchorAt) return;

  await prisma.processRun.update({
    where: { id: run.id },
    data: { anchorAt: whenDate ?? new Date() },
  });
  await recomputeCascadeDueDates(run.id);
}
