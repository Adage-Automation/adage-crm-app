/**
 * Vercel Serverless Function — /api/odoo
 *
 * Server-side proxy to Odoo. Uses HTTP Basic auth (login:apikey) so zero
 * separate auth calls are made. The API key never reaches the browser.
 *
 * Set these in Vercel → Project → Settings → Environment Variables:
 *
 *   VITE_ODOO_URL     – https://your-instance.odoo.com  (no trailing slash)
 *   VITE_ODOO_LOGIN   – your.email@company.com
 *   VITE_ODOO_API_KEY – api key from Odoo → Settings → Technical → API Keys
 *
 * Optional:
 *   VITE_ODOO_DB      – database name (Odoo SaaS resolves this from the hostname
 *                       automatically, so usually not needed)
 */

export default async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // ── Read env vars ───────────────────────────────────────────────────────────
  const odooUrl  = process.env.VITE_ODOO_URL;
  const login    = process.env.VITE_ODOO_LOGIN;
  const apiKey   = process.env.VITE_ODOO_API_KEY;

  // Validation — fail fast with a clear message
  if (!odooUrl || !login || !apiKey) {
    const missing = [
      !odooUrl  && "VITE_ODOO_URL",
      !login    && "VITE_ODOO_LOGIN",
      !apiKey   && "VITE_ODOO_API_KEY",
    ].filter(Boolean).join(", ");

    console.error(`[odoo-proxy] Missing environment variables: ${missing}`);
    res.status(500).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: 500,
        message: `Server misconfiguration — set these in Vercel Environment Variables: ${missing}`,
      },
    });
    return;
  }

  // ── Read request body ───────────────────────────────────────────────────────
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

  // ── Build target URL ────────────────────────────────────────────────────────
  // req.url is the path after /api/odoo, e.g. /web/dataset/call_kw
  const odooPath  = req.url?.replace(/^\/api\/odoo/, "") || "/web/dataset/call_kw";
  const targetUrl = `${odooUrl}${odooPath}`;

  console.log(`[odoo-proxy] → POST ${targetUrl}`);

  // ── Forward request ─────────────────────────────────────────────────────────
  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // HTTP Basic: Odoo accepts  login:apikey  base64-encoded
        Authorization: "Basic " + Buffer.from(`${login}:${apiKey}`).toString("base64"),
      },
      body: bodyText,
    });

    const responseText = await upstream.text();

    // Detect HTML error pages (rate limit, 502 from Odoo CDN, maintenance, etc.)
    if (/<!DOCTYPE|<html/i.test(responseText)) {
      const titleMatch = /<title>([^<]+)<\/title>/i.exec(responseText);
      const htmlError  = titleMatch ? titleMatch[1].trim() : "Odoo returned an HTML error page";
      console.error(`[odoo-proxy] Odoo returned HTML — ${htmlError}`);
      res.status(502).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: 502, message: htmlError },
      });
      return;
    }

    // Log Odoo-level errors for Vercel log visibility
    try {
      const parsed = JSON.parse(responseText);
      if (parsed?.error) {
        console.error(`[odoo-proxy] Odoo error: ${parsed.error.data?.message || parsed.error.message}`);
      }
    } catch {
      // Non-JSON — pass through as-is
    }

    res.status(upstream.status).setHeader("Content-Type", "application/json").send(responseText);
  } catch (err) {
    console.error(`[odoo-proxy] Fetch failed: ${err.message}`);
    res.status(502).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: 502, message: `Proxy error: ${err.message}` },
    });
  }
}
