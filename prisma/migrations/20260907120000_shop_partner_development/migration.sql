-- AlterTable
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "partnerDevelopment" BOOLEAN NOT NULL DEFAULT false;
