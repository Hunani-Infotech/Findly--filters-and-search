-- CreateTable
CREATE TABLE "ShopPage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "pageGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopArticle" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "articleGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL DEFAULT '',
    "blogHandle" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopPage_shopId_pageGid_key" ON "ShopPage"("shopId", "pageGid");

-- CreateIndex
CREATE INDEX "ShopPage_shopId_idx" ON "ShopPage"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopArticle_shopId_articleGid_key" ON "ShopArticle"("shopId", "articleGid");

-- CreateIndex
CREATE INDEX "ShopArticle_shopId_idx" ON "ShopArticle"("shopId");

-- AddForeignKey
ALTER TABLE "ShopPage" ADD CONSTRAINT "ShopPage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopArticle" ADD CONSTRAINT "ShopArticle_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
