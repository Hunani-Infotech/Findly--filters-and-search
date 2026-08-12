-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "widgetPosition" TEXT NOT NULL DEFAULT 'left',
    "accentColor" TEXT NOT NULL DEFAULT '#1c1917',
    "showProductCounts" BOOLEAN NOT NULL DEFAULT true,
    "collapseByDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shopId_key" ON "AppSettings"("shopId");

-- AddForeignKey
ALTER TABLE "AppSettings" ADD CONSTRAINT "AppSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
