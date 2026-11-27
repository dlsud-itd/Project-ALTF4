ALTER TABLE "app_user"
ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "password_reset_otp" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "otp_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "reset_token_hash" VARCHAR(128),
    "reset_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_reset_otp_user_id_created_at_idx"
ON "password_reset_otp"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "password_reset_otp_expires_at_idx"
ON "password_reset_otp"("expires_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_otp_user_id_fkey'
    ) THEN
        ALTER TABLE "password_reset_otp"
        ADD CONSTRAINT "password_reset_otp_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
