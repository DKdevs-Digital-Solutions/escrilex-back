-- Notificações passam a ser enviadas via Microsoft Teams; configuração de e-mail (SMTP) removida.

CREATE TABLE IF NOT EXISTS "NotificationConfig" (
  "id" TEXT NOT NULL,
  "singletonKey" TEXT NOT NULL DEFAULT 'main',
  "webhookUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationConfig_singletonKey_key"
  ON "NotificationConfig"("singletonKey");

DROP TABLE IF EXISTS "EmailAccountConfig";
