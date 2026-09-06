CREATE TABLE public.ai_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider_key TEXT NOT NULL UNIQUE,
  api_key TEXT,
  base_url TEXT,
  model_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_providers TO service_role;

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ai_providers_updated_at
BEFORE UPDATE ON public.ai_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_providers (name, provider_key, base_url, model_name, priority) VALUES
  ('Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-flash', 1),
  ('DeepSeek', 'deepseek', 'https://api.deepseek.com', 'deepseek-chat', 2),
  ('OpenRouter', 'openrouter', 'https://openrouter.ai/api/v1', 'deepseek/deepseek-chat', 3),
  ('Qwen', 'qwen', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen-plus', 4);