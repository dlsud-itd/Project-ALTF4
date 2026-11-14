UPDATE "queue_entry"
SET "status" = CASE "status"::TEXT
    WHEN 'IN_SERVICE' THEN 'IN_CONSULTATION'
    WHEN 'SERVED' THEN 'COMPLETED'
    WHEN 'DONE' THEN 'COMPLETED'
    ELSE "status"::TEXT
END::"QueueStatus";

UPDATE "queue_status_history"
SET "status" = CASE "status"::TEXT
    WHEN 'IN_SERVICE' THEN 'IN_CONSULTATION'
    WHEN 'SERVED' THEN 'COMPLETED'
    WHEN 'DONE' THEN 'COMPLETED'
    ELSE "status"::TEXT
END::"QueueStatus";

UPDATE "queue_entry"
SET "consultation_started_at" = "called_at"
WHERE "status" IN ('IN_CONSULTATION', 'COMPLETED')
  AND "consultation_started_at" IS NULL;

UPDATE "queue_entry"
SET "completed_at" = "updated_at"
WHERE "status" = 'COMPLETED'
  AND "completed_at" IS NULL;

UPDATE "queue_entry"
SET "cancelled_at" = "updated_at"
WHERE "status" = 'CANCELLED'
  AND "cancelled_at" IS NULL;
