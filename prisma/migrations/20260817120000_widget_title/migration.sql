-- Merchant-customizable storefront filter title.

ALTER TABLE "AppSettings" ADD COLUMN "widgetTitle" TEXT NOT NULL DEFAULT 'Filter:';
ALTER TABLE "AppSettings" ADD COLUMN "widgetTitleSize" INTEGER NOT NULL DEFAULT 16;
ALTER TABLE "AppSettings" ADD COLUMN "widgetTitleColor" TEXT NOT NULL DEFAULT '#1c1917';
