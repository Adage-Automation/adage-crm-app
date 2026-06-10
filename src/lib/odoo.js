export const ODOO_BASE = import.meta.env.DEV
  ? "/api/odoo"
  : (import.meta.env.VITE_ODOO_URL || "https://crm-adage-5.odoo.com");

export const API_KEY = import.meta.env.VITE_ODOO_API_KEY || "";

export const fetchOdoo = async (model, method, args = [], kwargs = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (!import.meta.env.DEV && API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }
  const res = await fetch(`${ODOO_BASE}/web/dataset/call_kw`, {
    method: "POST",
    headers,
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
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
};
