import "dotenv/config";

const rawWebOrigins = process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || "http://localhost:5173,http://localhost:3000";
const webOrigins = rawWebOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
  API_PORT: Number(process.env.API_PORT || 3000),
  WEB_ORIGIN: webOrigins[0] || "http://localhost:5173",
  WEB_ORIGINS: webOrigins,
  // Notificações via Microsoft Teams (webhook Power Automate/Workflows ou Incoming Webhook).
  TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL,
  OVERDUE_SCAN_EVERY_MINUTES: Number(process.env.OVERDUE_SCAN_EVERY_MINUTES || 10),
};
