-- CreateEnum
CREATE TYPE "QueueJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "jobKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheGeneration" (
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CacheGeneration_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueueJob_jobKey_key" ON "QueueJob"("jobKey");

-- CreateIndex
CREATE INDEX "QueueJob_status_runAt_idx" ON "QueueJob"("status", "runAt");

-- CreateIndex
CREATE INDEX "QueueJob_status_lockedAt_idx" ON "QueueJob"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "QueueJob_type_status_idx" ON "QueueJob"("type", "status");

-- Partial indexes keep claim/stale scans tiny once completed/failed rows accumulate.
CREATE INDEX "QueueJob_claim_pending_idx" ON "QueueJob" ("runAt") WHERE status = 'pending';
CREATE INDEX "QueueJob_stale_processing_idx" ON "QueueJob" ("lockedAt") WHERE status = 'processing';
