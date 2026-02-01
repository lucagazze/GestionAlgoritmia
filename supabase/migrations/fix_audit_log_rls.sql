-- Run this in your Supabase SQL Editor to fix the AuditLog RLS policy

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on AuditLog" ON "AuditLog";

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on AuditLog" ON "AuditLog"
  FOR ALL
  USING (true)
  WITH CHECK (true);
