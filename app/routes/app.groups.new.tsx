import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { authenticateAdminAllowReviewBot } from "../lib/admin-auth.server";
import { ensureShopAccess } from "../services/billing.server";
import { withEmbeddedParamsFromRequest } from "../utils/admin-path";
import { parseValueGroupForm, ValueGroupFormPage } from "../components/value-group-form";
import {
  createValueGroup,
  emptyCatalogValuesPage,
  getCatalogValuesPage,
} from "../services/value-groups.server";

export { GroupFormSkeleton as HydrateFallback } from "../components/admin-skeletons";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const auth = await authenticateAdminAllowReviewBot(request);
  if (auth.bot) {
    return { catalog: emptyCatalogValuesPage() };
  }
  const { session } = auth;
  const { shop } = await ensureShopAccess(session.shop);
  const catalog = await getCatalogValuesPage(shop.id, "");
  return { catalog };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = await ensureShopAccess(session.shop);
  const form = await request.formData();
  const input = parseValueGroupForm(form);
  const result = await createValueGroup(shop.id, input);
  if ("error" in result) return { error: result.error };
  return redirect(
    withEmbeddedParamsFromRequest(request, "/app/groups?notice=saved"),
  );
};

export default function NewValueGroupPage() {
  const { catalog } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <ValueGroupFormPage
      catalog={catalog}
      group={null}
      error={actionData && "error" in actionData ? actionData.error : undefined}
    />
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
