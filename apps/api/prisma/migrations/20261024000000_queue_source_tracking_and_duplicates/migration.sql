-- CreateEnum
CREATE TYPE "QueueSource" AS ENUM ('ONLINE', 'WALK_IN', 'STAFF_GENERATED');

-- Add column and backfill legacy queue entries
ALTER TABLE "queue_entry"
    ADD COLUMN "source" "QueueSource";

UPDATE "queue_entry"
SET "source" = 'WALK_IN'
WHERE "source" IS NULL;

ALTER TABLE "queue_entry"
    ALTER COLUMN "source" SET DEFAULT 'WALK_IN',
    ALTER COLUMN "source" SET NOT NULL;

-- Create queue status history table
CREATE TABLE "queue_status_history" (
    "id" SERIAL NOT NULL,
    "queue_entry_id" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_status_history_pkey" PRIMARY KEY ("id")
);

-- Indexes for queue ordering and status-history lookup
CREATE INDEX "queue_entry_daily_queue_status_priority_queue_number_idx"
ON "queue_entry"("daily_queue_id", "status", "priority", "queue_number");

CREATE INDEX "queue_entry_daily_queue_status_joined_at_idx"
ON "queue_entry"("daily_queue_id", "status", "joined_at");

CREATE INDEX "queue_entry_daily_queue_patient_status_idx"
ON "queue_entry"("daily_queue_id", "patient_id", "status");

CREATE INDEX "queue_status_history_queue_entry_id_created_at_idx"
ON "queue_status_history"("queue_entry_id", "created_at");

-- Prevent duplicate active entries for the same patient across all queue sources.
CREATE UNIQUE INDEX "queue_entry_active_patient_guard"
ON "queue_entry"("daily_queue_id", "patient_id")
WHERE "patient_id" IS NOT NULL AND "status" IN ('WAITING', 'CALLED', 'IN_SERVICE');

-- Backfill one history row per existing queue entry so status changes are traceable.
INSERT INTO "queue_status_history" ("queue_entry_id", "status", "created_at")
SELECT id, status, COALESCE("updated_at", "joined_at", CURRENT_TIMESTAMP)
FROM "queue_entry";

-- Foreign keys
ALTER TABLE "queue_status_history"
    ADD CONSTRAINT "queue_status_history_queue_entry_id_fkey"
    FOREIGN KEY ("queue_entry_id") REFERENCES "queue_entry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
