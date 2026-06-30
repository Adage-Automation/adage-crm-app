/**
 * Vite dev-server proxy for Odoo
 *
 * Authenticates once via /web/session/authenticate (JSON-RPC, single call),
 * caches the session cookie for the lifetime of the dev server, and forwards
 * all /api/odoo requests to Odoo with that cookie.
 *
 * Reads from .env:
 *   VITE_ODOO_URL      – https://your-instance.odoo.com
 *   VITE_ODOO_DB       – crm-adage-9
 *   VITE_ODOO_LOGIN    – your.email@company.com
 *   VITE_ODOO_API_KEY  – API key (preferred), OR
 *   VITE_ODOO_PASSWORD – account password (fallback)
 */
import { loadEnv } from "vite";

const ODOO_ENDPOINT = "/web/dataset/call_kw";

async function getSession(odooUrl, db, login, password) {
  console.log(`[odoo-proxy] Authenticating as ${login} on ${odooUrl}...`);
  const res = await fetch(`${odooUrl}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 1,
      params: { db, login, password },
    }),
  });

  if (!res.ok) {
    throw new Error(`Odoo auth HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || "Authentication failed");
  }
  if (!data.result?.uid) {
    throw new Error("Authentication failed — check VITE_ODOO_LOGIN and VITE_ODOO_PASSWORD/VITE_ODOO_API_KEY");
  }

  // Extract the session_id cookie
  const setCookieHeaders =
    res.headers.getSetCookie?.() ||
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  const cookie = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");

  console.log(`[odoo-proxy] ✓ Authenticated (uid=${data.result.uid})`);
  return cookie;
}

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
      const db      = env.VITE_ODOO_DB;
      const login   = env.VITE_ODOO_LOGIN;
      const password = env.VITE_ODOO_API_KEY || env.VITE_ODOO_PASSWORD;

      if (!odooUrl || !login || !password) {
        const missing = [
          !odooUrl   && "VITE_ODOO_URL",
          !login     && "VITE_ODOO_LOGIN",
          !password  && "VITE_ODOO_API_KEY or VITE_ODOO_PASSWORD",
        ].filter(Boolean).join(", ");
        console.warn(`\n[odoo-proxy] ⚠  Missing in .env: ${missing}\n  API calls will fail until these are set.\n`);
      }

      // Cached session cookie — lives as long as the dev server process
      let sessionCookie = null;
      let authPromise   = null; // prevent parallel auth storms

      const ensureAuth = () => {
        if (sessionCookie) return Promise.resolve(sessionCookie);
        if (authPromise)   return authPromise;
        authPromise = getSession(odooUrl, db, login, password)
          .then((cookie) => {
            sessionCookie = cookie;
            authPromise   = null;
            return cookie;
          })
          .catch((err) => {
            authPromise = null;
            throw err;
          });
        return authPromise;
      };

      server.middlewares.use("/api/odoo", async (req, res, next) => {
        if (req.method !== "POST") return next();

        try {
          const cookie = await ensureAuth();
          const targetUrl = `${odooUrl}${ODOO_ENDPOINT}`;

          const body = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          });

          let upstream = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: cookie },
            body,
          });
          let text = await upstream.text();

          // Session expired mid-flight — re-auth once and retry
          if (
            text.includes("Session Expired") ||
            text.includes("Session expired") ||
            text.includes('"session_id": false')
          ) {
            console.log("[odoo-proxy] Session expired — re-authenticating");
            sessionCookie = null;
            const freshCookie = await ensureAuth();
            upstream = await fetch(targetUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Cookie: freshCookie },
              body,
            });
            text = await upstream.text();
          }

          // Surface HTML error pages clearly
          if (/<!DOCTYPE|<html/i.test(text)) {
            const titleMatch = /<title>([^<]+)<\/title>/i.exec(text);
            const htmlError  = titleMatch ? titleMatch[1].trim() : "Odoo returned an HTML error page";
            console.error(`[odoo-proxy] HTML from Odoo: ${htmlError}`);
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
