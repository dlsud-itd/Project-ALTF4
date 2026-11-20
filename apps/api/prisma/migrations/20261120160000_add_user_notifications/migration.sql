ALTER TYPE "NotificationType" RENAME TO "NotificationType_legacy";

CREATE TYPE "NotificationType" AS ENUM (
    'BOOKING_CONFIRMATION',
    'BOOKING_CANCELLATION',
    'BOOKING_RESCHEDULE',
    'QUEUE_STATUS_UPDATE',
    'APPROACHING_TURN',
    'QUEUE_CALL',
    'APPOINTMENT_REMINDER',
    'GENERAL'
);

ALTER TABLE "notification"
ALTER COLUMN "type" TYPE "NotificationType"
USING "type"::TEXT::"NotificationType";

ALTER TABLE "notification"
RENAME COLUMN "recipient_id" TO "user_id";

ALTER TABLE "notification"
RENAME CONSTRAINT "notification_recipient_id_fkey"
TO "notification_user_id_fkey";

ALTER TABLE "notification"
ADD COLUMN "title" VARCHAR(150);

ALTER TABLE "notification"
ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false;

UPDATE "notification"
SET
    "title" = CASE "type"::TEXT
        WHEN 'QUEUE_CALL' THEN 'Queue call'
        WHEN 'APPOINTMENT_REMINDER' THEN 'Appointment reminder'
        ELSE 'Clinic update'
    END,
    "is_read" = "read_at" IS NOT NULL;

ALTER TABLE "notification"
ALTER COLUMN "title" SET NOT NULL;

CREATE INDEX "notification_user_id_is_read_created_at_idx"
ON "notification"("user_id", "is_read", "created_at");

DROP TYPE "NotificationType_legacy";
