ALTER TABLE public.deals
ADD COLUMN IF NOT EXISTS ai_score numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_message text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_processed_at timestamp with time zone DEFAULT NULL;