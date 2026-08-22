ALTER TABLE "FilterConfig" ADD COLUMN "enableLocation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductFacet" ADD COLUMN "inventoryLocations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
