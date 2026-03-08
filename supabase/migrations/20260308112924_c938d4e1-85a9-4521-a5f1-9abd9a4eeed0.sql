-- Create master products table
CREATE TABLE public.products_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  variant text DEFAULT NULL,
  normalized_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.products_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to products_master" ON public.products_master FOR ALL USING (true) WITH CHECK (true);

-- Add master_product_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS master_product_id uuid REFERENCES public.products_master(id) DEFAULT NULL;

-- Create price comparisons table
CREATE TABLE public.price_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_product_id uuid REFERENCES public.products_master(id) ON DELETE CASCADE NOT NULL,
  cheapest_store text NOT NULL,
  cheapest_price numeric NOT NULL,
  price_difference numeric NOT NULL DEFAULT 0,
  all_prices jsonb NOT NULL DEFAULT '[]'::jsonb,
  compared_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.price_comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to price_comparisons" ON public.price_comparisons FOR ALL USING (true) WITH CHECK (true);