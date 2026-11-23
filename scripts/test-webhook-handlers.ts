/**
 * Webhook failure-rate fix verification (no DB / Shopify network).
 * Run: npx tsx --test scripts/test-webhook-handlers.ts
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it, mock } from "node:test";
import {
  authenticateWebhookHmacOnly,
  isLikelyTokenRefreshFailure,
  readWebhookHeaders,
  verifyShopifyWebhookHmac,
} from "../app/utils/webhook-hmac.server";
import { processAppUninstalled } from "../app/utils/webhook-app-uninstalled.server";
import { processCatalogWebhook } from "../app/utils/webhook-catalog.server";
import { processShopRedact } from "../app/utils/webhook-shop-redact.server";

const SECRET = "test-webhook-secret";

function sign(body: string | Buffer, secret = SECRET) {
  return createHmac("sha256", secret).update(body).digest("base64");
}

function signedWebhookRequest(opts: {
  body?: string;
  shop?: string;
  topic?: string;
  webhookId?: string;
  hmac?: string;
  secret?: string;
}) {
  const raw = opts.body ?? "{}";
  const secret = opts.secret ?? SECRET;
  const hmac = opts.hmac ?? sign(raw, secret);
  return new Request("https://example.test/webhooks/app/uninstalled", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-shop-domain": opts.shop ?? "demo.myshopify.com",
      "x-shopify-topic": opts.topic ?? "app/uninstalled",
      "x-shopify-webhook-id": opts.webhookId ?? "wh-1",
      "x-shopify-api-version": "2026-07",
      "x-shopify-hmac-sha256": hmac,
    },
    body: raw,
  });
}

describe("verifyShopifyWebhookHmac", () => {
  it("accepts a valid HMAC", () => {
    const body = Buffer.from('{"id":1}');
    assert.equal(verifyShopifyWebhookHmac(body, sign(body), SECRET), true);
  });

  it("rejects an invalid HMAC (401 contract)", () => {
    const body = Buffer.from('{"id":1}');
    assert.equal(verifyShopifyWebhookHmac(body, "not-the-hmac", SECRET), false);
  });

  it("rejects missing header or secret", () => {
    assert.equal(verifyShopifyWebhookHmac(Buffer.from("{}"), null, SECRET), false);
    assert.equal(verifyShopifyWebhookHmac(Buffer.from("{}"), "x", ""), false);
  });
});

describe("readWebhookHeaders", () => {
  it("normalizes shop domain", () => {
    const headers = new Headers({
      "x-shopify-shop-domain": "Demo.MyShopify.com",
      "x-shopify-topic": "shop/redact",
      "x-shopify-webhook-id": "abc",
    });
    const parsed = readWebhookHeaders(headers);
    assert.equal(parsed.shop, "demo.myshopify.com");
    assert.equal(parsed.topic, "shop/redact");
    assert.equal(parsed.webhookId, "abc");
  });
});

describe("isLikelyTokenRefreshFailure", () => {
  it("matches Response(500) from library refresh wrap", () => {
    assert.equal(
      isLikelyTokenRefreshFailure(
        new Response(undefined, { status: 500, statusText: "Internal Server Error" }),
      ),
      true,
    );
  });

  it("does not match unrelated Response statuses", () => {
    assert.equal(
      isLikelyTokenRefreshFailure(new Response(undefined, { status: 502 })),
      false,
    );
    assert.equal(
      isLikelyTokenRefreshFailure(new Response(undefined, { status: 401 })),
      false,
    );
  });

  it("matches InvalidJwtError and invalid_subject_token HttpResponseError", () => {
    assert.equal(
      isLikelyTokenRefreshFailure(
        Object.assign(new Error("jwt"), { name: "InvalidJwtError" }),
      ),
      true,
    );
    assert.equal(
      isLikelyTokenRefreshFailure(
        Object.assign(new Error("oauth"), {
          name: "HttpResponseError",
          response: { code: 400, body: { error: "invalid_subject_token" } },
        }),
      ),
      true,
    );
  });

  it("does not match arbitrary errors (DB / expired infra messages)", () => {
    assert.equal(
      isLikelyTokenRefreshFailure(new Error("certificate expired")),
      false,
    );
    assert.equal(
      isLikelyTokenRefreshFailure(new Error("Prisma connection failed")),
      false,
    );
    assert.equal(
      isLikelyTokenRefreshFailure(
        Object.assign(new Error("rate limited"), {
          name: "HttpResponseError",
          response: { code: 429, body: { error: "throttled" } },
        }),
      ),
      false,
    );
  });
});

describe("authenticateWebhookHmacOnly", () => {
  it("returns context without session for a valid signed uninstall", async () => {
    const ctx = await authenticateWebhookHmacOnly(
      signedWebhookRequest({ topic: "app/uninstalled" }),
      SECRET,
    );
    assert.equal(ctx.shop, "demo.myshopify.com");
    assert.equal(ctx.topic, "app/uninstalled");
    assert.equal(ctx.session, undefined);
    assert.equal(ctx.admin, undefined);
    assert.equal(ctx.usedHmacFallback, true);
  });

  it("throws 401 for an invalid HMAC", async () => {
    await assert.rejects(
      () =>
        authenticateWebhookHmacOnly(
          signedWebhookRequest({ hmac: "definitely-bad" }),
          SECRET,
        ),
      (error: unknown) => error instanceof Response && error.status === 401,
    );
  });

  it("throws 401 for a malformed HMAC header", async () => {
    await assert.rejects(
      () =>
        authenticateWebhookHmacOnly(
          signedWebhookRequest({ hmac: "!!!not-base64@@@" }),
          SECRET,
        ),
      (error: unknown) => error instanceof Response && error.status === 401,
    );
  });

  it("accepts an empty JSON body when HMAC is valid", async () => {
    const ctx = await authenticateWebhookHmacOnly(
      signedWebhookRequest({ body: "" }),
      SECRET,
    );
    assert.equal(ctx.shop, "demo.myshopify.com");
    assert.deepEqual(ctx.payload, {});
  });
});

describe("processAppUninstalled", () => {
  it("soft-uninstalls when admin/token is absent (revoked token) → 200", async () => {
    const softUninstall = mock.fn(async () => {});
    const cleanupBestEffort = mock.fn(async () => {});
    const releaseDelivery = mock.fn(async () => {});

    const res = await processAppUninstalled(
      {
        shop: "demo.myshopify.com",
        topic: "app/uninstalled",
        webhookId: "wh-revoked",
        admin: undefined,
      },
      {
        claimDelivery: async () => "claimed",
        releaseDelivery,
        softUninstall,
        cleanupBestEffort,
      },
    );

    assert.equal(res.status, 200);
    assert.equal(softUninstall.mock.callCount(), 1);
    assert.equal(cleanupBestEffort.mock.callCount(), 1);
    assert.equal(releaseDelivery.mock.callCount(), 0);
  });

  it("returns 200 when cleanup throws (best-effort)", async () => {
    const softUninstall = mock.fn(async () => {});
    const cleanupBestEffort = mock.fn(async () => {
      throw new Error("admin revoked");
    });

    const res = await processAppUninstalled(
      {
        shop: "demo.myshopify.com",
        topic: "app/uninstalled",
        webhookId: "wh-cleanup-throw",
        admin: { graphql: async () => new Response("{}") },
      },
      {
        claimDelivery: async () => "claimed",
        releaseDelivery: async () => {},
        softUninstall,
        cleanupBestEffort,
      },
    );

    assert.equal(res.status, 200);
    assert.equal(softUninstall.mock.callCount(), 1);
  });

  it("acknowledges duplicate webhook id with 200", async () => {
    const softUninstall = mock.fn(async () => {});
    const res = await processAppUninstalled(
      {
        shop: "demo.myshopify.com",
        topic: "app/uninstalled",
        webhookId: "wh-dup",
        admin: undefined,
      },
      {
        claimDelivery: async () => "duplicate",
        releaseDelivery: async () => {},
        softUninstall,
        cleanupBestEffort: async () => {},
      },
    );
    assert.equal(res.status, 200);
    assert.equal(softUninstall.mock.callCount(), 0);
  });

  it("releases claim and rethrows when soft uninstall fails", async () => {
    const releaseDelivery = mock.fn(async () => {});
    await assert.rejects(
      () =>
        processAppUninstalled(
          {
            shop: "demo.myshopify.com",
            topic: "app/uninstalled",
            webhookId: "wh-fail",
            admin: undefined,
          },
          {
            claimDelivery: async () => "claimed",
            releaseDelivery,
            softUninstall: async () => {
              throw new Error("db down");
            },
            cleanupBestEffort: async () => {},
          },
        ),
      /db down/,
    );
    assert.equal(releaseDelivery.mock.callCount(), 1);
  });

  it("returns 200 when cleanup hangs past the timeout", async () => {
    const softUninstall = mock.fn(async () => {});
    const cleanupBestEffort = mock.fn(
      () =>
        new Promise<void>(() => {
          /* never resolves */
        }),
    );

    const res = await processAppUninstalled(
      {
        shop: "demo.myshopify.com",
        topic: "app/uninstalled",
        webhookId: "wh-cleanup-hang",
        admin: { graphql: async () => new Response("{}") },
      },
      {
        claimDelivery: async () => "claimed",
        releaseDelivery: async () => {},
        softUninstall,
        cleanupBestEffort,
        cleanupTimeoutMs: 40,
      },
    );

    assert.equal(res.status, 200);
    assert.equal(softUninstall.mock.callCount(), 1);
    assert.equal(cleanupBestEffort.mock.callCount(), 1);
  });
});

describe("processShopRedact", () => {
  it("purges an existing shop and returns 200", async () => {
    let auditStatus = "";
    const purgeShopData = mock.fn(async () => {});

    const res = await processShopRedact(
      {
        shop: "demo.myshopify.com",
        topic: "shop/redact",
        webhookId: "wh-redact-1",
      },
      {
        claimDelivery: async () => "claimed",
        releaseDelivery: async () => {},
        shopExists: async () => true,
        shopLooksReinstalled: async () => false,
        purgeShopData,
        audit: async ({ status }) => {
          auditStatus = status;
        },
      },
    );

    assert.equal(res.status, 200);
    assert.equal(purgeShopData.mock.callCount(), 1);
    assert.equal(auditStatus, "queued");
  });

  it("returns 200 for an already-purged shop (idempotent)", async () => {
    let auditStatus = "";
    const purgeShopData = mock.fn(async () => {});

    const res = await processShopRedact(
      {
        shop: "gone.myshopify.com",
        topic: "shop/redact",
        webhookId: "wh-redact-gone",
      },
      {
        claimDelivery: async () => "claimed",
        releaseDelivery: async () => {},
        shopExists: async () => false,
        shopLooksReinstalled: async () => false,
        purgeShopData,
        audit: async ({ status }) => {
          auditStatus = status;
        },
      },
    );

    assert.equal(res.status, 200);
    assert.equal(purgeShopData.mock.callCount(), 0);
    assert.equal(auditStatus, "already_purged");
  });

  it("returns 200 on duplicate when already purged", async () => {
    const purgeShopData = mock.fn(async () => {});
    const res = await processShopRedact(
      {
        shop: "gone.myshopify.com",
        topic: "shop/redact",
        webhookId: "wh-redact-dup",
      },
      {
        claimDelivery: async () => "duplicate",
        releaseDelivery: async () => {},
        shopExists: async () => false,
        shopLooksReinstalled: async () => false,
        purgeShopData,
        audit: async () => {},
      },
    );
    assert.equal(res.status, 200);
    assert.equal(purgeShopData.mock.callCount(), 0);
  });

  it("returns 200 and does not purge a reinstalled shop", async () => {
    let auditStatus = "";
    const purgeShopData = mock.fn(async () => {});
    const res = await processShopRedact(
      {
        shop: "reinstalled.myshopify.com",
        topic: "shop/redact",
        webhookId: "wh-redact-reinstall",
      },
      {
        claimDelivery: async () => "claimed",
        releaseDelivery: async () => {},
        shopExists: async () => true,
        shopLooksReinstalled: async () => true,
        purgeShopData,
        audit: async ({ status }) => {
          auditStatus = status;
        },
      },
    );
    assert.equal(res.status, 200);
    assert.equal(purgeShopData.mock.callCount(), 0);
    assert.equal(auditStatus, "skipped_reinstalled");
  });

  it("throws (5xx) when purge fails so Shopify can retry", async () => {
    const releaseDelivery = mock.fn(async () => {});
    await assert.rejects(
      () =>
        processShopRedact(
          {
            shop: "demo.myshopify.com",
            topic: "shop/redact",
            webhookId: "wh-redact-fail",
          },
          {
            claimDelivery: async () => "claimed",
            releaseDelivery,
            shopExists: async () => true,
            shopLooksReinstalled: async () => false,
            purgeShopData: async () => {
              throw new Error("purge exploded");
            },
            audit: async () => {},
          },
        ),
      /purge exploded/,
    );
    assert.equal(releaseDelivery.mock.callCount(), 1);
  });
});

describe("processCatalogWebhook", () => {
  it("returns 200 for an uninstalled shop without enqueue", async () => {
    const ackBatch = mock.fn(async () => ({ delivery: "new" as const }));
    const recordDelivery = mock.fn(async () => "new" as const);

    const res = await processCatalogWebhook(
      {
        shop: "gone.myshopify.com",
        topic: "products/update",
        webhookId: "wh-prod-uninstalled",
        payload: { id: 1 },
      },
      {
        isShopInactive: async () => true,
        recordDelivery,
        planJob: () => ({
          name: "product.upsert",
          data: { shop: "gone.myshopify.com" },
          jobId: "x",
        }),
        ackBatch,
      },
    );

    assert.equal(res.status, 200);
    assert.equal(ackBatch.mock.callCount(), 0);
    assert.equal(recordDelivery.mock.callCount(), 1);
  });

  it("throws (5xx) when enqueue fails on an active shop", async () => {
    await assert.rejects(
      () =>
        processCatalogWebhook(
          {
            shop: "active.myshopify.com",
            topic: "products/update",
            webhookId: "wh-prod-fail",
            payload: { id: 1 },
          },
          {
            isShopInactive: async () => false,
            recordDelivery: async () => "new",
            planJob: () => ({
              name: "product.upsert",
              data: { shop: "active.myshopify.com", productGid: "gid://shopify/Product/1" },
              jobId: "active:product.upsert:1",
            }),
            ackBatch: async () => {
              throw new Error("pool exhausted");
            },
          },
        ),
      /pool exhausted/,
    );
  });
});
