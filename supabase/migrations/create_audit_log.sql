-- AuditLog Table for Transactional Undo System
-- Stores complete snapshots before UPDATE/DELETE operations

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "entityType" TEXT NOT NULL,        -- 'TASK', 'PROJECT', 'CONTRACTOR', etc.
  "entityId" TEXT NOT NULL,          -- ID of the affected entity
  operation TEXT NOT NULL,            -- 'UPDATE', 'DELETE', 'BATCH_DELETE', 'BATCH_UPDATE'
  "snapshotBefore" JSONB NOT NULL,   -- Complete state before change
  "snapshotAfter" JSONB,             -- State after (for UPDATE operations)
  "userId" TEXT,                     -- Who made the change
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB                      -- Extra context (e.g., reason, batch info)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_entity ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON "AuditLog"(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON "AuditLog"(operation);

-- Enable Row Level Security (optional)
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- Example queries:
-- Get all changes for a task: SELECT * FROM "AuditLog" WHERE "entityType" = 'TASK' AND "entityId" = 'uuid';
-- Get recent changes: SELECT * FROM "AuditLog" ORDER BY timestamp DESC LIMIT 50;
-- Undo last action: SELECT * FROM "AuditLog" ORDER BY timestamp DESC LIMIT 1;
