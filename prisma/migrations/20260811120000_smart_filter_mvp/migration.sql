-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "MetafieldFilterType" AS ENUM ('LIST', 'RANGE', 'BOOLEAN');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "plan" TEXT NOT NULL DEFAULT 'none',

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterConfig" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "collectionGid" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enablePrice" BOOLEAN NOT NULL DEFAULT true,
    "enableAvailability" BOOLEAN NOT NULL DEFAULT true,
    "enableVendor" BOOLEAN NOT NULL DEFAULT true,
    "enableProductType" BOOLEAN NOT NULL DEFAULT true,
    "enableTags" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" TEXT[] DEFAULT ARRAY['availability', 'price', 'vendor', 'productType', 'tags']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilterConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetafieldMapping" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "filterType" "MetafieldFilterType" NOT NULL DEFAULT 'LIST',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetafieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastIncrementalSyncAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorLog" TEXT,
    "bulkOperationId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shopifySubscriptionId" TEXT,
    "productLimit" INTEGER NOT NULL DEFAULT 5000,
    "filterLimit" INTEGER NOT NULL DEFAULT 25,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFacet" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vendor" TEXT NOT NULL DEFAULT '',
    "productType" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[],
    "options" JSONB NOT NULL DEFAULT '{}',
    "priceMin" DECIMAL(12,2) NOT NULL,
    "priceMax" DECIMAL(12,2) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "metafields" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFacet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionMembership" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "collectionGid" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,

    CONSTRAINT "CollectionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE INDEX "FilterConfig_shopId_idx" ON "FilterConfig"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "FilterConfig_shopId_collectionGid_key" ON "FilterConfig"("shopId", "collectionGid");

-- CreateIndex
CREATE INDEX "MetafieldMapping_shopId_idx" ON "MetafieldMapping"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "MetafieldMapping_shopId_namespace_key_key" ON "MetafieldMapping"("shopId", "namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SyncJob_shopId_key" ON "SyncJob"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shopId_key" ON "Subscription"("shopId");

-- CreateIndex
CREATE INDEX "ProductFacet_shopId_vendor_idx" ON "ProductFacet"("shopId", "vendor");

-- CreateIndex
CREATE INDEX "ProductFacet_shopId_productType_idx" ON "ProductFacet"("shopId", "productType");

-- CreateIndex
CREATE INDEX "ProductFacet_shopId_available_idx" ON "ProductFacet"("shopId", "available");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFacet_shopId_productGid_key" ON "ProductFacet"("shopId", "productGid");

-- CreateIndex
CREATE INDEX "CollectionMembership_shopId_collectionGid_idx" ON "CollectionMembership"("shopId", "collectionGid");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionMembership_shopId_collectionGid_productGid_key" ON "CollectionMembership"("shopId", "collectionGid", "productGid");

-- AddForeignKey
ALTER TABLE "FilterConfig" ADD CONSTRAINT "FilterConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetafieldMapping" ADD CONSTRAINT "MetafieldMapping_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFacet" ADD CONSTRAINT "ProductFacet_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionMembership" ADD CONSTRAINT "CollectionMembership_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
