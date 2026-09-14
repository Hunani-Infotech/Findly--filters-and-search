-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductFacet_shopId_status_idx" ON "ProductFacet"("shopId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductFacet_shopId_handle_idx" ON "ProductFacet"("shopId", "handle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CollectionMembership_shopId_productGid_idx" ON "CollectionMembership"("shopId", "productGid");
