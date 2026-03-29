-- Add EM_ANDAMENTO and switch FEITO -> CONCLUIDO in ItemStatus
-- This keeps history compatible while using the new label in the app.

DO $$
BEGIN
  -- Ensure enum type exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ItemStatus'
  ) THEN
    RAISE NOTICE 'Enum type public."ItemStatus" not found, skipping.';
    RETURN;
  END IF;

  -- 1) Add EM_ANDAMENTO if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ItemStatus' AND e.enumlabel = 'EM_ANDAMENTO'
  ) THEN
    BEGIN
      ALTER TYPE public."ItemStatus" ADD VALUE 'EM_ANDAMENTO' AFTER 'PENDENTE';
    EXCEPTION
      WHEN duplicate_object THEN
        -- value already exists (race)
        NULL;
    END;
  END IF;

  -- 2) Make sure we end with CONCLUIDO (rename FEITO when possible)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ItemStatus' AND e.enumlabel = 'CONCLUIDO'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'ItemStatus' AND e.enumlabel = 'FEITO'
    ) THEN
      BEGIN
        ALTER TYPE public."ItemStatus" RENAME VALUE 'FEITO' TO 'CONCLUIDO';
      EXCEPTION
        WHEN invalid_parameter_value THEN
          -- older postgres versions or unexpected state
          NULL;
      END;
    ELSE
      BEGIN
        ALTER TYPE public."ItemStatus" ADD VALUE 'CONCLUIDO' BEFORE 'NA';
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END IF;
  END IF;
END $$;
