-- Merchant color swatches and grouped filter values (shop-scoped).

CREATE TABLE IF NOT EXISTS "ColorSwatch" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'solid',
    "color1" TEXT NOT NULL DEFAULT '',
    "color2" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorSwatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ColorSwatch_shopId_optionKey_value_key" ON "ColorSwatch"("shopId", "optionKey", "value");
CREATE INDEX IF NOT EXISTS "ColorSwatch_shopId_optionKey_idx" ON "ColorSwatch"("shopId", "optionKey");

ALTER TABLE "ColorSwatch" DROP CONSTRAINT IF EXISTS "ColorSwatch_shopId_fkey";
ALTER TABLE "ColorSwatch" ADD CONSTRAINT "ColorSwatch_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ValueGroup" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "values" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ValueGroup_shopId_sourceKey_idx" ON "ValueGroup"("shopId", "sourceKey");

ALTER TABLE "ValueGroup" DROP CONSTRAINT IF EXISTS "ValueGroup_shopId_fkey";
ALTER TABLE "ValueGroup" ADD CONSTRAINT "ValueGroup_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
