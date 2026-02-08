-- Add content_type column to contentidea table
ALTER TABLE contentidea 
ADD COLUMN content_type TEXT DEFAULT 'POST';

-- Update existing records to have a default value
UPDATE contentidea SET content_type = 'POST' WHERE content_type IS NULL;
