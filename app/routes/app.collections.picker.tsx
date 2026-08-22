import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import {
  COLLECTION_PICKER_PAGE_SIZE,
  normalizeCollectionPickerPage,
  normalizeCollectionPickerPageSize,
  normalizeCollectionPickerQuery,
} from "../collections-picker";
import { listCollectionsForPicker } from "../collections-picker.server";

/** JSON page of shop collections for the filter Applies to / Exclude pickers. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const url = new URL(request.url);
  const page = await listCollectionsForPicker(shop.id, {
    query: normalizeCollectionPickerQuery(url.searchParams.get("q")),
    page: normalizeCollectionPickerPage(url.searchParams.get("page")),
    pageSize: normalizeCollectionPickerPageSize(
      url.searchParams.get("pageSize"),
      COLLECTION_PICKER_PAGE_SIZE,
    ),
  });
  return {
    collections: page.collections,
    page: page.page,
    pageSize: page.pageSize,
    total: page.total,
    hasNext: page.hasNext,
    query: page.query,
    requestId: String(url.searchParams.get("r") || ""),
  };
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
