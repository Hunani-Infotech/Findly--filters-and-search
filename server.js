import { createRequestHandler } from "@react-router/express";
import express from "express";

// `npm start` is the production entry. Unset NODE_ENV must not look like dev
// (HMAC bypass, detailed /health, debug Shopify logs).
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "production";
}

const app = express();
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Hashed Vite assets never change; cache them for a year. Other files stay short-lived.
app.use(
  "/assets",
  express.static("build/client/assets", {
    maxAge: "1y",
    immutable: true,
    index: false,
  }),
);
app.use(express.static("build/client", { index: false }));

app.all(
  "*",
  createRequestHandler({
    build: await import("./build/server/index.js"),
  }),
);

app.listen(process.env.PORT ?? 3000);
