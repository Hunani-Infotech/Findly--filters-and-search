import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useEffect } from "react";
import { redirect, Form, Link, useLoaderData, useNavigation } from "react-router";

import { PublicShell } from "../../components/public-shell";
import shell from "../../components/public-shell.module.css";
import { scrollToId } from "../../utils/public-scroll";
import { FINDLY_SUPPORT_EMAIL } from "../../utils/public-origin";
import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "Findly: Smart Filters & Search" },
  {
    name: "description",
    content:
      "Collection filters, storefront search, instant suggestions, metafield mapping, and GDPR-ready shop-scoped data for Shopify.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

const SHOP_DOMAIN_EXAMPLE = "your-store.myshopify.com";

function ShopLoginForm({
  submitting,
  hintId,
}: {
  submitting: boolean;
  hintId: string;
}) {
  return (
    <Form className={shell.form} method="post" action="/auth/login">
      <label className={shell.field}>
        <span className={shell.label}>Shop domain</span>
        <input
          className={shell.input}
          type="text"
          name="shop"
          defaultValue=""
          placeholder={SHOP_DOMAIN_EXAMPLE}
          disabled={submitting}
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          aria-describedby={hintId}
        />
      </label>
      <p className={shell.hint} id={hintId}>
        e.g. {SHOP_DOMAIN_EXAMPLE}
      </p>
      <button className={shell.button} type="submit" disabled={submitting}>
        {submitting ? "Logging in…" : "Continue to Shopify"}
      </button>
    </Form>
  );
}

const PRODUCTS = [
  { name: "Linen apron", price: "$48", photo: styles.ph1 },
  { name: "Stoneware mug", price: "$22", photo: styles.ph2 },
  { name: "Oak board", price: "$64", photo: styles.ph3 },
  { name: "Wool throw", price: "$90", photo: styles.ph4 },
  { name: "Brass hook", price: "$18", photo: styles.ph5 },
  { name: "Cotton tote", price: "$28", photo: styles.ph6 },
] as const;

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting =
    navigation.state !== "idle" &&
    navigation.formMethod?.toUpperCase() === "POST" &&
    Boolean(navigation.formAction?.includes("/auth/login"));

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (id) window.requestAnimationFrame(() => scrollToId(id));
  }, []);

  return (
    <PublicShell>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Built for Shopify themes</p>
          <h1 className={styles.heading}>
            Help shoppers find the right product — without leaving your theme
          </h1>
          <p className={styles.lede}>
            Findly adds collection filters and storefront search to Shopify.
            Merchants configure everything in Admin. Shoppers never create a
            Findly account.
          </p>
          <dl className={styles.stats} aria-label="Highlights">
            <div>
              <dt>Theme App Extension</dt>
              <dd>Filters in the theme</dd>
            </div>
            <div>
              <dt>App proxy</dt>
              <dd>Requests on your domain</dd>
            </div>
            <div>
              <dt>Admin GraphQL</dt>
              <dd>No REST Admin API</dd>
            </div>
          </dl>
        </div>
        {showForm ? (
          <aside className={shell.card} id="open-admin" aria-labelledby="open-admin-title">
            <h2 className={shell.cardTitle} id="open-admin-title">
              Open in Shopify Admin
            </h2>
            <p className={shell.cardCopy}>
              Enter your <code className={styles.inlineCode}>.myshopify.com</code>{" "}
              domain to install Findly or open it if it is already installed.
            </p>
            <ShopLoginForm
              submitting={submitting}
              hintId="shop-domain-hint"
            />
          </aside>
        ) : null}
      </section>

      <section className={styles.stage} aria-hidden="true">
        <div className={styles.frame}>
          <div className={styles.bar}>
            <p>your-store.com/collections/all</p>
          </div>
          <div className={styles.body}>
            <aside className={styles.side}>
              <p className={styles.sideHead}>Filters</p>
              <div className={styles.check}>
                <span className={styles.on} /> In stock
              </div>
              <div className={styles.check}>
                <span /> Under $50
              </div>
              <div className={styles.check}>
                <span /> Vendor: Findly
              </div>
              <ul className={styles.swatches}>
                <li>
                  <i className={styles.ink} /> Ink
                </li>
                <li>
                  <i className={styles.bone} /> Bone
                </li>
                <li>
                  <i className={styles.pine} /> Pine
                </li>
                <li>
                  <i className={styles.clay} /> Clay
                </li>
              </ul>
            </aside>
            <div className={styles.grid}>
              {PRODUCTS.map((item) => (
                <article key={item.name}>
                  <div className={item.photo} />
                  <h3>{item.name}</h3>
                  <p>{item.price}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
        <p className={styles.caption}>
          Filter sidebar and product grid on the collection page — loaded from
          your theme, not a separate storefront.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="how-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>Setup</p>
          <h2 className={styles.sectionTitle} id="how-heading">
            Live in three steps
          </h2>
          <p className={styles.sectionLede}>
            No custom theme code for the core widget. You install the app,
            enable the embed, and sync the catalog.
          </p>
        </div>
        <ol className={styles.steps}>
          <li>
            <span className={styles.stepNum}>1</span>
            <h3>Install on your shop</h3>
            <p>
              Log in with your shop domain. Shopify handles OAuth. Findly
              stores a shop-scoped session — not shopper accounts.
            </p>
          </li>
          <li>
            <span className={styles.stepNum}>2</span>
            <h3>Sync the catalog</h3>
            <p>
              Products, collections, vendors, tags, and mapped metafields are
              indexed so filters and search stay fast on the storefront.
            </p>
          </li>
          <li>
            <span className={styles.stepNum}>3</span>
            <h3>Enable the theme blocks</h3>
            <p>
              Add Collection filters to the collection template (and Instant
              search as an app embed, if you use it) in the theme editor.
              Placement, accent, and counts are configurable.
            </p>
          </li>
        </ol>
      </section>

      <section className={styles.section} id="features" aria-labelledby="features-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>Product</p>
          <h2 className={styles.sectionTitle} id="features-heading">
            What merchants get
          </h2>
          <p className={styles.sectionLede}>
            Collection filters, storefront search, and the Theme App Extension
            — plus search extras, translation, integrations, and usage
            analytics — configured per shop in Admin.
          </p>
        </div>
        <div className={styles.lead}>
          <article className={styles.tile}>
            <h3 className={styles.featureTitle}>Collection filters</h3>
            <p className={styles.featureCopy}>
              Price, availability, vendor, product type, tags, options, and
              metafields you map. Per-collection filter sets in Admin.
            </p>
            <ul className={styles.snip}>
              <li>
                <span className={styles.on} /> In stock
              </li>
              <li>
                <span /> Under $50
              </li>
              <li>
                <span /> Vendor: Findly
              </li>
            </ul>
          </article>
          <article className={styles.tile}>
            <h3 className={styles.featureTitle}>Storefront search</h3>
            <p className={styles.featureCopy}>
              Keyword product search through the Theme App Extension — instant
              suggestions, pinnings, synonyms, and redirects from your indexed
              catalog, not a separate search-engine UI.
            </p>
            <div className={styles.searchSnip}>
              <span>Search products…</span>
            </div>
          </article>
        </div>
        <div className={styles.list}>
          <article>
            <h3 className={styles.featureTitle}>Theme App Extension</h3>
            <p className={styles.featureCopy}>
              Collection filters app block, Product search block, and Instant
              search embed. Async-loaded widget, scoped CSS, and basic styling:
              position (left, right, or top), accent color, product counts, and
              collapse-by-default.
            </p>
          </article>
          <article>
            <h3 className={styles.featureTitle}>Metafield mapping</h3>
            <p className={styles.featureCopy}>
              Turn product metafields into filter facets. Color swatches can
              use Shopify Files; Findly stores the resulting URL, not a second
              media library.
            </p>
          </article>
          <article>
            <h3 className={styles.featureTitle}>Shopify Billing</h3>
            <p className={styles.featureCopy}>
              Development (Shopify development stores only), Standard, and Pro
              through the Shopify Billing API. Product index and metafield
              caps differ by plan; live shops approve Standard at install.
            </p>
          </article>
          <article>
            <h3 className={styles.featureTitle}>Translation &amp; integrations</h3>
            <p className={styles.featureCopy}>
              Edit widget labels per locale. After Ajax filtering, review and
              wishlist widgets (and Weglot) can re-init so they stay in sync
              with the filtered grid.
            </p>
          </article>
          <article>
            <h3 className={styles.featureTitle}>Filter &amp; search analytics</h3>
            <p className={styles.featureCopy}>
              See top queries, no-results, and popular filters in Admin. Counts
              stay at zero until the theme widgets are live on the storefront.
            </p>
          </article>
          <article>
            <h3 className={styles.featureTitle}>Shop-scoped &amp; GDPR ready</h3>
            <p className={styles.featureCopy}>
              Every table is tied to the installing shop. Mandatory compliance
              webhooks (data request, customer redact, shop redact) are
              implemented — not empty stubs.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.help} aria-labelledby="help-heading">
        <div>
          <p className={styles.kicker}>Help</p>
          <h2 className={styles.sectionTitle} id="help-heading">
            Search answers before you write in
          </h2>
          <p className={styles.sectionLede}>
            Install, filters, search extras, plans, and data handling — jump
            straight to a matching FAQ.
          </p>
        </div>
        <form className={styles.helpSearch} action="/faq" method="get" role="search">
          <label className={styles.helpLabel} htmlFor="home-faq-q">
            Search the FAQ
          </label>
          <input
            id="home-faq-q"
            className={styles.helpInput}
            type="search"
            name="q"
            placeholder="e.g. metafield filters, refund, theme block"
            autoComplete="off"
          />
          <button className={styles.helpSubmit} type="submit">
            Search FAQ
          </button>
        </form>
      </section>

      <section className={styles.trust} aria-labelledby="trust-heading">
        <div className={styles.sectionHead}>
          <p className={styles.kicker}>Built for Shopify</p>
          <h2 className={styles.sectionTitle} id="trust-heading">
            Admin GraphQL only. No shopper login.
          </h2>
        </div>
        <ul className={styles.trustList}>
          <li>
            <strong>Embedded admin</strong>
            Configure filters, search, swatches, and billing inside Shopify
            Admin — not a separate merchant portal.
          </li>
          <li>
            <strong>App proxy</strong>
            Storefront widgets call{" "}
            <code className={styles.inlineCode}>/apps/smart-filter</code> on
            your shop so requests stay on your domain.
          </li>
          <li>
            <strong>Least privilege</strong>
            Catalog sync uses read scopes for products, inventory, content, and
            markets. Findly does not request customer or order data.
          </li>
        </ul>
        <p className={styles.legal}>
          <Link to="/faq">FAQ</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of service</Link>
          <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>{FINDLY_SUPPORT_EMAIL}</a>
        </p>
      </section>

      {showForm ? (
        <section className={styles.cta} aria-labelledby="cta-title">
          <div>
            <h2 className={styles.sectionTitle} id="cta-title">
              Ready to try it on a development store?
            </h2>
            <p className={styles.sectionLede}>
              Use the same shop domain you install apps with. After you approve
              Findly in Shopify, you land in the embedded admin.
            </p>
          </div>
          <aside className={shell.card}>
            <h3 className={shell.cardTitle}>Log in with your shop</h3>
            <p className={shell.cardCopy}>
              Development stores and production shops both use this form.
            </p>
            <ShopLoginForm
              submitting={submitting}
              hintId="shop-domain-hint-cta"
            />
          </aside>
        </section>
      ) : null}
    </PublicShell>
  );
}
