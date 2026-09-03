import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import {
  COLLECTION_PICKER_PAGE_SIZE,
  normalizeCollectionPickerPage,
  normalizeCollectionPickerPageSize,
  normalizeCollectionPickerQuery,
} from "../utils/collections-picker";
import { listCollectionsForPicker } from "../services/collections-picker.server";

/** JSON page of shop collections for the filter Applies to / Exclude pickers. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  const url = new URL(request.url);
  if (auth.bot) {
    const query = normalizeCollectionPickerQuery(url.searchParams.get("q"));
    const page = normalizeCollectionPickerPage(url.searchParams.get("page"));
    const pageSize = normalizeCollectionPickerPageSize(
      url.searchParams.get("pageSize"),
      COLLECTION_PICKER_PAGE_SIZE,
    );
    return {
      collections: [],
      page,
      pageSize,
      total: 0,
      hasNext: false,
      query,
      requestId: String(url.searchParams.get("r") || ""),
    };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
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
