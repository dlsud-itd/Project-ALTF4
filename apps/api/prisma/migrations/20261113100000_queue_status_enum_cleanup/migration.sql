DROP INDEX IF EXISTS "queue_entry_active_patient_guard";
ALTER TABLE "queue_entry" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "queue_entry"
    ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "queue_status_history"
    ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

ALTER TYPE "QueueStatus" RENAME TO "QueueStatus_legacy";
CREATE TYPE "QueueStatus" AS ENUM (
    'WAITING',
    'CALLED',
    'IN_CONSULTATION',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED'
);

UPDATE "queue_entry"
SET "status" = CASE "status"
    WHEN 'IN_SERVICE' THEN 'IN_CONSULTATION'
    WHEN 'DONE' THEN 'COMPLETED'
    WHEN 'SERVED' THEN 'COMPLETED'
    ELSE "status"
END;

UPDATE "queue_status_history"
SET "status" = CASE "status"
    WHEN 'IN_SERVICE' THEN 'IN_CONSULTATION'
    WHEN 'DONE' THEN 'COMPLETED'
    WHEN 'SERVED' THEN 'COMPLETED'
    ELSE "status"
END;

ALTER TABLE "queue_entry"
    ALTER COLUMN "status" TYPE "QueueStatus" USING "status"::"QueueStatus",
    ALTER COLUMN "status" SET DEFAULT 'WAITING';
ALTER TABLE "queue_status_history"
    ALTER COLUMN "status" TYPE "QueueStatus" USING "status"::"QueueStatus";
DROP TYPE "QueueStatus_legacy";

CREATE UNIQUE INDEX "queue_entry_active_patient_guard"
ON "queue_entry"("daily_queue_id", "patient_id")
WHERE "patient_id" IS NOT NULL
  AND "status" IN ('WAITING', 'CALLED', 'IN_CONSULTATION');

CREATE INDEX "queue_entry_daily_queue_status_created_queue_id_idx"
ON "queue_entry"("daily_queue_id", "status", "joined_at", "queue_number", "id");
