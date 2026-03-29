import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const { PrismaClient, RoleName } = pkg;
const prisma = new PrismaClient();

async function ensureRole(name) {
  await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
}

async function main() {
  await Promise.all([
    ensureRole(RoleName.ADMIN),
    ensureRole(RoleName.GESTOR_EMPRESA),
    ensureRole(RoleName.OPERADOR),
    ensureRole(RoleName.LEITURA),
  ]);

  const email = "admin@local.com";
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Admin", email, passwordHash, active: true },
  });

  const role = await prisma.role.findUnique({ where: { name: RoleName.ADMIN } });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: role.id } },
      update: {},
      create: { userId: admin.id, roleId: role.id },
    });
  }

  for (const name of ["Comercial", "Societário", "Fiscal", "Contábil", "DP", "Compliance"]) {
    await prisma.sector.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log("Seed OK: admin@local.com / admin123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
