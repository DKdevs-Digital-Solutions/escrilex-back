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
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_SECURE: String(process.env.SMTP_SECURE || "false") === "true",
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || "no-reply@local",
  OVERDUE_SCAN_EVERY_MINUTES: Number(process.env.OVERDUE_SCAN_EVERY_MINUTES || 10),
};
