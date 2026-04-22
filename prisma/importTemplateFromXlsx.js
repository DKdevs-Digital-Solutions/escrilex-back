import fs from "fs";
import xlsx from "xlsx";
import { PrismaClient, ChecklistType } from "@prisma/client";

const prisma = new PrismaClient();

function norm(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function parseDueRuleFromSectionName(name) {
  const s = norm(name).toLowerCase();

  const mDias = s.match(/(\d+)\s*dias?/);
  if (mDias) {
    return { dueRuleType: "OFFSET_DAYS", dueRuleParam: Number(mDias[1]) };
  }

  const mDiaMes = s.match(/ate\s+o\s+dia\s+(\d{1,2})\s+do\s+mes\s+subsequente/);
  if (mDiaMes) {
    return { dueRuleType: "DAY_OF_NEXT_MONTH", dueRuleParam: Number(mDiaMes[1]) };
  }

  return { dueRuleType: "OFFSET_DAYS", dueRuleParam: null };
}

function sectorNameFromSection(name) {
  const s = norm(name);
  return norm(
    s
      .replace(/\d+\s*dias?/gi, "")
      .replace(/ate\s+o\s+dia\s+\d{1,2}.*$/i, "")
      .replace(/\(.*\)$/g, ""),
  );
}

function extractBlocksFromSheet(ws) {
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

  const blocks = {
    ENTRADA: [],
    SAIDA: [],
  };

  let mode = null;
  let currentSection = null;

  for (const row of rows) {
    const b = row[1];
    const c = row[2];
    const d = row[3];
    const bStr = typeof b === "string" ? norm(b) : "";

    if (bStr.toUpperCase() === "AÇÕES DE ENTRADA") {
      mode = "ENTRADA";
      currentSection = null;
      continue;
    }

    if (bStr.toUpperCase() === "AÇÕES DE SAIDA" || bStr.toUpperCase() === "AÇÕES DE SAÍDA") {
      mode = "SAIDA";
      currentSection = null;
      continue;
    }

    if (
      mode &&
      typeof b === "string" &&
      !bStr.toUpperCase().startsWith("AÇÃO") &&
      (d === "Status" || d === "STATUS") &&
      (c === null || c === "")
    ) {
      currentSection = bStr;
      continue;
    }

    if (mode && bStr.toUpperCase().startsWith("AÇÃO") && typeof c === "string") {
      if (!currentSection) currentSection = "Geral";
      blocks[mode].push({
        section: currentSection,
        code: bStr,
        description: norm(c),
      });
    }
  }

  return blocks;
}

async function upsertSectorByName(name) {
  const normalized = norm(name);
  if (!normalized) return null;

  return prisma.sector.upsert({
    where: { name: normalized },
    update: { active: true },
    create: { name: normalized },
  });
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node prisma/importTemplateFromXlsx.js /path/to/file.xlsx");
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error("File not found:", file);
    process.exit(1);
  }

  const workbook = xlsx.readFile(file);
  const worksheet = workbook.Sheets["1"];
  if (!worksheet) {
    console.error('Sheet "1" not found.');
    process.exit(1);
  }

  const blocks = extractBlocksFromSheet(worksheet);

  for (const type of ["ENTRADA", "SAIDA"]) {
    const checklistType = type === "ENTRADA" ? ChecklistType.ENTRADA : ChecklistType.SAIDA;
    const template = await prisma.checklistTemplate.create({
      data: {
        type: checklistType,
        name: type === "ENTRADA" ? "Checklist de Entrada (importado)" : "Checklist de Saída (importado)",
        version: 1,
        active: true,
      },
    });

    const sectionOrder = [];
    const bySection = new Map();

    for (const item of blocks[type]) {
      if (!bySection.has(item.section)) {
        bySection.set(item.section, []);
        sectionOrder.push(item.section);
      }
      bySection.get(item.section).push(item);
    }

    for (let sectionIndex = 0; sectionIndex < sectionOrder.length; sectionIndex += 1) {
      const sectionName = sectionOrder[sectionIndex];
      const section = await prisma.checklistTemplateSection.create({
        data: {
          templateId: template.id,
          name: sectionName,
          order: sectionIndex,
        },
      });

      const rule =
        type === "SAIDA"
          ? parseDueRuleFromSectionName(sectionName)
          : { dueRuleType: "OFFSET_DAYS", dueRuleParam: null };

      const sector = await upsertSectorByName(sectorNameFromSection(sectionName));
      const items = bySection.get(sectionName) || [];

      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        const isFirstAction = item.code.toUpperCase() === "AÇÃO 01";

        await prisma.checklistTemplateItem.create({
          data: {
            sectionId: section.id,
            code: item.code,
            description: item.description,
            order: itemIndex,
            isRequired: isFirstAction,
            sectorId: sector?.id,
            dueRuleType: rule.dueRuleType,
            dueRuleParam: rule.dueRuleParam,
          },
        });
      }
    }

    console.log(`Created template ${type}: ${template.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
