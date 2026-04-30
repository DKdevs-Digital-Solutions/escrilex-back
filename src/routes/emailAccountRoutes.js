import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

export const emailAccountRoutes = Router();

const emailAccountPaths = ["/email-account", "/email-accounts"];

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "sim"].includes(normalized)) return true;
  if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;

  return value;
}

const emptyToUndefined = (value) => (value === "" || value === null ? undefined : value);
const emptyToNull = (value) => (value === "" ? null : value);

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional());
const optionalPort = z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).optional());
const optionalBoolean = z.preprocess(parseBoolean, z.boolean().optional());
const nullableFromName = z.preprocess(emptyToNull, z.string().nullable().optional());

const saveSchema = z.object({
  host: optionalString,
  port: optionalPort,
  secure: optionalBoolean,
  username: optionalString,
  password: optionalString,
  fromEmail: optionalEmail,
  fromName: nullableFromName,
  active: optionalBoolean,
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

function pickDefined(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function validateRequiredForCreate(data) {
  const requiredFields = ["host", "username", "password", "fromEmail"];
  const missing = requiredFields.filter((field) => data[field] === undefined);

  if (missing.length > 0) {
    return { missing };
  }

  return null;
}

emailAccountRoutes.get(emailAccountPaths, async (_req, res) => {
  const account = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  res.json(serialize(account));
});

emailAccountRoutes.post(emailAccountPaths, async (req, res) => {
  const body = saveSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  const data = pickDefined(body.data);

  if (!existing) {
    const missing = validateRequiredForCreate(data);
    if (missing) return res.status(400).json({ error: "Campos obrigatórios ausentes", ...missing });
  }

  const account = await prisma.emailAccountConfig.upsert({
    where: { singletonKey: "main" },
    create: {
      singletonKey: "main",
      host: data.host,
      port: data.port ?? 587,
      secure: data.secure ?? false,
      username: data.username,
      password: data.password,
      fromEmail: data.fromEmail,
      fromName: data.fromName ?? null,
      active: data.active ?? true,
    },
    update: data,
  });

  await audit(
    req,
    existing ? "EMAIL_ACCOUNT_UPDATE" : "EMAIL_ACCOUNT_CREATE",
    "EmailAccountConfig",
    account.id,
    existing ? serialize(existing) : undefined,
    serialize(account),
  );

  res.status(existing ? 200 : 201).json(serialize(account));
});

emailAccountRoutes.put(emailAccountPaths, async (req, res) => {
  const body = saveSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  if (!existing) {
    return res.status(404).json({ error: "Conta de e-mail não encontrada" });
  }

  const updated = await prisma.emailAccountConfig.update({
    where: { singletonKey: "main" },
    data: pickDefined(body.data),
  });

  await audit(req, "EMAIL_ACCOUNT_UPDATE", "EmailAccountConfig", updated.id, serialize(existing), serialize(updated));
  res.json(serialize(updated));
});

emailAccountRoutes.delete(emailAccountPaths, async (req, res) => {
  const existing = await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  if (!existing) {
    return res.status(404).json({ error: "Conta de e-mail não encontrada" });
  }

  await prisma.emailAccountConfig.delete({ where: { singletonKey: "main" } });
  await audit(req, "EMAIL_ACCOUNT_DELETE", "EmailAccountConfig", existing.id, serialize(existing), undefined);
  res.json({ ok: true });
});
