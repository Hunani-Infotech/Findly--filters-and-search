-- C6: store per-variant images for matching collection-card photos after option filters.
ALTER TABLE "ProductFacet" ADD COLUMN "variantImages" JSONB NOT NULL DEFAULT '[]';
