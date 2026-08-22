-- C9: merchant-pinned search suggestions (empty focus + zero results).

ALTER TABLE "AppSettings" ADD COLUMN "showSuggestionsOnEmptyQuery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "showSuggestionsOnNoResults" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN "suggestionProductHandles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AppSettings" ADD COLUMN "suggestionCollectionHandles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
