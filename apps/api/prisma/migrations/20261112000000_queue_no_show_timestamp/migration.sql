ALTER TABLE "queue_entry"
    ADD COLUMN "no_show_at" TIMESTAMP(3);

UPDATE "queue_entry"
SET "no_show_at" = "updated_at"
WHERE "status" = 'NO_SHOW'
  AND "no_show_at" IS NULL;
