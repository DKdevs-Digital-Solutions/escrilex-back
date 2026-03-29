import nodemailer from "nodemailer";
import { env } from "./env.js";

const enabled = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

export const mailer = enabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export async function sendMail(to, subject, text) {
  if (!mailer) {
    console.log("[EMAIL MOCK]", { to, subject, text });
    return;
  }
  await mailer.sendMail({ from: env.SMTP_FROM, to, subject, text });
}
