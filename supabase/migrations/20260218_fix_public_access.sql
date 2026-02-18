-- Enable RLS on the table (if not already enabled)
ALTER TABLE contentidea ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access via ID
CREATE POLICY "Allow public read access"
ON contentidea
FOR SELECT
USING (true); -- Or stricter: USING (status = 'POSTED') if desired, but user wants to share drafts too likely.

-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'contentidea';
