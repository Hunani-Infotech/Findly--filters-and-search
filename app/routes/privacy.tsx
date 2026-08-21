import type { HeadersFunction, MetaFunction } from "react-router";
import { Link } from "react-router";

import { FINDLY_PUBLIC_ORIGIN } from "../public-origin";
import styles from "./privacy.module.css";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — Findly: Smart Filters & Search" },
  {
    name: "description",
    content:
      "How Findly accesses, stores, and deletes merchant and shopper data for collection filters, storefront search, and the Theme App Extension, including GDPR webhook handling and retention.",
  },
];

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

export default function PrivacyPolicy() {
  return (
    <main className={styles.page}>
      <article className={styles.inner}>
        <Link className={styles.brand} to="/">
          Findly: Smart Filters & Search
        </Link>
        <h1>Privacy Policy</h1>
        <p className={styles.updated}>Effective 21 August 2026</p>

        <p>
          This policy describes how Hunani Infotech (“we”, “us”, “Findly”)
          handles information when merchants install and use the Shopify app
          <strong> Findly: Smart Filters & Search</strong> (collection filters,
          storefront search, and a Theme App Extension). It is written for
          Shopify’s App Store listing and for merchants who need to know what
          the app accesses on their shop.
        </p>
        <p>
          Findly is a merchant tool. Shoppers on a merchant’s storefront
          interact with the filter and search widgets; they do not create a
          Findly account.
        </p>

        <h2>1. Who is responsible</h2>
        <p>
          Hunani Infotech operates Findly and the production app at{" "}
          <a href={FINDLY_PUBLIC_ORIGIN}>findly.hunaniinfotech.com</a>
          . Shopify remains responsible for the merchant’s store, Admin, and
          Checkout. Merchants remain responsible for their own storefront
          privacy notices to shoppers.
        </p>

        <h2>2. Shopify permissions we request</h2>
        <p>
          Findly uses the Shopify Admin GraphQL API only (not the REST Admin
          API). After install, the app requests these access scopes:
        </p>
        <ul>
          <li>
            <code>read_products</code> — product, variant, collection, and
            related catalog data used to build filters and search.
          </li>
          <li>
            <code>read_inventory</code> and <code>read_locations</code> —
            availability and location names for in-stock filters.
          </li>
          <li>
            <code>read_content</code> — Online Store pages and blog articles
            for instant search suggestions.
          </li>
          <li>
            <code>read_markets</code> — market / presentment prices so price
            filters can match the shopper’s country.
          </li>
          <li>
            <code>read_files</code> and <code>write_files</code> — list and
            upload color-swatch images into the merchant’s Shopify Files
            (files stay on Shopify; we store the resulting URL).
          </li>
          <li>
            <code>read_companies</code> (optional) — B2B company-location
            catalog prices when the merchant enables Markets / B2B pricing.
          </li>
        </ul>
        <p>
          Findly does <strong>not</strong> request <code>read_customers</code>,
          <code>read_orders</code>, <code>read_checkouts</code>, or similar
          customer-profile scopes. We do not read customer names, emails,
          addresses, payment methods, or order history from Shopify.
        </p>

        <h2>3. Merchant data we store</h2>
        <p>
          All application data is scoped to the installing shop (multi-tenant).
          We store:
        </p>
        <ul>
          <li>
            <strong>Shop identity and sessions.</strong> Shop domain, install
            time, plan label, and OAuth session records (offline access token
            and, for online sessions, staff first name, last name, email, and
            user id as provided by Shopify’s session storage).
          </li>
          <li>
            <strong>Catalog index.</strong> Product titles, handles, vendors,
            types, tags, SKUs, options, prices, compare-at prices, availability,
            inventory location names, image URLs, mapped metafield values,
            variant summaries, collection titles/handles, and
            collection-to-product membership. This is a denormalized copy used
            to answer filter and search queries quickly.
          </li>
          <li>
            <strong>Content index.</strong> Page and article titles and handles
            for instant search.
          </li>
          <li>
            <strong>App configuration.</strong> Filter sets, metafield mappings,
            widget settings (position, colors, sort, search fields), color
            swatches, value groups, translation labels, billing subscription
            ids/status, and sync job status.
          </li>
          <li>
            <strong>Support drafts.</strong> If a merchant uses Contact in the
            admin, the draft (email, collaborator code, subject, message) is
            saved with shop settings until they send or we purge the shop.
          </li>
        </ul>

        <h2>4. Shopper (customer) data</h2>
        <p>
          Findly does not create shopper accounts and does not store Shopify
          customer profiles. Storefront widgets may send limited usage data so
          merchants can see how filters and search are used:
        </p>
        <ul>
          <li>
            Search keywords, selected filter combinations, product handles
            clicked or visited, result counts, and device type (desktop or
            mobile).
          </li>
          <li>
            An anonymous visitor id stored in the shopper’s browser{" "}
            <code>localStorage</code> key <code>findly:vid</code>. It is a
            random identifier generated in the Theme App Extension, not a
            Shopify customer id, email, or IP address.
          </li>
        </ul>
        <p>
          Search boxes can contain whatever a shopper types. We treat those
          strings as usage data, not as an identity record. Merchants should
          mention Findly’s storefront widgets in their own privacy policy if
          required by their region.
        </p>

        <h2>5. How we use this data</h2>
        <ul>
          <li>Provide collection filters and storefront search on the theme.</li>
          <li>Sync catalog changes from Shopify webhooks and bulk operations.</li>
          <li>Show merchants their filter, search, and billing settings.</li>
          <li>
            Show merchants aggregated search/filter analytics (top queries,
            no-results, popular filters).
          </li>
          <li>Charge plans through the Shopify Billing API.</li>
          <li>Respond to uninstall and mandatory compliance webhooks.</li>
          <li>Deliver merchant support messages when Contact is configured.</li>
        </ul>
        <p>
          We do not sell personal data. We do not use shopper data for
          advertising networks. We do not train third-party AI models on
          merchant catalog or shopper queries.
        </p>

        <h2>6. Where data is stored</h2>
        <ul>
          <li>
            <strong>PostgreSQL</strong> — primary store for sessions, catalog
            index, configuration, analytics events, and compliance audit rows.
            Hosted with the production app (currently Fly.io, primary region
            Ashburn, USA — <code>iad</code>).
          </li>
          <li>
            <strong>Redis + BullMQ</strong> — short-lived job payloads (shop
            domain, product/collection ids, sync commands) for background
            workers. Jobs are not a second catalog copy.
          </li>
          <li>
            <strong>Shopify</strong> — OAuth, Billing, Files (swatch uploads),
            and the merchant’s own product data remain on Shopify.
          </li>
          <li>
            <strong>Email / webhook delivery</strong> — if the merchant submits
            Contact, the message may be sent through Resend and/or a configured
            support webhook. Those providers only receive what the merchant
            typed.
          </li>
        </ul>
        <p>
          Access tokens are stored in the shop’s session row. They are used
          only to call Shopify Admin GraphQL for that shop. Catalog tables do
          not duplicate the access token.
        </p>

        <h2>7. GDPR and Shopify mandatory webhooks</h2>
        <p>
          Findly implements Shopify’s mandatory compliance webhooks. Shopify
          authenticates each request before we process it.
        </p>
        <ul>
          <li>
            <strong>
              <code>customers/data_request</code>
            </strong>{" "}
            — Shopify asks us to provide data we hold about a customer. Findly
            does not store Shopify customer profiles. We log the request
            (shop domain, Shopify webhook request id, topic, timestamp, and
            status — never the raw customer body) and respond that we do
            not hold customer personally identifiable information from the
            Customers API. Merchants can disclose that response to the
            shopper.
          </li>
          <li>
            <strong>
              <code>customers/redact</code>
            </strong>{" "}
            — Shopify asks us to delete customer personal data. We do not store
            customer profiles. On this webhook we delete any analytics events
            for that shop whose search query, filter combo, handle, or visitor
            string contains the customer’s email, phone, or customer id. We
            then record a non-PII audit row and return HTTP 200.
          </li>
          <li>
            <strong>
              <code>shop/redact</code>
            </strong>{" "}
            — Shopify sends this after uninstall (typically within 48 hours)
            when the shop’s data must be erased. We try to queue a background
            cleanup; if Redis is down we delete tenant data in the webhook
            process before responding. If that purge also fails we return an
            error so Shopify retries. Audit status is queued, redacted, or
            failed.
          </li>
          <li>
            <strong>
              <code>app/uninstalled</code>
            </strong>{" "}
            — we run the same guaranteed cleanup when the merchant uninstalls,
            without waiting for <code>shop/redact</code>.
          </li>
        </ul>
        <p>
          Compliance webhook receipts are stored in a separate audit table
          keyed by shop domain (not a foreign key to the shop). That audit
          trail is kept after tenant data is purged so we can show Shopify
          that the request was received and handled. The row stores only shop
          domain, request id, topic, status, and timestamp. Customer email,
          phone, name, and other payload fields are not written to the
          database or to fallback logs.
        </p>

        <h2>8. Data retention</h2>
        <ul>
          <li>
            <strong>While the app is installed:</strong> catalog index and
            merchant settings are kept so filters and search work. The index is
            refreshed from Shopify (full sync and product/collection webhooks).
          </li>
          <li>
            <strong>Storefront analytics:</strong> pruned automatically —
            90 days on the Free plan, 180 days on paid plans.
          </li>
          <li>
            <strong>After uninstall:</strong> we queue deletion of sessions and
            all shop-scoped rows (products, collections, settings, mappings,
            swatches, analytics, billing mirror). Redis jobs for that shop are
            not used as a long-term store.
          </li>
          <li>
            <strong>Shop redact:</strong> the same deletion path runs if any
            tenant data is still present when Shopify sends{" "}
            <code>shop/redact</code>.
          </li>
          <li>
            <strong>Compliance audit logs:</strong> retained after purge for
            legal and App Store compliance evidence. They are not used to
            operate filters or search.
          </li>
          <li>
            <strong>Support email:</strong> if a merchant contacts us, copies
            may remain in our support inbox or webhook destination under that
            provider’s retention rules.
          </li>
        </ul>

        <h2>9. Cookies and similar technology</h2>
        <p>
          The embedded admin uses Shopify’s session cookies to keep the merchant
          logged in. The storefront Theme App Extension does not set a Findly
          cookie; it may write the anonymous <code>findly:vid</code> value to{" "}
          <code>localStorage</code> for analytics uniqueness. Filter state is
          kept in the page URL hash (not sent to our servers as a shopper
          identity).
        </p>

        <h2>10. International transfers</h2>
        <p>
          Production hosting is in the United States (Fly.io <code>iad</code>).
          If a merchant or shopper is in the EEA, UK, or another region, data
          described above may be processed in the US to provide the app.
          Shopify also processes data under the merchant’s Shopify agreement.
        </p>

        <h2>11. Your choices and requests</h2>
        <p>Merchants can:</p>
        <ul>
          <li>Uninstall Findly, which starts deletion of shop-scoped data.</li>
          <li>
            Use Shopify Admin → Apps to review permissions, or Shopify’s
            customer data request / redaction tools (those trigger the webhooks
            above).
          </li>
          <li>
            Contact us using <strong>Findly → Contact</strong> in the app, or
            the support email published on the Findly Shopify App Store
            listing. Do not send privacy requests to Shopify about this app’s
            stored index; Shopify will forward mandatory GDPR topics to us.
          </li>
        </ul>
        <p>
          Shoppers should contact the merchant first. The merchant can use
          Shopify’s customer privacy tools; we will receive the corresponding
          webhook.
        </p>

        <h2>12. Children</h2>
        <p>
          Findly is a B2B Shopify app. We do not knowingly collect personal
          information from children. Catalog and analytics data come from the
          merchant’s store, not from child accounts we create.
        </p>

        <h2>13. Changes</h2>
        <p>
          We will update this page when our data practices or Shopify
          requirements change. The effective date at the top will change. The
          current version is always at this URL.
        </p>

        <h2>14. Contact</h2>
        <p>
          Hunani Infotech — Findly: Smart Filters & Search
          <br />
          Privacy page:{" "}
          <a href={`${FINDLY_PUBLIC_ORIGIN}/privacy`}>
            {FINDLY_PUBLIC_ORIGIN}/privacy
          </a>
          <br />
          Terms:{" "}
          <Link to="/terms">{FINDLY_PUBLIC_ORIGIN}/terms</Link>
          <br />
          In-app: Findly → Contact
        </p>

        <p className={styles.footer}>
          <Link to="/terms">Terms of service</Link>
          {" · "}
          <Link to="/">Back to Findly</Link>
        </p>
      </article>
    </main>
  );
}
