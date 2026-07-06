import { prisma } from "./prisma.js";
import { env } from "./env.js";

// Notificações do sistema são enviadas para um canal do Microsoft Teams através
// de uma URL de webhook (Power Automate / Workflows ou Incoming Webhook).
//
// A configuração vem primeiro do banco (NotificationConfig, singleton "main");
// se ausente/inativa, cai para a variável de ambiente TEAMS_WEBHOOK_URL.

async function loadConfig() {
  try {
    const cfg = await prisma.notificationConfig.findUnique({ where: { singletonKey: "main" } });
    if (cfg?.active && cfg.webhookUrl) return { webhookUrl: cfg.webhookUrl, source: "database" };
  } catch (error) {
    console.error("[TEAMS_CONFIG_LOAD_ERROR]", error);
  }

  if (env.TEAMS_WEBHOOK_URL) {
    return { webhookUrl: env.TEAMS_WEBHOOK_URL, source: "env" };
  }
  return null;
}

/**
 * Envia uma notificação para o Teams.
 * @param {object} params
 * @param {string[]} [params.recipients] E-mails dos responsáveis (exibidos no card).
 * @param {string} params.title Título da notificação.
 * @param {string} [params.text] Corpo/descrição.
 * @param {{name:string, value:string}[]} [params.facts] Pares rótulo/valor exibidos no card.
 */
export async function sendTeamsNotification({ recipients = [], title, text = "", facts = [] }) {
  const config = await loadConfig();
  if (!config) {
    console.log("[TEAMS MOCK]", { recipients, title, text, facts });
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAdaptiveCard({ recipients, title, text, facts })),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[TEAMS_WEBHOOK_ERROR]", res.status, detail);
      return { delivered: false, reason: `http_${res.status}` };
    }
    return { delivered: true };
  } catch (error) {
    console.error("[TEAMS_SEND_ERROR]", error);
    return { delivered: false, reason: "send_error" };
  }
}

function buildAdaptiveCard({ recipients, title, text, facts }) {
  const body = [
    { type: "TextBlock", size: "Medium", weight: "Bolder", text: title, wrap: true },
  ];
  if (text) body.push({ type: "TextBlock", text, wrap: true, spacing: "Small" });

  const factItems = [...facts];
  if (recipients.length) {
    factItems.push({ name: "Responsáveis", value: recipients.join(", ") });
  }
  if (factItems.length) {
    body.push({
      type: "FactSet",
      facts: factItems.map((f) => ({ title: f.name, value: String(f.value ?? "—") })),
    });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
        },
      },
    ],
  };
}
