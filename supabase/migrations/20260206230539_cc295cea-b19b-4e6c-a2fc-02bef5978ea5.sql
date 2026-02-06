
-- Drop old check constraint and add updated one with new type
ALTER TABLE public.sources DROP CONSTRAINT sources_type_check;
ALTER TABLE public.sources ADD CONSTRAINT sources_type_check CHECK (type = ANY (ARRAY['twitter'::text, 'website'::text, 'google_alerts_rss'::text]));
