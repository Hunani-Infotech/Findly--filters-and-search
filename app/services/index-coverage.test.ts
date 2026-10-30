import assert from "node:assert/strict";
import test from "node:test";
import { indexCoverageFields } from "./index-coverage";

test("indexed_count is unique products and index_complete stays false", () => {
  const fields = indexCoverageFields([
    { productGid: "gid://shopify/Product/1", handle: "a" },
    { productGid: "gid://shopify/Product/1", handle: "a" },
    { productGid: "gid://shopify/Product/2", handle: "b" },
    { handle: "c" },
  ]);
  assert.equal(fields.indexed_count, 3);
  assert.equal(fields.index_complete, false);
});

test("an empty row set is an empty index", () => {
  const fields = indexCoverageFields([]);
  assert.equal(fields.indexed_count, 0);
  assert.equal(fields.index_complete, false);
});
