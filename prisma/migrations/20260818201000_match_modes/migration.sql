-- C11: per-facet AND vs OR (tags, options, metafields). Default OR.

ALTER TABLE "FilterConfig" ADD COLUMN "matchModes" JSONB NOT NULL DEFAULT '{}';
