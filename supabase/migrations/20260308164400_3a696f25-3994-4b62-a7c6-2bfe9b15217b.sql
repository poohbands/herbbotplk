
-- Create enum for question categories
CREATE TYPE public.question_category AS ENUM ('herbal_info', 'drug_interaction', 'dosage', 'side_effects', 'general');

-- Create enum for interaction severity
CREATE TYPE public.interaction_severity AS ENUM ('major', 'moderate', 'minor', 'none');

-- Create chat_sessions table
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  category question_category DEFAULT 'general',
  severity interaction_severity,
  sources TEXT[],
  herbs_mentioned TEXT[],
  drugs_mentioned TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for chat (no auth required for this app)
CREATE POLICY "Anyone can create sessions" ON public.chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view sessions" ON public.chat_sessions FOR SELECT USING (true);

CREATE POLICY "Anyone can create messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view messages" ON public.chat_messages FOR SELECT USING (true);

-- Create indexes
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_category ON public.chat_messages(category);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);
CREATE INDEX idx_chat_messages_herbs ON public.chat_messages USING GIN(herbs_mentioned);
CREATE INDEX idx_chat_messages_drugs ON public.chat_messages USING GIN(drugs_mentioned);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create view for admin statistics
CREATE OR REPLACE VIEW public.chat_statistics AS
SELECT
  COUNT(*) FILTER (WHERE role = 'user') AS total_questions,
  COUNT(*) FILTER (WHERE category = 'drug_interaction') AS drug_interaction_count,
  COUNT(*) FILTER (WHERE category = 'herbal_info') AS herbal_info_count,
  COUNT(*) FILTER (WHERE category = 'dosage') AS dosage_count,
  COUNT(*) FILTER (WHERE category = 'side_effects') AS side_effects_count,
  COUNT(*) FILTER (WHERE category = 'general') AS general_count,
  COUNT(DISTINCT session_id) AS total_sessions
FROM public.chat_messages;
