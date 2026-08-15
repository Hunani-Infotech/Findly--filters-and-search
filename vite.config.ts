import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function normalizeUrl(value: string | undefined) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

function isPlaceholderAppUrl(value: string | undefined) {
  if (!value) return true;
  try {
    const hostname = new URL(normalizeUrl(value)).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

// Shopify CLI passes the Cloudflare tunnel as HOST. A .env value of
// https://localhost must not win, or embedded auth stays on "Handling response".
if (process.env.HOST && isPlaceholderAppUrl(process.env.SHOPIFY_APP_URL)) {
  process.env.SHOPIFY_APP_URL = normalizeUrl(process.env.HOST);
  delete process.env.HOST;
} else if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [host, "localhost", "127.0.0.1"],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
  ssr: {
    // Chalk uses package imports (#ansi-styles) that Vite should not bundle.
    external: ["chalk"],
  },
}) satisfies UserConfig;
