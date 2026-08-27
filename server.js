import { createRequestHandler } from "@react-router/express";
import express from "express";

const app = express();

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
