import { prisma } from "./prisma.js";

export async function audit(req, action, entity, entityId, beforeJson, afterJson, actorUserIdOverride) {
  const actorUserId = actorUserIdOverride || req.user?.id;
  if (!actorUserId) return; // se não tiver ator (ex: login antes de autenticar), não grava

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entity,
      entityId,
      beforeJson,
      afterJson,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
  });
}