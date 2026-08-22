import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
    defaultShop:
      process.env.SHOPIFY_FLAG_STORE || "findly-test-store.myshopify.com",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [shop, setShop] = useState(loaderData.defaultShop || "");
  const { errors } = actionData || loaderData;
  const submitting =
    navigation.state === "submitting" ||
    (navigation.state === "loading" &&
      navigation.formMethod?.toUpperCase() === "POST");

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
        <s-section heading="Log in">
          <s-text-field
            name="shop"
            label="Shop domain"
            details="findly-test-store.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.currentTarget.value)}
            autocomplete="on"
            error={errors.shop}
            disabled={submitting}
          ></s-text-field>
          <s-button type="submit" loading={submitting || undefined}>
            Log in
          </s-button>
        </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
