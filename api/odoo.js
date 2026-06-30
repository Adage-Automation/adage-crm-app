/**
 * Vercel Serverless Function — /api/odoo
 *
 * Authenticates to Odoo via /web/session/authenticate (one JSON-RPC call),
 * caches the session cookie in module scope (survives warm re-invocations),
 * and forwards all requests to /web/dataset/call_kw with that cookie.
 *
 * Required Vercel Environment Variables:
 *   VITE_ODOO_URL      – https://your-instance.odoo.com  (no trailing slash)
 *   VITE_ODOO_DB       – crm-adage-9
 *   VITE_ODOO_LOGIN    – your.email@company.com
 *   VITE_ODOO_API_KEY  – API key (preferred), OR
 *   VITE_ODOO_PASSWORD – account password (fallback)
 */

const ODOO_ENDPOINT = "/web/dataset/call_kw";

// Module-level cache — persists across warm Vercel function re-invocations
let cachedCookie = null;
let authInFlight = null;

async function authenticate(odooUrl, db, login, password) {
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

  const text = await res.text();

  // Odoo sometimes returns HTML on rate-limit / maintenance
  if (/<!DOCTYPE|<html/i.test(text)) {
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(text);
    throw new Error(titleMatch ? titleMatch[1].trim() : "Odoo returned HTML during auth");
  }

  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Odoo auth returned non-JSON: ${text.slice(0, 100)}`);
  }

  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || "Authentication failed");
  }
  if (!data.result?.uid) {
    throw new Error("Authentication failed — check VITE_ODOO_LOGIN and VITE_ODOO_PASSWORD/VITE_ODOO_API_KEY");
  }

  const setCookieHeaders =
    res.headers.getSetCookie?.() ||
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  const cookie = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");

  console.log(`[odoo-proxy] Authenticated (uid=${data.result.uid})`);
  return cookie;
}

function ensureAuth(odooUrl, db, login, password) {
  if (cachedCookie) return Promise.resolve(cachedCookie);
  if (authInFlight) return authInFlight;

  authInFlight = authenticate(odooUrl, db, login, password)
    .then((cookie) => {
      cachedCookie = cookie;
      authInFlight = null;
      return cookie;
    })
    .catch((err) => {
      authInFlight = null;
      throw err;
    });

  return authInFlight;
}

export default async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST")    { res.status(405).json({ error: "Method Not Allowed" }); return; }

  // ── Config ──────────────────────────────────────────────────────────────────
  const odooUrl  = process.env.VITE_ODOO_URL;
  const db       = process.env.VITE_ODOO_DB;
  const login    = process.env.VITE_ODOO_LOGIN;
  const password = process.env.VITE_ODOO_API_KEY || process.env.VITE_ODOO_PASSWORD;

  if (!odooUrl || !login || !password) {
    const missing = [
      !odooUrl   && "VITE_ODOO_URL",
      !login     && "VITE_ODOO_LOGIN",
      !password  && "VITE_ODOO_API_KEY or VITE_ODOO_PASSWORD",
    ].filter(Boolean).join(", ");
    console.error(`[odoo-proxy] Missing env vars: ${missing}`);
    res.status(500).json({
      jsonrpc: "2.0", id: null,
      error: { code: 500, message: `Server misconfiguration — set in Vercel: ${missing}` },
    });
    return;
  }

  // ── Read body ───────────────────────────────────────────────────────────────
  let bodyText;
  if (typeof req.body === "string") {
    bodyText = req.body;
  } else if (req.body && typeof req.body === "object") {
    bodyText = JSON.stringify(req.body);
  } else {
    bodyText = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  const targetUrl = `${odooUrl}${ODOO_ENDPOINT}`;

  const forward = async (cookie) =>
    fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: bodyText,
    });

  console.log(`[odoo-proxy] → POST ${targetUrl}`);

  try {
    const cookie = await ensureAuth(odooUrl, db, login, password);
    let upstream = await forward(cookie);
    let text     = await upstream.text();

    // Session expired — clear cache, re-auth once, retry
    if (
      text.includes("Session Expired") ||
      text.includes("Session expired") ||
      text.includes('"session_id": false')
    ) {
      console.log("[odoo-proxy] Session expired — re-authenticating");
      cachedCookie = null;
      const freshCookie = await ensureAuth(odooUrl, db, login, password);
      upstream = await forward(freshCookie);
      text     = await upstream.text();
    }

    // HTML = error page
    if (/<!DOCTYPE|<html/i.test(text)) {
      const titleMatch = /<title>([^<]+)<\/title>/i.exec(text);
      const htmlError  = titleMatch ? titleMatch[1].trim() : "Odoo returned an HTML error page";
      console.error(`[odoo-proxy] HTML from Odoo: ${htmlError}`);
      res.status(502).json({ jsonrpc: "2.0", id: null, error: { code: 502, message: htmlError } });
      return;
    }

    // Log Odoo-level errors
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) {
        console.error(`[odoo-proxy] Odoo error: ${parsed.error.data?.message || parsed.error.message}`);
      }
    } catch { /* non-JSON, pass through */ }

    res.status(upstream.status).setHeader("Content-Type", "application/json").send(text);

  } catch (err) {
    console.error(`[odoo-proxy] ${err.message}`);
    cachedCookie = null;
    res.status(502).json({
      jsonrpc: "2.0", id: null,
      error: { code: 502, message: err.message },
    });
  }
}
