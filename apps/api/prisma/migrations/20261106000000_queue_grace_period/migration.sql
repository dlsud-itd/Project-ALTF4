ALTER TYPE "QueueStatus" ADD VALUE IF NOT EXISTS 'DONE';

ALTER TABLE "queue_entry"
    ADD COLUMN "grace_expires_at" TIMESTAMP(3);

UPDATE "queue_entry"
SET "called_at" = COALESCE("called_at", "updated_at", "joined_at")
WHERE "status" = 'CALLED'
  AND "called_at" IS NULL;

UPDATE "queue_entry"
SET "grace_expires_at" = "called_at" + INTERVAL '180 seconds'
WHERE "status" = 'CALLED'
  AND "grace_expires_at" IS NULL;

DROP INDEX IF EXISTS "queue_entry_daily_queue_status_priority_queue_number_idx";

CREATE UNIQUE INDEX "queue_entry_daily_queue_id_queue_number_key"
ON "queue_entry"("daily_queue_id", "queue_number");

CREATE UNIQUE INDEX "queue_entry_tracking_token_key"
ON "queue_entry"("tracking_token");

CREATE INDEX "queue_entry_daily_queue_status_queue_number_idx"
ON "queue_entry"("daily_queue_id", "status", "queue_number");
