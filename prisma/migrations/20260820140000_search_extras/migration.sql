-- Instant search widget + Search Settings extras (fuzzy, popular terms, merchandising)
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "searchExtras" JSONB NOT NULL DEFAULT '{}';
