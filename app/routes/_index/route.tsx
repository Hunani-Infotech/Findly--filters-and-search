import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, Link, useLoaderData, useNavigation } from "react-router";

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
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>Findly</span>
          <nav className={styles.nav} aria-label="Legal">
            <Link className={styles.navLink} to="/privacy">
              Privacy
            </Link>
            <Link className={styles.navLink} to="/terms">
              Terms
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
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
            <aside className={styles.card} aria-labelledby="open-admin-title">
              <h2 className={styles.cardTitle} id="open-admin-title">
                Open in Shopify Admin
              </h2>
              <p className={styles.cardCopy}>
                Enter your shop domain to install Findly or open it in Shopify
                Admin.
              </p>
              <Form className={styles.form} method="post" action="/auth/login">
                <label className={styles.field}>
                  <span className={styles.label}>Shop domain</span>
                  <input
                    className={styles.input}
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
                <p className={styles.hint} id="shop-domain-hint">
                  e.g. {defaultShop}
                </p>
                <button
                  className={styles.button}
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Logging in…" : "Continue to Shopify"}
                </button>
              </Form>
            </aside>
          ) : null}
        </section>

        <section
          className={styles.features}
          aria-label="What Findly includes"
        >
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
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <small>Hunani Infotech</small>
          <nav className={styles.footerLinks} aria-label="Footer">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
