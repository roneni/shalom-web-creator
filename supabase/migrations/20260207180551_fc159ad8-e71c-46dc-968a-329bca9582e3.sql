-- Create role enum for admin access control
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (roles stored separately per security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role security definer function (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Users can view their own roles (needed for frontend role check)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Rate limiting table for expensive admin operations
CREATE TABLE public.admin_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = no client access (accessed only via service role in edge functions)

-- Index for efficient rate limit queries
CREATE INDEX idx_rate_limits_lookup 
  ON public.admin_rate_limits (function_name, user_id, called_at DESC);