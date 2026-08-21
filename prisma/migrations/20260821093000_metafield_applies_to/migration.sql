-- AlterTable
ALTER TABLE "MetafieldMapping" ADD COLUMN "appliesTo" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Existing enabled mappings keep filter + search + display (previous behavior).
UPDATE "MetafieldMapping"
SET "appliesTo" = ARRAY['display', 'search', 'filter']::TEXT[]
WHERE "enabled" = true AND cardinality("appliesTo") = 0;
