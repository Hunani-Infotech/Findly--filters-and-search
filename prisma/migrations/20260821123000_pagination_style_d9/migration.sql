-- D9: collection/search paging style (numbered, load more, infinite).

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "paginationStyle" TEXT NOT NULL DEFAULT 'pagination';
