-- Instant AJAX filter on option click (default) vs wait for Apply now.
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "autoApplyFilters" BOOLEAN NOT NULL DEFAULT true;
