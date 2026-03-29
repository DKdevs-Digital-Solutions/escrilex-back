import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import { PrismaClient } from "@prisma/client";

const { PrismaClient, ChecklistType } = pkg;
const prisma = new PrismaClient();

// Usage:
//   node prisma/importTemplateFromXlsx.js /path/to/EMPRESA...xlsx
// This will create 2 templates (ENTRADA/SAIDA) based on sheet "1".
// Deadlines:
//   - ENTRADA: all items default to OFFSET_DAYS with null param (configure later)
//   - SAIDA: section headers like "... 10 dias" => OFFSET_DAYS=10
//            "até o dia 10 do mês subsequente" => DAY_OF_NEXT_MONTH=10

function norm(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function parseDueRuleFromSectionName(name) {
  const s = norm(name).toLowerCase();

  // e.g. "Societário 10 dias"
  const mDias = s.match(/(\d+)\s*dias?/);
  if (mDias) {
    return { dueRuleType: "OFFSET_DAYS", dueRuleParam: Number(mDias[1]) };
  }

  // e.g. "Folha até o dia 10 do mês subsequente"
  const mDiaMes = s.match(/ate\s+o\s+dia\s+(\d{1,2})\s+do\s+mes\s+subsequente/);
  if (mDiaMes) {
    return { dueRuleType: "DAY_OF_NEXT_MONTH", dueRuleParam: Number(mDiaMes[1]) };
  }

  return { dueRuleType: "OFFSET_DAYS", dueRuleParam: null };
}

function sectorNameFromSection(name) {
  const s = norm(name);
  // Remove common deadline suffixes like "10 dias" or "até o dia ..."
  return norm(
    s
      .replace(/\d+\s*dias?/gi, "")
      .replace(/ate\s+o\s+dia\s+\d{1,2}.*$/i, "")
      .replace(/\(.*\)$/g, "")
  );
}

function extractBlocksFromSheet(ws) {
  // We read columns B..E like your sheet:
  //  B: section/title or "AÇÃO XX"
  //  C: description
  //  D: status header/value
  //  E: observation

  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });

  const blocks = {
    ENTRADA: [],
    SAIDA: [],
  };

  let mode = null; // "ENTRADA" | "SAIDA"
  let currentSection = null;

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const b = r[1];
    const c = r[2];
    const d = r[3];

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

    // section header pattern: column B is a text (not "AÇÃO"), column C empty, column D == "Status"
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

    // item row pattern: B starts with "AÇÃO" and C is description
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
  const n = norm(name);
  if (!n) return null;
  return prisma.sector.upsert({
    where: { name: n },
    update: { active: true },
    create: { name: n },
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

  const wb = xlsx.readFile(file);
  const ws = wb.Sheets["1"];
  if (!ws) {
    console.error('Sheet "1" not found. Adjust the script to point to the sheet that contains the full checklist.');
    process.exit(1);
  }

  const blocks = extractBlocksFromSheet(ws);

  // Build templates
  for (const type of ["ENTRADA", "SAIDA"]) {
    const checklistType = type === "ENTRADA" ? ChecklistType.ENTRADA : ChecklistType.SAIDA;
    const name = type === "ENTRADA" ? "Checklist de Entrada (importado)" : "Checklist de Saída (importado)";

    const template = await prisma.checklistTemplate.create({
      data: {
        type: checklistType,
        name,
        version: 1,
        active: true,
      },
    });

    // Group by section in order of appearance
    const sectionOrder = [];
    const bySection = new Map();
    for (const it of blocks[type]) {
      if (!bySection.has(it.section)) {
        bySection.set(it.section, []);
        sectionOrder.push(it.section);
      }
      bySection.get(it.section).push(it);
    }

    for (let sIdx = 0; sIdx < sectionOrder.length; sIdx++) {
      const sectionName = sectionOrder[sIdx];
      const section = await prisma.checklistTemplateSection.create({
        data: {
          templateId: template.id,
          name: sectionName,
          order: sIdx,
        },
      });

      const rule = type === "SAIDA" ? parseDueRuleFromSectionName(sectionName) : { dueRuleType: "OFFSET_DAYS", dueRuleParam: null };

      const sectorName = sectorNameFromSection(sectionName);
      const sector = sectorName ? await upsertSectorByName(sectorName) : null;

      const items = bySection.get(sectionName) || [];
      for (let iIdx = 0; iIdx < items.length; iIdx++) {
        const item = items[iIdx];

        // heuristic: first action of each checklist becomes the anchor trigger
        const isFirstAction = item.code.toUpperCase() === "AÇÃO 01";

        await prisma.checklistTemplateItem.create({
          data: {
            sectionId: section.id,
            code: item.code,
            description: item.description,
            order: iIdx,
            isRequired: isFirstAction,
            sectorId: sector?.id,
            dueRuleType: rule.dueRuleType,
            dueRuleParam: rule.dueRuleParam,
          },
        });
      }
    }

    console.log(`Created template ${type}:`, template.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
