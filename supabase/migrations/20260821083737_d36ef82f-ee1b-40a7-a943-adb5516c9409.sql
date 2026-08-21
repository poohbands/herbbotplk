CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text,
  source_type text NOT NULL DEFAULT 'file',
  status text NOT NULL DEFAULT 'pending',
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  committed_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO anon, authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view import jobs" ON public.import_jobs FOR SELECT USING (true);
CREATE POLICY "Anyone can create import jobs" ON public.import_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update import jobs" ON public.import_jobs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete import jobs" ON public.import_jobs FOR DELETE USING (true);
CREATE TRIGGER update_import_jobs_updated_at BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.data_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  note text,
  herbs jsonb NOT NULL DEFAULT '[]'::jsonb,
  thai_formulas jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  herbs_count integer NOT NULL DEFAULT 0,
  formulas_count integer NOT NULL DEFAULT 0,
  knowledge_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.data_versions TO anon, authenticated;
GRANT ALL ON public.data_versions TO service_role;
ALTER TABLE public.data_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view data versions" ON public.data_versions FOR SELECT USING (true);
CREATE POLICY "Anyone can create data versions" ON public.data_versions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete data versions" ON public.data_versions FOR DELETE USING (true);