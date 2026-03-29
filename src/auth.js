import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

export const RoleName = { ADMIN: "ADMIN", GESTOR_EMPRESA: "GESTOR_EMPRESA", OPERADOR: "OPERADOR", LEITURA: "LEITURA" };

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, roles: user.roles }, env.JWT_SECRET, { expiresIn: "8h" });
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function authRequired(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = h.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRoles(...allowed) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const ok = (user.roles || []).some((r) => allowed.includes(r));
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}


// RoleName is already exported above via `export const RoleName = ...`
