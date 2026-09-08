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
import adminStyles from "./styles/admin.css?url";
import { PublicMessage, PublicPending } from "./components/public-shell";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: adminStyles },
  { rel: "preconnect", href: "https://cdn.shopify.com/", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css",
  },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,650&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap",
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
            <div className="findly-root-skeleton-bar" />
            <div className="findly-root-skeleton-title" />
            <div className="findly-root-skeleton-card" />
            <div className="findly-root-skeleton-card" />
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
      {notFound ? (
        <PublicMessage title="Page not found" actionLabel="Go back" minimal>
          That address isn’t a Findly page. Head home, or open the app from
          Shopify Admin.
        </PublicMessage>
      ) : (
        <PublicMessage title="Server under maintenance">
          Findly is temporarily unavailable while we perform server maintenance.
          Please try again in a few minutes, or open the app from Shopify Admin.
        </PublicMessage>
      )}
    </Document>
  );
}
