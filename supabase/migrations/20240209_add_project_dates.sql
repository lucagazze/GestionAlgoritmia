
-- 1. Ensure Project/Client table has start and end dates
-- We need to check if these columns exist on "Client" (which seems to be the base for Project in this app's logic, or "Project" if separated)
-- Based on types.ts, Project extends Client. Let's check the database schema for "Client" or "Project".
-- Usually "Project" is just "Client" with status='ACTIVE'.
-- But wait, types.ts says `contractEndDate`.
DO $$
BEGIN
    -- Check for 'contractEndDate' in 'Client' table (assuming Project data is in Client table based on previous steps)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'contractEndDate'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "contractEndDate" timestamp with time zone;
    END IF;

    -- Check for 'startDate' in 'Client' table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Client' AND column_name = 'startDate'
    ) THEN
        ALTER TABLE "Client" ADD COLUMN "startDate" timestamp with time zone DEFAULT now();
    END IF;
END $$;
