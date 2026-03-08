
CREATE TABLE public.thai_formulas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_thai text NOT NULL,
  name_english text,
  formula_code text,
  category text DEFAULT 'ตำรับยาแผนไทย',
  is_in_nlem boolean DEFAULT true,
  indication text,
  ingredients text[] DEFAULT '{}',
  preparation text,
  dosage text,
  usage_instructions text,
  precautions text[] DEFAULT '{}',
  contraindications text[] DEFAULT '{}',
  drug_interactions text[] DEFAULT '{}',
  properties text[] DEFAULT '{}',
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.thai_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view formulas" ON public.thai_formulas FOR SELECT USING (true);
CREATE POLICY "Service role can manage formulas" ON public.thai_formulas FOR ALL USING (true) WITH CHECK (true);
