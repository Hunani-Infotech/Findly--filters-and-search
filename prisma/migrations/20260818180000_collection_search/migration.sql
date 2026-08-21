-- Optional in-collection search bar (keyword stays inside the collection).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "enableCollectionSearch" BOOLEAN NOT NULL DEFAULT false;
