-- C7 follow-up: same column as 20260818180000_collection_search (idempotent if both run).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "enableCollectionSearch" BOOLEAN NOT NULL DEFAULT false;
