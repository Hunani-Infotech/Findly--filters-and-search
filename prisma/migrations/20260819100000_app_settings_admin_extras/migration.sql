-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "adminExtras" JSONB NOT NULL DEFAULT '{}';
