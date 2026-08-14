import type { LoaderFunctionArgs } from "react-router";

export const loader = async (_args: LoaderFunctionArgs) => {
  return new Response(JSON.stringify({ ok: true, service: "findly-smart-filters-search" }), {
    headers: { "Content-Type": "application/json" },
  });
};
