-- Add missing columns to contentidea table with correct casing

ALTER TABLE contentidea 
ADD COLUMN IF NOT EXISTS "contentType" text DEFAULT 'POST';

ALTER TABLE contentidea 
ADD COLUMN IF NOT EXISTS "scheduledDate" timestamp with time zone;

-- Optional: Update existing rows
UPDATE contentidea SET "contentType" = 'POST' WHERE "contentType" IS NULL;

-- Verify the columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contentidea';
