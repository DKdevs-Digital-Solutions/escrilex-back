-- Adiciona coluna enabledEvents à tabela NotificationConfig
ALTER TABLE "NotificationConfig"
  ADD COLUMN IF NOT EXISTS "enabledEvents" JSONB NOT NULL DEFAULT '[]';
