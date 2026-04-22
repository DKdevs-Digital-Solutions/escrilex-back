import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { authRequired, requireRoles, RoleName } from "./auth.js";
import { authRoutes } from "./routes/authRoutes.js";
import { adminRoutes } from "./routes/adminRoutes.js";
import { companyRoutes } from "./routes/companyRoutes.js";
import { checklistRoutes } from "./routes/checklistRoutes.js";
import { templateRoutes } from "./routes/templateRoutes.js";
import { integrationRoutes } from "./routes/integrationRoutes.js";
import { lookupRoutes } from "./routes/lookupRoutes.js";
import { dashboardRoutes } from "./routes/dashboardRoutes.js";
import { emailAccountRoutes } from "./routes/emailAccountRoutes.js";
import { scanAndNotifyOverdue } from "./overdueScanner.js";
import { registerSwagger } from "./swagger.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));

registerSwagger(app);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

app.use("/api", authRequired);
app.get("/api/auth/me", (req, res) => res.json(req.user));

app.use("/api/admin", requireRoles(RoleName.ADMIN), adminRoutes);
app.use("/api/admin", requireRoles(RoleName.ADMIN), emailAccountRoutes);
app.use("/api/lookup", requireRoles(RoleName.ADMIN, RoleName.GESTOR_EMPRESA), lookupRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/templates", requireRoles(RoleName.ADMIN, RoleName.GESTOR_EMPRESA), templateRoutes);
app.use("/api/checklists", checklistRoutes);

const interval = setInterval(async () => {
  try {
    await scanAndNotifyOverdue();
  } catch (error) {
    console.error(error);
  }
}, env.OVERDUE_SCAN_EVERY_MINUTES * 60 * 1000);

interval.unref?.();

app.listen(env.API_PORT, () => console.log(`API http://localhost:${env.API_PORT}`));
