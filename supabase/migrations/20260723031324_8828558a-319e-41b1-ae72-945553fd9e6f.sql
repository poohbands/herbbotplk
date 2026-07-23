
CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'article',
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  source_url text,
  is_published boolean NOT NULL DEFAULT true,
  search_vector tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_documents TO anon, authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published knowledge"
  ON public.knowledge_documents FOR SELECT
  USING (is_published = true);

CREATE POLICY "Service role manages knowledge"
  ON public.knowledge_documents FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX knowledge_documents_search_idx ON public.knowledge_documents USING gin(search_vector);
CREATE INDEX knowledge_documents_tags_idx ON public.knowledge_documents USING gin(tags);
CREATE INDEX knowledge_documents_category_idx ON public.knowledge_documents(category);

CREATE OR REPLACE FUNCTION public.knowledge_documents_search_trigger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, '{}'), ' ')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.source, '')), 'C');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER knowledge_documents_search_update
  BEFORE INSERT OR UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_documents_search_trigger();
