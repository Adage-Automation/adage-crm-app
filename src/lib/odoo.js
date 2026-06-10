/**
 * Odoo API client
 *
 * In development:  calls go to /api/odoo  → vite-odoo-proxy.js (dev server middleware)
 * In production:   calls go to /api/odoo  → Vercel serverless function (api/odoo.js)
 *
 * Both environments use the same path so no code-path differences in the app.
 */

export const ODOO_BASE = "/api/odoo";

export const fetchOdoo = async (model, method, args = [], kwargs = {}) => {
  const res = await fetch(`${ODOO_BASE}/web/dataset/call_kw`, {
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
