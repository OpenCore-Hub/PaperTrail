-- Add session_version to users so password resets can invalidate existing sessions.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
