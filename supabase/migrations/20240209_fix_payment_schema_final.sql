
-- 1. Standardize 'client_id' (handle 'projectId' -> 'client_id')
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'projectId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE "Payment" RENAME COLUMN "projectId" TO "client_id";
    END IF;
END $$;

-- 2. Standardize 'created_at' (handle 'createdAt' -> 'created_at')
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'createdAt'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE "Payment" RENAME COLUMN "createdAt" TO "created_at";
    END IF;
END $$;

-- 3. Ensure 'metadata' exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE "Payment" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. Ensure 'client_id' exists if it was missing entirely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE "Payment" ADD COLUMN "client_id" uuid REFERENCES "Client"(id);
    END IF;
END $$;

-- 5. Ensure 'created_at' exists if it was missing entirely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'Payment' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE "Payment" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
    END IF;
END $$;

-- 6. Backfill 'created_at' if NULL (ensure no nulls for NOT NULL constraint)
UPDATE "Payment" SET "created_at" = now() WHERE "created_at" IS NULL;

-- 7. Grant Permissions (just in case)
GRANT ALL ON TABLE "Payment" TO anon;
GRANT ALL ON TABLE "Payment" TO authenticated;
GRANT ALL ON TABLE "Payment" TO service_role;
