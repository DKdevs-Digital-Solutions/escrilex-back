import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, verifyPassword } from "../auth.js";
import { audit } from "../audit.js";

export const authRoutes = Router();

authRoutes.post("/login", async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const user = await prisma.user.findUnique({
    where: { email: body.data.email },
    include: { roles: { include: { role: true } } },
  });
  if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await verifyPassword(body.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const payload = { id: user.id, email: user.email, roles: user.roles.map((r) => r.role.name) };
  const token = signToken(payload);
  await audit(req, "LOGIN", "User", user.id, undefined, { email: user.email }, user.id);
  res.json({ token, user: payload });
});
