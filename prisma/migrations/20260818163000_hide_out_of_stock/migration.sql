-- Merchant hide-out-of-stock mode: show | hide | hide_after_filter

ALTER TABLE "AppSettings" ADD COLUMN "hideOutOfStock" TEXT NOT NULL DEFAULT 'show';
