ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_link text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_checked_at timestamp with time zone;