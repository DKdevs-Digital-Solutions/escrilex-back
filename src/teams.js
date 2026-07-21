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
    if (cfg?.active && cfg.webhookUrl) return { webhookUrl: cfg.webhookUrl, enabledEvents: cfg.enabledEvents ?? [], source: "database" };
  } catch (error) {
    console.error("[TEAMS_CONFIG_LOAD_ERROR]", error);
  }

  if (env.TEAMS_WEBHOOK_URL) {
    return { webhookUrl: env.TEAMS_WEBHOOK_URL, enabledEvents: [], source: "env" };
  }
  return null;
}

/**
 * Verifica se um evento está habilitado nas configurações.
 * Array vazio = sem filtro (todos habilitados — comportamento legado).
 */
export async function isEventEnabled(eventKey) {
  const config = await loadConfig();
  if (!config) return false;
  const events = Array.isArray(config.enabledEvents) ? config.enabledEvents : [];
  if (events.length === 0) return true;
  return events.includes(eventKey);
}

/**
 * Envia uma notificação para o Teams.
 * @param {object} params
 * @param {string} [params.eventKey] Chave do evento (verifica se está habilitado).
 * @param {string[]} [params.recipients] E-mails dos responsáveis (exibidos no card).
 * @param {string} params.title Título da notificação.
 * @param {string} [params.text] Corpo/descrição.
 * @param {{name:string, value:string}[]} [params.facts] Pares rótulo/valor exibidos no card.
 */
export async function sendTeamsNotification({ eventKey, recipients = [], title, text = "", facts = [] }) {
  if (eventKey) {
    const enabled = await isEventEnabled(eventKey);
    if (!enabled) return { delivered: false, reason: "event_disabled" };
  }

  const config = await loadConfig();
  if (!config) {
    console.log("[TEAMS MOCK]", { eventKey, recipients, title, text, facts });
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload({ eventKey, recipients, title, text, facts })),
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

// Payload plano — fácil de tratar no Power Automate via triggerBody()?['campo']
export function buildPayload({ eventKey, recipients = [], title, text = "", facts = [] }) {
  const payload = {
    evento: eventKey ?? "notification",
    titulo: title,
    descricao: text || null,
    responsaveis: recipients.length ? recipients.join(", ") : null,
    data: new Date().toLocaleString("pt-BR"),
  };

  // Expande cada fact como campo direto: { name: "Empresa", value: "X" } → payload.empresa = "X"
  for (const f of facts) {
    const key = factKey(f.name);
    if (!key) continue;
    payload[key] = String(f.value ?? "");
  }

  return payload;
}

// "Razão Social" → "razao_social".
export function factKey(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
