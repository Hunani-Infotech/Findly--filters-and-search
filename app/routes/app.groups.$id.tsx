import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShopAccess } from "../billing.server";
import { withEmbeddedParamsFromRequest } from "../admin-path";
import { parseValueGroupForm, ValueGroupFormPage } from "../components/value-group-form";
import {
  deleteValueGroup,
  getCatalogValuesPage,
  getValueGroup,
  updateValueGroup,
} from "../value-groups.server";

export { GroupFormSkeleton as HydrateFallback } from "../components/admin-skeletons";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const id = params.id;
  if (!id) return redirect(withEmbeddedParamsFromRequest(request, "/app/groups"));

  const group = await getValueGroup(shop.id, id);
  if (!group) return redirect(withEmbeddedParamsFromRequest(request, "/app/groups"));

  const catalog = await getCatalogValuesPage(shop.id, group.sourceKey);
  return {
    catalog,
    group: {
      id: group.id,
      name: group.name,
      sourceKey: group.sourceKey,
      values: group.values,
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const id = params.id;
  if (!id) return redirect(withEmbeddedParamsFromRequest(request, "/app/groups"));

  const form = await request.formData();
  const intent = String(form.get("intent") || "save");
  if (intent === "delete") {
    await deleteValueGroup(shop.id, id);
    return redirect(
      withEmbeddedParamsFromRequest(request, "/app/groups?notice=deleted"),
    );
  }

  const input = parseValueGroupForm(form);
  const result = await updateValueGroup(shop.id, id, input);
  if ("error" in result) return { error: result.error };
  return redirect(
    withEmbeddedParamsFromRequest(request, "/app/groups?notice=saved"),
  );
};

export default function EditValueGroupPage() {
  const { catalog, group } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <ValueGroupFormPage
      catalog={catalog}
      group={group}
      error={actionData && "error" in actionData ? actionData.error : undefined}
    />
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
