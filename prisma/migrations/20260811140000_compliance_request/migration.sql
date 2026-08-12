-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "plan" SET DEFAULT 'free';
UPDATE "Shop" SET "plan" = 'free' WHERE "plan" = 'none' OR "plan" = '';

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "collectionGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredMetafield" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sampleValue" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredMetafield_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRequest" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_shopId_idx" ON "Collection"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_shopId_collectionGid_key" ON "Collection"("shopId", "collectionGid");

-- CreateIndex
CREATE INDEX "DiscoveredMetafield_shopId_idx" ON "DiscoveredMetafield"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredMetafield_shopId_namespace_key_key" ON "DiscoveredMetafield"("shopId", "namespace", "key");

-- CreateIndex
CREATE INDEX "ComplianceRequest_shopDomain_idx" ON "ComplianceRequest"("shopDomain");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredMetafield" ADD CONSTRAINT "DiscoveredMetafield_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
