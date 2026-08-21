-- Drop raw GDPR webhook JSON (may contain customer email/phone/id).
-- Keep a non-PII audit row: shop domain, request id, topic, status, timestamp.

ALTER TABLE "ComplianceRequest" ADD COLUMN "requestId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ComplianceRequest" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'acknowledged';

UPDATE "ComplianceRequest" SET "requestId" = "id" WHERE "requestId" = '';

ALTER TABLE "ComplianceRequest" DROP COLUMN "payload";

CREATE UNIQUE INDEX "ComplianceRequest_requestId_key" ON "ComplianceRequest"("requestId");
