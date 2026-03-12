
CREATE OR REPLACE FUNCTION public.invoke_edge_function(function_name text, payload jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  result bigint;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  SELECT net.http_post(
    url := 'https://lnnsfnztckgouupfestv.supabase.co/functions/v1/' || function_name,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb,
    body := payload
  ) INTO result;

  RETURN result;
END;
$$;
