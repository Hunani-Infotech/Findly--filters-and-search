import type { ReactNode } from "react";
import type { LinksFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import adminStyles from "./admin.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: adminStyles },
  { rel: "preconnect", href: "https://cdn.shopify.com/", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css",
  },
];

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function HydrateFallback() {
  return (
    <Document>
      <div className="findly-admin-shell" aria-busy="true" aria-live="polite">
        <div className="findly-root-skeleton">
          <div className="findly-root-skeleton__bar" />
          <div className="findly-root-skeleton__title" />
          <div className="findly-root-skeleton__card" />
          <div className="findly-root-skeleton__card" />
        </div>
      </div>
    </Document>
  );
}
