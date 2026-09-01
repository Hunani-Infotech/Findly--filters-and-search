import type { HeadersFunction, MetaFunction } from "react-router";
import { Link } from "react-router";

import { LegalDoc } from "../components/legal-doc";
import { PublicShell } from "../components/public-shell";
import { FINDLY_SUPPORT_EMAIL } from "../utils/public-origin";

export const meta: MetaFunction = () => [
  { title: "Terms of Service — Findly: Smart Filters & Search" },
  {
    name: "description",
    content:
      "Merchant terms for Findly: Smart Filters & Search, including Free, Standard, and Pro billing, acceptable use, and liability.",
  },
];

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

export default function TermsOfService() {
  return (
    <PublicShell>
      <LegalDoc
        eyebrow="Legal"
        title="Terms of Service"
        updated="Effective 26 August 2026"
        toc={[
          { id: "service", label: "The service" },
          { id: "eligibility", label: "Eligibility" },
          { id: "billing", label: "Billing plans" },
          { id: "use", label: "Acceptable use" },
          { id: "content", label: "Your content" },
          { id: "support", label: "Availability and support" },
          { id: "ip", label: "Intellectual property" },
          { id: "disclaimer", label: "Disclaimer" },
          { id: "liability", label: "Limitation of liability" },
          { id: "indemnity", label: "Indemnity" },
          { id: "termination", label: "Suspension and uninstall" },
          { id: "changes", label: "Changes" },
          { id: "general", label: "General" },
          { id: "contact", label: "Contact" },
        ]}
      >
        <p>
          These Terms of Service (“Terms”) are a contract between you (the
          Shopify merchant installing the app) and SRH Web Agency (“we”,
          “us”, “Findly”) for the hosted Shopify application{" "}
          <strong>Findly: Smart Filters & Search</strong>.
        </p>
        <p>
          By installing or using Findly you agree to these Terms and to our{" "}
          <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do
          not install the app, or uninstall it from Shopify Admin.
        </p>
        <p>
          The MIT license in this repository’s <code>LICENSE.md</code> is
          Shopify’s template copyright. It is not these merchant Terms and
          does not govern your paid or free use of the hosted app.
        </p>

        <h2 id="service">1. The service</h2>
        <p>Findly provides:</p>
        <ul>
          <li>
            Collection filters (price, availability, vendor, type, tags,
            options, and mapped metafields) configured in the Shopify admin.
          </li>
          <li>
            Storefront product search via the Theme App Extension (keyword
            search, instant suggestions, pins, synonyms, and redirects as
            configured).
          </li>
          <li>
            A Theme App Extension widget you add in the theme editor
            (placement, accent, counts, and related settings).
          </li>
        </ul>
        <p>
          Features shown as under construction, or not listed on the Shopify
          App Store listing, are not part of the service you are buying. We
          may change, limit, or withdraw features as we operate the app.
        </p>
        <p>
          You remain responsible for your Shopify store, theme, product data,
          and shopper-facing policies. Shopify’s terms also apply. Findly is
          not Shopify and is not a party to your Shopify merchant agreement.
        </p>

        <h2 id="eligibility">2. Eligibility and your account</h2>
        <ul>
          <li>
            You must be a Shopify merchant (or staff with permission to
            install apps) and able to bind the store to these Terms.
          </li>
          <li>
            Access is through Shopify OAuth. We do not issue a separate
            Findly password.
          </li>
          <li>
            You must keep your Shopify staff access secure and tell us if
            you believe the install was unauthorized.
          </li>
        </ul>

        <h2 id="billing">3. Billing plans</h2>
        <p>
          All charges go through the Shopify Billing API. Listing prices must
          match in-app prices. Currency is USD. Billing interval for paid
          plans is every 30 days.
        </p>
        <ul>
          <li>
            <strong>Free</strong> — $0.00. No Shopify App Subscription
            charge. Up to 200 products in the Findly index and 5 metafield
            filter mappings. No trial (the plan is already free).
          </li>
          <li>
            <strong>Standard</strong> — $11.99 USD every 30 days after a
            7-day trial. Up to 1,000 products and 12 metafield filter
            mappings.
          </li>
          <li>
            <strong>Pro</strong> — $19.99 USD every 30 days after a 7-day
            trial. Up to 5,000 products and 25 metafield filter mappings.
          </li>
        </ul>
        <p>
          “Products” means products Findly has synced into its shop-scoped
          index. “Metafield filter mappings” means metafields you enable as
          storefront filters. Other filter types (price, availability, vendor,
          type, tags, options) are included on every plan, subject to the
          product cap.
        </p>
        <p>
          You can move between Free, Standard, and Pro in{" "}
          <strong>Findly → Pricing plans</strong> without reinstalling. Paid
          upgrades create or replace a Shopify charge that you must approve
          in Admin. If you decline the charge, you stay on your current
          entitled plan (typically Free if no paid subscription is active).
        </p>
        <p>
          Trials apply only when Shopify starts a paid Standard or Pro
          subscription. There is <strong>no 30-day money-back
          guarantee</strong>. Refunds, if any, are handled through Shopify’s
          billing tools and policies, not as a separate Findly cash refund.
        </p>
        <p>
          If you exceed plan limits, Findly may stop indexing additional
          products, disable extra metafield filters, or ask you to upgrade.
          Uninstalling cancels the Shopify subscription according to
          Shopify’s billing rules; we then delete shop-scoped data as
          described in the Privacy Policy.
        </p>
        <p>
          Development stores may see test charges when billing test mode is
          on. Test charges are not a production invoice.
        </p>

        <h2 id="use">4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Use Findly except on Shopify shops you are authorized to operate.
          </li>
          <li>
            Reverse engineer, scrape, or overload the app, App Proxy, or
            workers in a way that harms other merchants or our
            infrastructure.
          </li>
          <li>
            Probe or attack other shops, bypass Shopify authentication, or
            attempt to read another tenant’s data.
          </li>
          <li>
            Upload malware, illegal content, or swatch/files that you do not
            have rights to use.
          </li>
          <li>
            Use the app to collect shopper payment data, government IDs, or
            other sensitive personal data the product is not designed to
            store.
          </li>
          <li>
            Resell, white-label, or sublicense Findly as your own competing
            app without a written agreement with us.
          </li>
          <li>
            Circumvent plan limits, billing, or Theme App Extension
            installation requirements.
          </li>
          <li>
            Violate Shopify’s Acceptable Use Policy, App Store requirements,
            or applicable law (including consumer, privacy, and advertising
            rules for your storefront).
          </li>
        </ul>
        <p>
          We may suspend or terminate access, or uninstall may follow from
          Shopify, if you materially breach these rules.
        </p>

        <h2 id="content">5. Your content and Shopify data</h2>
        <p>
          You retain rights in your catalog, theme, and storefront. You grant
          us a limited license to copy and process that data solely to
          provide Findly (sync, filters, search, billing, support, and
          compliance), as described in the Privacy Policy.
        </p>
        <p>
          You represent that you have the right to grant that license and
          that your product data, metafields, and uploaded swatches do not
          infringe others’ rights.
        </p>

        <h2 id="support">6. Availability and support</h2>
        <p>
          We aim to keep Findly available but do not promise uninterrupted
          uptime. Catalog sync depends on Shopify Admin GraphQL, webhooks,
          and background workers. Theme widgets depend on your theme and on
          you adding the app blocks. The app process runs on Hostinger;
          catalog and settings live in Supabase Postgres; background jobs use
          the same Postgres database.
        </p>
        <p>
          Support is offered through <strong>Findly → Contact</strong> and by
          email at{" "}
          <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>
            {FINDLY_SUPPORT_EMAIL}
          </a>
          . We do not guarantee response times. Shopify cannot provide Findly
          product support on our behalf.
        </p>

        <h2 id="ip">7. Intellectual property</h2>
        <p>
          Findly’s name, admin UI, Theme App Extension, and hosted service
          are owned by SRH Web Agency or its licensors. Installing the app
          does not transfer ownership. Shopify trademarks belong to Shopify
          Inc.
        </p>

        <h2 id="disclaimer">8. Disclaimer of warranties</h2>
        <p>
          Findly is provided <strong>“as is”</strong> and{" "}
          <strong>“as available.”</strong> To the fullest extent permitted by
          law, we disclaim all warranties, express or implied, including
          merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>
        <p>
          We do not warrant that filters, search ranking, counts, prices, or
          availability will be error-free or match your theme’s native
          behavior in every case. You should test on a development store
          before relying on the widget in production.
        </p>

        <h2 id="liability">9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, SRH Web Agency and its
          officers, employees, and contractors will not be liable for
          indirect, incidental, special, consequential, or punitive damages,
          or for lost profits, lost sales, lost data, theme breakage, SEO
          impact, or business interruption, even if we were advised of the
          possibility.
        </p>
        <p>
          Our total liability for claims arising out of these Terms or the
          app is limited to the greater of (a) the amounts you paid us
          through Shopify Billing for Findly in the three (3) months before
          the claim, or (b) fifty US dollars (USD $50). If you only used
          Free, you paid $0 and the $50 cap still applies where enforceable.
        </p>
        <p>
          Some jurisdictions do not allow certain limitations. In those
          places, our liability is limited to the maximum extent allowed.
        </p>

        <h2 id="indemnity">10. Indemnity</h2>
        <p>
          You will defend and indemnify SRH Web Agency against claims,
          damages, and reasonable legal fees arising from your storefront
          content, your product data, your misuse of Findly, or your
          violation of these Terms or third-party rights, except to the
          extent caused by our willful misconduct.
        </p>

        <h2 id="termination">11. Suspension, uninstall, and termination</h2>
        <p>
          You may stop using Findly by uninstalling it. We may suspend or
          stop providing the service if we discontinue the app, if Shopify
          requires it, or if you breach these Terms. After uninstall or shop
          redaction, we delete shop-scoped data as described in the Privacy
          Policy. These Terms survive as needed for billed amounts, sections
          7–10, and 12–14.
        </p>

        <h2 id="changes">12. Changes</h2>
        <p>
          We may update these Terms. The effective date at the top will
          change. Continued use after the update constitutes acceptance. If
          you do not agree, uninstall the app. Material billing changes will
          be reflected in the in-app Pricing plans page and must still go
          through Shopify Billing.
        </p>

        <h2 id="general">13. General</h2>
        <p>
          These Terms are the agreement for the hosted Findly app. They do
          not create a partnership or employment relationship. If a court
          finds a clause unenforceable, the rest remains in effect. You may
          not assign these Terms without our consent; we may assign them as
          part of a sale of the app. Failure to enforce a right is not a
          waiver.
        </p>
        <p>
          Governing law is the law of the jurisdiction where SRH Web Agency
          is established, excluding conflict-of-law rules, unless a
          mandatory consumer or merchant protection law in your country says
          otherwise. Shopify’s platform terms are between you and Shopify.
        </p>

        <h2 id="contact">14. Contact</h2>
        <p>
          SRH Web Agency — Findly: Smart Filters & Search
          <br />
          Email:{" "}
          <a href={`mailto:${FINDLY_SUPPORT_EMAIL}`}>
            {FINDLY_SUPPORT_EMAIL}
          </a>
          <br />
          In-app: Findly → Contact
        </p>

      </LegalDoc>
    </PublicShell>
  );
}
