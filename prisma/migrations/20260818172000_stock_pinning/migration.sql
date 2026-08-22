-- C5: pin in-stock on top and/or sold-out to bottom (composes with C4 sort).

ALTER TABLE "AppSettings" ADD COLUMN "inStockOnTop" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "soldOutToBottom" BOOLEAN NOT NULL DEFAULT false;
