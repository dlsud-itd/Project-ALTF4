CREATE TABLE "revoked_token" (
    "token_id" VARCHAR(36) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_token_pkey" PRIMARY KEY ("token_id")
);

CREATE INDEX "revoked_token_expires_at_idx" ON "revoked_token"("expires_at");
