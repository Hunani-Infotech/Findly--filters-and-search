ALTER TABLE "FilterConfig" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Default';
ALTER TABLE "FilterConfig" ADD COLUMN "appliesToSearch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FilterConfig" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "FilterConfig" SET "createdAt" = "updatedAt";
UPDATE "FilterConfig" SET "appliesToSearch" = true WHERE "collectionGid" = '';
UPDATE "FilterConfig" SET "name" = 'Default' WHERE "collectionGid" = '';

UPDATE "FilterConfig" AS fc
SET "name" = 'Collection ' || COALESCE(NULLIF(c."handle", ''), 'filter')
FROM "Collection" AS c
WHERE fc."shopId" = c."shopId"
  AND fc."collectionGid" = c."collectionGid"
  AND fc."collectionGid" <> '';

UPDATE "FilterConfig"
SET "name" = 'Collection filter'
WHERE "collectionGid" <> '' AND "name" = 'Default';

CREATE TABLE "FilterTreeCollection" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "collectionGid" TEXT NOT NULL,

    CONSTRAINT "FilterTreeCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FilterTreeCollection_treeId_collectionGid_key" ON "FilterTreeCollection"("treeId", "collectionGid");
CREATE INDEX "FilterTreeCollection_shopId_collectionGid_idx" ON "FilterTreeCollection"("shopId", "collectionGid");

INSERT INTO "FilterTreeCollection" ("id", "shopId", "treeId", "collectionGid")
SELECT md5(random()::text || "id" || "collectionGid"), "shopId", "id", "collectionGid"
FROM "FilterConfig"
WHERE "collectionGid" <> '';

ALTER TABLE "FilterTreeCollection" ADD CONSTRAINT "FilterTreeCollection_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FilterConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "FilterConfig_shopId_collectionGid_key";
CREATE INDEX "FilterConfig_shopId_createdAt_idx" ON "FilterConfig"("shopId", "createdAt");
CREATE INDEX "FilterConfig_shopId_appliesToSearch_idx" ON "FilterConfig"("shopId", "appliesToSearch");
