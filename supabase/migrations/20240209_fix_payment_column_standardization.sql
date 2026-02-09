
-- 1. Check if 'projectId' exists and 'client_id' does NOT exist.
-- If so, rename 'projectId' to 'client_id'.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'projectId'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE "Payment" RENAME COLUMN "projectId" TO "client_id";
    END IF;
END $$;

-- 2. If 'projectId' exists AND 'client_id' exists (messy state), migrate data and drop 'projectId'.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'projectId'
    ) AND EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'client_id'
    ) THEN
        -- Move data
        UPDATE "Payment" 
        SET client_id = "projectId" 
        WHERE client_id IS NULL AND "projectId" IS NOT NULL;
        
        -- Drop old column
        ALTER TABLE "Payment" DROP COLUMN "projectId";
    END IF;
END $$;

-- 3. If neither exists (weird state), create 'client_id'.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'client_id'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Payment' AND column_name = 'projectId'
    ) THEN
        ALTER TABLE "Payment" ADD COLUMN "client_id" uuid REFERENCES "Client"(id);
    END IF;
END $$;

-- 4. Ensure foreign key constraint exists and is correct
-- (Optional, but good practice if we just created it or renamed it)
-- We assume "Client" table exists and has "id".
