import nodemailer from "nodemailer";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

function buildFrom(configOrEnv) {
  if (configOrEnv.fromName) return `${configOrEnv.fromName} <${configOrEnv.fromEmail}>`;
  return configOrEnv.fromEmail;
}

function createTransportFromEnv() {
  if (!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) return null;

  return {
    transport: nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    }),
    from: env.SMTP_FROM,
  };
}

export async function getActiveEmailAccount() {
  try {
    return await prisma.emailAccountConfig.findUnique({ where: { singletonKey: "main" } });
  } catch (error) {
    console.error("[EMAIL_ACCOUNT_LOAD_ERROR]", error);
    return null;
  }
}

export async function getMailerConfig() {
  const account = await getActiveEmailAccount();

  if (account?.active) {
    return {
      transport: nodemailer.createTransport({
        host: account.host,
        port: account.port,
        secure: account.secure,
        auth: {
          user: account.username,
          pass: account.password,
        },
      }),
      from: buildFrom(account),
      source: "database",
    };
  }

  const fallback = createTransportFromEnv();
  if (!fallback) return null;

  return {
    ...fallback,
    source: "env",
  };
}

export async function sendMail(to, subject, text) {
  const config = await getMailerConfig();
  if (!config) {
    console.log("[EMAIL MOCK]", { to, subject, text });
    return;
  }

  await config.transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
  });
}
