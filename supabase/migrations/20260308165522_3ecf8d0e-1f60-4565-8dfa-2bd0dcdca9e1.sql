
-- Create herbs encyclopedia table
CREATE TABLE public.herbs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_thai TEXT NOT NULL,
  name_english TEXT,
  name_scientific TEXT,
  local_names TEXT[],
  family TEXT,
  description TEXT,
  properties TEXT[],
  usage_instructions TEXT,
  dosage TEXT,
  precautions TEXT[],
  contraindications TEXT[],
  drug_interactions TEXT[],
  image_url TEXT,
  category TEXT DEFAULT 'ทั่วไป',
  is_in_nlem BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.herbs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view herbs" ON public.herbs FOR SELECT USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role can manage herbs" ON public.herbs FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_herbs_name_thai ON public.herbs(name_thai);
CREATE INDEX idx_herbs_category ON public.herbs(category);
CREATE INDEX idx_herbs_properties ON public.herbs USING GIN(properties);

-- Full text search
ALTER TABLE public.herbs ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(name_thai, '') || ' ' || coalesce(name_english, '') || ' ' || coalesce(name_scientific, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX idx_herbs_search ON public.herbs USING GIN(search_vector);

-- Trigger for updated_at
CREATE TRIGGER update_herbs_updated_at
  BEFORE UPDATE ON public.herbs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
