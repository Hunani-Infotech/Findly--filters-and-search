-- Move theme-embed-only integration settings into AppSettings so the app embed
-- can stay toggle-only without dropping live-store functionality.

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "productGridSelector" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "useQuickviewTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "customJavascript" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "treeTemplate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "sortTemplate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "searchTemplate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "templateVariables" TEXT NOT NULL DEFAULT '';
