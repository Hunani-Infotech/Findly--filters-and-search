import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, Link, useLoaderData, useNavigation } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return {
    showForm: Boolean(login),
    defaultShop:
      process.env.SHOPIFY_FLAG_STORE || "findly-test-store.myshopify.com",
  };
};

export default function App() {
  const { showForm, defaultShop } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" &&
    navigation.formMethod?.toUpperCase() === "POST" &&
    Boolean(navigation.formAction?.includes("/auth/login"));

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Findly: Smart Filters & Search</h1>
        <p className={styles.text}>
          Collection filters and storefront search for Shopify.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                defaultValue={defaultShop}
                disabled={submitting}
              />
              <span>e.g: {defaultShop}</span>
            </label>
            <button className={styles.button} type="submit" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Collection filters</strong>. Price, availability, vendor,
            type, tags, and mapped metafields.
          </li>
          <li>
            <strong>Storefront search</strong>. Solid product search via the
            Theme App Extension.
          </li>
          <li>
            <strong>Theme App Extension</strong>. Async-loaded filter widget
            with basic styling.
          </li>
        </ul>
        <p className={styles.footer}>
          <Link to="/privacy">Privacy policy</Link>
          {" · "}
          <Link to="/terms">Terms of service</Link>
        </p>
      </div>
    </div>
  );
}
