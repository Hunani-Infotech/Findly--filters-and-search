import type { ReactNode } from "react";
import type { LinksFunction } from "react-router";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import adminStyles from "./admin.css?url";
import { PublicMessage, PublicPending } from "./components/public-shell";

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
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isAdmin = path.startsWith("/app");

  return (
    <Document>
      {isAdmin ? (
        <div className="findly-admin-shell" aria-busy="true" aria-live="polite">
          <div className="findly-root-skeleton">
            <div className="findly-root-skeleton__bar" />
            <div className="findly-root-skeleton__title" />
            <div className="findly-root-skeleton__card" />
            <div className="findly-root-skeleton__card" />
          </div>
        </div>
      ) : (
        <PublicPending />
      )}
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <Document>
      <PublicMessage title={notFound ? "Page not found" : "Something went wrong"}>
        {notFound
          ? "That URL is not a Findly page. Use the homepage to open the app in Shopify Admin."
          : "The public page failed to load. Try again, or open Findly from Shopify Admin."}
      </PublicMessage>
    </Document>
  );
}
