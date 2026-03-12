-- Revoke public access to invoke_edge_function to prevent unauthenticated abuse
REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text, jsonb) FROM authenticated;

-- Only service_role (used by pg_cron / internal) should call it
GRANT EXECUTE ON FUNCTION public.invoke_edge_function(text, jsonb) TO service_role;