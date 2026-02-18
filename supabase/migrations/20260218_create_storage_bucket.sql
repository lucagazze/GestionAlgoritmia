-- Create a new storage bucket for content assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('content-assets', 'content-assets', true);

-- Policy: Allow public read access to everyone
CREATE POLICY "Public Access" 
ON storage.objects 
FOR SELECT 
USING ( bucket_id = 'content-assets' );

-- Policy: Allow authenticated users to upload/insert
CREATE POLICY "Authenticated Upload" 
ON storage.objects 
FOR INSERT 
WITH CHECK ( bucket_id = 'content-assets' AND auth.role() = 'authenticated' );

-- Policy: Allow users to update their own files (optional, but good for replacement)
CREATE POLICY "Authenticated Update" 
ON storage.objects 
FOR UPDATE
USING ( bucket_id = 'content-assets' AND auth.role() = 'authenticated' );
