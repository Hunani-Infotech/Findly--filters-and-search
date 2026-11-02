-- Shop-wide filter choice order: default (current order) or alpha (A–Z by display name).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "filterOptionOrder" TEXT NOT NULL DEFAULT 'default';
