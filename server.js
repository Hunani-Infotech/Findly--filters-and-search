import { createRequestHandler } from "@react-router/express";
import express from "express";

const app = express();

app.use(express.static("build/client"));

app.all(
  "*",
  createRequestHandler({
    build: await import("./build/server/index.js"),
  }),
);

app.listen(process.env.PORT ?? 3000);
