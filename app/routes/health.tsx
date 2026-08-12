export const loader = async () => {
  return new Response(JSON.stringify({ ok: true, service: "findly-smart-filters-search" }), {
    headers: { "Content-Type": "application/json" },
  });
};
