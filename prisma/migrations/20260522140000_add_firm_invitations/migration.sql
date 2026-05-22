-- Add FirmInvitation table for token-based email invitations

CREATE TABLE "FirmInvitation" (
    "id"         TEXT NOT NULL,
    "firmId"     TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "role"       "FirmRole" NOT NULL DEFAULT 'ANALYST',
    "token"      TEXT NOT NULL,
    "invitedBy"  TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirmInvitation_token_key" ON "FirmInvitation"("token");
CREATE INDEX "FirmInvitation_firmId_idx" ON "FirmInvitation"("firmId");
CREATE INDEX "FirmInvitation_email_idx" ON "FirmInvitation"("email");
CREATE INDEX "FirmInvitation_token_idx" ON "FirmInvitation"("token");

ALTER TABLE "FirmInvitation"
    ADD CONSTRAINT "FirmInvitation_firmId_fkey"
    FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
