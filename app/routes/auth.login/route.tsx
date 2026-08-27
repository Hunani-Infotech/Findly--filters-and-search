import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";

import { PublicShell } from "../../components/public-shell";
import shell from "../../components/public-shell.module.css";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const meta: MetaFunction = () => [
  { title: "Log in · Findly" },
  {
    name: "description",
    content: "Sign in to Findly with your Shopify shop domain.",
  },
];

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
    <PublicShell>
      <div className={shell.loginLayout}>
        <div className={shell.loginCopy}>
          <h1>Open Findly in Shopify Admin</h1>
          <p>
            Use the shop domain you install apps with. Shopify will ask you to
            approve Findly, then the embedded admin opens — filters, search,
            and theme settings stay inside Admin.
          </p>
          <ul>
            <li>No separate Findly password</li>
            <li>Works on development stores and live shops</li>
            <li>Shop-scoped data only — shoppers do not log in here</li>
          </ul>
        </div>
        <div className={shell.narrow}>
          <aside className={shell.card} aria-labelledby="login-title">
            <h2 className={shell.cardTitle} id="login-title">
              Log in
            </h2>
            <p className={shell.cardCopy}>
              Enter your <code>.myshopify.com</code> domain.
            </p>
            <Form className={shell.form} method="post">
              <label className={shell.field}>
                <span className={shell.label}>Shop domain</span>
                <input
                  className={
                    errors.shop ? `${shell.input} ${shell.inputError}` : shell.input
                  }
                  type="text"
                  name="shop"
                  value={shop}
                      onChange={(event) => setShop(event.currentTarget.value)}
                  disabled={submitting}
                  autoComplete="on"
                  spellCheck={false}
                  inputMode="url"
                  aria-invalid={Boolean(errors.shop)}
                  aria-describedby={errors.shop ? "shop-error" : "shop-hint"}
                />
              </label>
              {errors.shop ? (
                <p className={shell.error} id="shop-error" role="alert">
                  {errors.shop}
                </p>
              ) : (
                <p className={shell.hint} id="shop-hint">
                  e.g. {loaderData.defaultShop}
                </p>
              )}
              <button
                className={shell.button}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Logging in…" : "Continue to Shopify"}
              </button>
            </Form>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
