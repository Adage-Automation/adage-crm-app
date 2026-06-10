/**
 * Vite dev-server proxy for Odoo
 *
 * Mirrors api/odoo.js exactly so local dev and Vercel production behave
 * identically. Uses HTTP Basic auth (login:apikey) — no separate auth calls.
 *
 * Reads from .env:
 *   VITE_ODOO_URL     – https://your-instance.odoo.com
 *   VITE_ODOO_LOGIN   – your.email@company.com
 *   VITE_ODOO_API_KEY – your odoo api key
 */
import { loadEnv } from "vite";

export function odooProxyPlugin() {
  return {
    name: "odoo-proxy",
    configureServer(server) {
      const env = loadEnv(
        server.config.mode,
        server.config.envDir || process.cwd(),
        "" // load ALL env vars, not just VITE_ prefixed
      );

      const odooUrl = env.VITE_ODOO_URL;
      const login   = env.VITE_ODOO_LOGIN;
      const apiKey  = env.VITE_ODOO_API_KEY;

      if (!odooUrl || !login || !apiKey) {
        const missing = [
          !odooUrl  && "VITE_ODOO_URL",
          !login    && "VITE_ODOO_LOGIN",
          !apiKey   && "VITE_ODOO_API_KEY",
        ].filter(Boolean).join(", ");
        console.warn(`\n[odoo-proxy] ⚠  Missing in .env: ${missing}\n  API calls will fail until these are set.\n`);
      }

      const basicAuth =
        login && apiKey
          ? "Basic " + Buffer.from(`${login}:${apiKey}`).toString("base64")
          : null;

      server.middlewares.use("/api/odoo", async (req, res, next) => {
        if (req.method !== "POST") return next();

        try {
          const odooPath  = req.url || "/web/dataset/call_kw";
          const targetUrl = `${odooUrl}${odooPath}`;

          const body = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          });

          const headers = { "Content-Type": "application/json" };
          if (basicAuth) headers.Authorization = basicAuth;

          const upstream = await fetch(targetUrl, { method: "POST", headers, body });
          const text     = await upstream.text();

          // Surface HTML errors clearly
          if (/<!DOCTYPE|<html/i.test(text)) {
            const titleMatch = /<title>([^<]+)<\/title>/i.exec(text);
            const htmlError  = titleMatch ? titleMatch[1].trim() : "Odoo returned an HTML error page";
            console.error(`[odoo-proxy] Odoo returned HTML — ${htmlError}`);
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: 502, message: htmlError } }));
            return;
          }

          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json");
          res.end(text);
        } catch (err) {
          console.error(`[odoo-proxy] Error: ${err.message}`);
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: 502, message: err.message } }));
        }
      });
    },
  };
}
