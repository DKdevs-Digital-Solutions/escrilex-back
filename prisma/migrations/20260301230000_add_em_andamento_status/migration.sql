-- Add new status used by the frontend dropdown
DO $$
BEGIN
  ALTER TYPE public."ItemStatus" ADD VALUE 'EM_ANDAMENTO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
