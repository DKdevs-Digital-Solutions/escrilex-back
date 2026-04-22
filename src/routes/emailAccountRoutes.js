import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

export const emailAccountRoutes = Router();

const createSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  username: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

function serialize(account) {
  if (!account) return null;
  return {
    id: account.id,
    host: account.host,
    port: account.port,
    secure: account.secure,
    username: account.username,
    fromEmail: account.fromEmail,
    fromName: account.fromName,
    active: account.active,
    hasPassword: Boolean(account.password),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

emailAccountRoutes.get("/email-account", async (_req, res) => {
  const account = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  res.json(serialize(account));
});

emailAccountRoutes.post("/email-account", async (req, res) => {
  const body = createSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  if (existing) {
    return res.status(409).json({ error: "Já existe uma conta de e-mail cadastrada" });
  }

  const account = await prisma.emailAccountConfig.create({
    data: {
      singletonKey: "main",
      host: body.data.host,
      port: body.data.port,
      secure: body.data.secure,
      username: body.data.username,
      password: body.data.password,
      fromEmail: body.data.fromEmail,
      fromName: body.data.fromName ?? null,
      active: body.data.active,
    },
  });

  await audit(req, "EMAIL_ACCOUNT_CREATE", "EmailAccountConfig", account.id, undefined, serialize(account));
  res.status(201).json(serialize(account));
});

emailAccountRoutes.put("/email-account", async (req, res) => {
  const body = updateSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  if (!existing) {
    return res.status(404).json({ error: "Conta de e-mail não encontrada" });
  }

  const updated = await prisma.emailAccountConfig.update({
    where: { singletonKey: "main" },
    data: {
      ...(body.data.host !== undefined ? { host: body.data.host } : {}),
      ...(body.data.port !== undefined ? { port: body.data.port } : {}),
      ...(body.data.secure !== undefined ? { secure: body.data.secure } : {}),
      ...(body.data.username !== undefined ? { username: body.data.username } : {}),
      ...(body.data.password !== undefined ? { password: body.data.password } : {}),
      ...(body.data.fromEmail !== undefined ? { fromEmail: body.data.fromEmail } : {}),
      ...(body.data.fromName !== undefined ? { fromName: body.data.fromName ?? null } : {}),
      ...(body.data.active !== undefined ? { active: body.data.active } : {}),
    },
  });

  await audit(req, "EMAIL_ACCOUNT_UPDATE", "EmailAccountConfig", updated.id, serialize(existing), serialize(updated));
  res.json(serialize(updated));
});

emailAccountRoutes.delete("/email-account", async (req, res) => {
  const existing = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  if (!existing) {
    return res.status(404).json({ error: "Conta de e-mail não encontrada" });
  }

  await prisma.emailAccountConfig.delete({ where: { singletonKey: "main" } });
  await audit(req, "EMAIL_ACCOUNT_DELETE", "EmailAccountConfig", existing.id, serialize(existing), undefined);
  res.json({ ok: true });
});
