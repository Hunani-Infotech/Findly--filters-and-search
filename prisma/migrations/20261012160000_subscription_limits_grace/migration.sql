-- D-3: retain last-known paid product/filter limits for 24h after demotion sync.
ALTER TABLE "Subscription" ADD COLUMN "limitsGraceUntil" TIMESTAMP(3);
