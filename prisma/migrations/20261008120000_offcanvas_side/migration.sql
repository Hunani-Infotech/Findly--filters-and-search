-- Off-canvas drawer side (left default | right).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "offcanvasSide" TEXT NOT NULL DEFAULT 'left';
