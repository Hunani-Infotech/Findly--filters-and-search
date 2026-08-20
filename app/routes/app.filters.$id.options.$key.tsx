import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { FilterOptionEditorPage } from "../components/filter-option-editor";
import {
  deleteFilterOption,
  loadFilterOptionEditorPage,
  saveFilterOption,
} from "../filter-option-editor.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const treeId = params.id;
  const key = params.key ? decodeURIComponent(params.key) : "";
  if (!treeId || !key) throw new Response("Not found", { status: 404 });
  const page = await loadFilterOptionEditorPage(shop.id, treeId, "edit", key);
  if (page === "not_found") throw new Response("Not found", { status: 404 });
  return {
    ...page,
    shopDomain: session.shop || "findly-test-store.myshopify.com",
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const treeId = params.id;
  const key = params.key ? decodeURIComponent(params.key) : "";
  if (!treeId) return { error: "Filter tree required" };
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  if (intent === "delete") {
    const result = await deleteFilterOption(shop.id, treeId, key);
    if ("error" in result) return { error: result.error };
    return redirect(`/app/filters/${treeId}?notice=deleted`);
  }
  const result = await saveFilterOption(shop.id, treeId, "edit", form);
  if ("error" in result) return { error: result.error };
  return redirect(`/app/filters/${treeId}?notice=saved`);
};

export default function EditFilterOptionPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <FilterOptionEditorPage
      data={data}
      error={actionData && "error" in actionData ? actionData.error : undefined}
    />
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
