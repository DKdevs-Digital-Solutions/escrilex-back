import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { audit } from "../audit.js";

export const notificationConfigRoutes = Router();

// Aceita ambos os caminhos por compatibilidade.
const configPaths = ["/notification-config", "/teams-config"];

const emptyToNull = (value) => (value === "" ? null : value);

const nullableString = z.preprocess(emptyToNull, z.string().nullable().optional());
const optionalBoolean = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "sim"].includes(normalized)) return true;
  if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

const saveSchema = z.object({
  webhookUrl: nullableString,
  active: optionalBoolean,
});

function serialize(config) {
  if (!config) return null;
  return {
    id: config.id,
    webhookUrl: config.webhookUrl,
    active: config.active,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function pickDefined(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

notificationConfigRoutes.get(configPaths, async (_req, res) => {
  const config = await prisma.notificationConfig.findUnique({ where: { singletonKey: "main" } });
  res.json(serialize(config));
});

async function upsertConfig(req, res) {
  const body = saveSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const existing = await prisma.notificationConfig.findUnique({ where: { singletonKey: "main" } });
  const data = pickDefined(body.data);

  const config = await prisma.notificationConfig.upsert({
    where: { singletonKey: "main" },
    create: {
      singletonKey: "main",
      webhookUrl: data.webhookUrl ?? null,
      active: data.active ?? true,
    },
    update: data,
  });

  await audit(
    req,
    existing ? "NOTIFICATION_CONFIG_UPDATE" : "NOTIFICATION_CONFIG_CREATE",
    "NotificationConfig",
    config.id,
    existing ? serialize(existing) : undefined,
    serialize(config),
  );

  res.status(existing ? 200 : 201).json(serialize(config));
}

notificationConfigRoutes.post(configPaths, upsertConfig);
notificationConfigRoutes.put(configPaths, upsertConfig);

notificationConfigRoutes.delete(configPaths, async (req, res) => {
  const existing = await prisma.notificationConfig.findUnique({ where: { singletonKey: "main" } });
  if (!existing) return res.status(404).json({ error: "Configuração não encontrada" });

  await prisma.notificationConfig.delete({ where: { singletonKey: "main" } });
  await audit(req, "NOTIFICATION_CONFIG_DELETE", "NotificationConfig", existing.id, serialize(existing), undefined);
  res.json({ ok: true });
});
