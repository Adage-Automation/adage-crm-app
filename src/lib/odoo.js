/**
 * Odoo API client
 *
 * All calls go to /api/odoo — the proxy handles authentication.
 * Dev  → vite-odoo-proxy.js (Vite middleware)
 * Prod → api/odoo.js (Vercel serverless function)
 */

export const fetchOdoo = async (model, method, args = [], kwargs = {}) => {
  const res = await fetch("/api/odoo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        model,
        method,
        args,
        kwargs: { context: { lang: "en_US" }, ...kwargs },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
};
