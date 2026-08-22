-- Merchant-selectable widget font to match the storefront theme.

ALTER TABLE "AppSettings" ADD COLUMN "widgetFontMode" TEXT NOT NULL DEFAULT 'theme';
ALTER TABLE "AppSettings" ADD COLUMN "widgetFontFamily" TEXT NOT NULL DEFAULT '';
