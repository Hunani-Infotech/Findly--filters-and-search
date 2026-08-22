ALTER TABLE "FilterConfig" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "FilterConfig_shopId_sortOrder_idx" ON "FilterConfig"("shopId", "sortOrder");
