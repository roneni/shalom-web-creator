
-- Step 1: Clean existing URL-level duplicates (keep newest)
DELETE FROM content_suggestions 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY fetched_at DESC) as rn
    FROM content_suggestions 
    WHERE source_url IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- Step 2: Add unique partial index on source_url to prevent future URL dupes at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_source_url 
ON content_suggestions (source_url) 
WHERE source_url IS NOT NULL;

-- Step 3: Add index on suggested_title for faster semantic dedup lookups
CREATE INDEX IF NOT EXISTS idx_suggested_title 
ON content_suggestions (suggested_title) 
WHERE suggested_title IS NOT NULL AND status IN ('pending', 'approved');
