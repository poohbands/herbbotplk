
-- Fix: Drop the security definer view and recreate as invoker
DROP VIEW IF EXISTS public.chat_statistics;
CREATE VIEW public.chat_statistics WITH (security_invoker = true) AS
SELECT
  COUNT(*) FILTER (WHERE role = 'user') AS total_questions,
  COUNT(*) FILTER (WHERE category = 'drug_interaction') AS drug_interaction_count,
  COUNT(*) FILTER (WHERE category = 'herbal_info') AS herbal_info_count,
  COUNT(*) FILTER (WHERE category = 'dosage') AS dosage_count,
  COUNT(*) FILTER (WHERE category = 'side_effects') AS side_effects_count,
  COUNT(*) FILTER (WHERE category = 'general') AS general_count,
  COUNT(DISTINCT session_id) AS total_sessions
FROM public.chat_messages;
