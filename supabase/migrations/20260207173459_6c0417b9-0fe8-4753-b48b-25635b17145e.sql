
-- Drop overly permissive SELECT policies on internal workflow tables
DROP POLICY IF EXISTS "Content suggestions are publicly readable" ON public.content_suggestions;
DROP POLICY IF EXISTS "Sources are publicly readable" ON public.sources;

-- content_suggestions and sources should NOT be publicly readable
-- They are internal admin workflow data accessed only via edge functions (service role key)
-- No new SELECT policies needed - RLS is already enabled, default-deny applies
