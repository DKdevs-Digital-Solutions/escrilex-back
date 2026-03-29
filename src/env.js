import "dotenv/config";

export const env = {
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
  API_PORT: Number(process.env.API_PORT || 3000),
  WEB_ORIGIN: process.env.WEB_ORIGIN || "http://localhost:5173",
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || "no-reply@local",
  OVERDUE_SCAN_EVERY_MINUTES: Number(process.env.OVERDUE_SCAN_EVERY_MINUTES || 10),
};
