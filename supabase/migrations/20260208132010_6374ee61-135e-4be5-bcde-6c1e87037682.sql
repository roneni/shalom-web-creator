-- Add signal_score column to content_suggestions for AI Curator scoring
ALTER TABLE public.content_suggestions 
ADD COLUMN signal_score integer DEFAULT NULL;

-- Add index for efficient filtering by score
CREATE INDEX idx_content_suggestions_signal_score 
ON public.content_suggestions (signal_score) 
WHERE signal_score IS NOT NULL;