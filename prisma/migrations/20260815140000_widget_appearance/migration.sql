-- Merchant-selectable widget chrome (shadow + corner radius).

ALTER TABLE "AppSettings" ADD COLUMN "widgetShadow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AppSettings" ADD COLUMN "widgetRadius" INTEGER NOT NULL DEFAULT 12;
