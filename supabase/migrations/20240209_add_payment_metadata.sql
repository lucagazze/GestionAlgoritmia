-- Add metadata column to Payment table to store service snapshots
ALTER TABLE public."Payment" ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
