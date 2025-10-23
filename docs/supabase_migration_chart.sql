-- Adds optional chart_json column for storing chart wizard output
ALTER TABLE public.answers
ADD COLUMN IF NOT EXISTS chart_json JSONB NULL;
