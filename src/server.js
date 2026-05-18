import express from "express";
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
import { prisma } from "./prisma.js";

const app = express();

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const requestedHeaders = req.headers["access-control-request-headers"];

  // Sem credentials, pode liberar origem dinâmica com segurança para dev/produção.
  // Isso evita falha no localhost:5173 e também em domínios de produção.
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin, Access-Control-Request-Headers");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    requestedHeaders || "Content-Type, Authorization, Accept, Origin, X-Requested-With, X-Api-Key",
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// CORS deve ser o primeiro middleware real da API.
app.use((req, res, next) => {
  applyCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

app.use(express.json({ limit: "10mb" }));

registerSwagger(app);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, db: true });
  } catch (error) {
    console.error("health/db failed", error);
    return res.status(500).json({ ok: false, db: false, error: error.message });
  }
});

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

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

// Mantém CORS até em erros de rota/middleware, para o browser mostrar o erro real.
app.use((error, req, res, _next) => {
  console.error(error);
  applyCorsHeaders(req, res);

  const status = Number(error.status || error.statusCode || 500);
  return res.status(status).json({
    error: status === 500 ? "INTERNAL_SERVER_ERROR" : error.code || "REQUEST_ERROR",
    message: error.message || "Erro interno do servidor.",
  });
});

const interval = setInterval(async () => {
  try {
    await scanAndNotifyOverdue();
  } catch (error) {
    console.error(error);
  }
}, env.OVERDUE_SCAN_EVERY_MINUTES * 60 * 1000);

interval.unref?.();

const port = Number(process.env.PORT || env.API_PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`API http://0.0.0.0:${port}`));
