/**
 * Vercel Serverless Function — /api/odoo
 *
 * Proxies all CRM requests to Odoo's /web/dataset/call_kw endpoint.
 *
 * Authentication: Odoo API keys use HTTP Basic auth with the special
 * username "__api__" and the API key as the password:
 *   Authorization: Basic base64(__api__:<your_api_key>)
 *
 * Required Vercel Environment Variables:
 *   VITE_ODOO_URL     – https://your-instance.odoo.com  (no trailing slash)
 *   VITE_ODOO_LOGIN   – your.email@company.com  (used only as fallback if no API key)
 *   VITE_ODOO_API_KEY – API key from Odoo → Settings → Technical → API Keys
 *
 * Optional:
 *   VITE_ODOO_DB      – database name (Odoo SaaS auto-resolves from hostname)
 */

const ODOO_ENDPOINT = "/web/dataset/call_kw";

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
  const odooUrl = process.env.VITE_ODOO_URL;
  const apiKey  = process.env.VITE_ODOO_API_KEY;

  if (!odooUrl || !apiKey) {
    const missing = [!odooUrl && "VITE_ODOO_URL", !apiKey && "VITE_ODOO_API_KEY"]
      .filter(Boolean)
      .join(", ");
    console.error(`[odoo-proxy] Missing environment variables: ${missing}`);
    res.status(500).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: 500,
        message: `Server misconfiguration — set in Vercel Environment Variables: ${missing}`,
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

  // ── Forward to Odoo ─────────────────────────────────────────────────────────
  // Always targets /web/dataset/call_kw — the only endpoint this app uses.
  // Auth: Odoo API key Basic auth uses the special username "__api__"
  const targetUrl = `${odooUrl}${ODOO_ENDPOINT}`;
  const basicAuth = "Basic " + Buffer.from(`__api__:${apiKey}`).toString("base64");

  console.log(`[odoo-proxy] → POST ${targetUrl}`);

  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: bodyText,
    });

    const responseText = await upstream.text();

    // HTML response = error page (rate limit, maintenance, bad gateway from Odoo CDN)
    if (/<!DOCTYPE|<html/i.test(responseText)) {
      const titleMatch = /<title>([^<]+)<\/title>/i.exec(responseText);
      const htmlError  = titleMatch
        ? titleMatch[1].trim()
        : "Odoo returned an HTML error page";
      console.error(`[odoo-proxy] HTML response from Odoo: ${htmlError}`);
      res.status(502).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: 502, message: htmlError },
      });
      return;
    }

    // Log Odoo-level errors so they appear in Vercel function logs
    try {
      const parsed = JSON.parse(responseText);
      if (parsed?.error) {
        console.error(
          `[odoo-proxy] Odoo error: ${parsed.error.data?.message || parsed.error.message}`
        );
      }
    } catch {
      // Not JSON — pass through as-is
    }

    res
      .status(upstream.status)
      .setHeader("Content-Type", "application/json")
      .send(responseText);
  } catch (err) {
    console.error(`[odoo-proxy] Fetch failed: ${err.message}`);
    res.status(502).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: 502, message: `Proxy error: ${err.message}` },
    });
  }
}
