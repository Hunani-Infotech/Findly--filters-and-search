import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, useLoaderData, useNavigation } from "react-router";

import { PublicShell } from "../../components/public-shell";
import shell from "../../components/public-shell.module.css";
import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "Findly: Smart Filters & Search" },
  {
    name: "description",
    content:
      "Collection filters and storefront search for Shopify, delivered as a Theme App Extension.",
  },
];

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
    <PublicShell>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Shopify app</p>
          <h1 className={styles.heading}>
            Smart filters and search for your storefront
          </h1>
          <p className={styles.lede}>
            Collection filters and storefront search for Shopify — installed
            as a Theme App Extension, without a separate shopper login.
          </p>
        </div>
        {showForm ? (
          <aside className={shell.card} aria-labelledby="open-admin-title">
            <h2 className={shell.cardTitle} id="open-admin-title">
              Open in Shopify Admin
            </h2>
            <p className={shell.cardCopy}>
              Enter your shop domain to install Findly or open it in Shopify
              Admin.
            </p>
            <Form className={shell.form} method="post" action="/auth/login">
              <label className={shell.field}>
                <span className={shell.label}>Shop domain</span>
                <input
                  className={shell.input}
                  type="text"
                  name="shop"
                  defaultValue={defaultShop}
                  disabled={submitting}
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="url"
                  aria-describedby="shop-domain-hint"
                />
              </label>
              <p className={shell.hint} id="shop-domain-hint">
                e.g. {defaultShop}
              </p>
              <button
                className={shell.button}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Logging in…" : "Continue to Shopify"}
              </button>
            </Form>
          </aside>
        ) : null}
      </section>

      <section className={styles.features} aria-label="What Findly includes">
        <article className={styles.feature}>
          <h2 className={styles.featureTitle}>Collection filters</h2>
          <p className={styles.featureCopy}>
            Price, availability, vendor, type, tags, and mapped metafields.
          </p>
        </article>
        <article className={styles.feature}>
          <h2 className={styles.featureTitle}>Storefront search</h2>
          <p className={styles.featureCopy}>
            Solid product search via the Theme App Extension.
          </p>
        </article>
        <article className={styles.feature}>
          <h2 className={styles.featureTitle}>Theme App Extension</h2>
          <p className={styles.featureCopy}>
            Async-loaded filter widget with basic styling.
          </p>
        </article>
      </section>
    </PublicShell>
  );
}
