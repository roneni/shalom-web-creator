-- Add source_url column to published_posts so we can link back to the original article
ALTER TABLE public.published_posts
ADD COLUMN source_url TEXT;