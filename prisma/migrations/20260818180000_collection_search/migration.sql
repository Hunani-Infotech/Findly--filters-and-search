-- C7: optional in-collection search bar (Globo: Enable search on collection pages).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "enableCollectionSearch" BOOLEAN NOT NULL DEFAULT false;
