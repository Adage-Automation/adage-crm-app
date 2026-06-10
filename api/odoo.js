/**
 * Vercel Serverless Function: /api/odoo
 *
 * Acts as a server-side proxy to the Odoo instance, handling:
 *   - Authentication via XML-RPC to get a session cookie
 *   - Forwarding JSON-RPC requests to Odoo with the session cookie
 *   - Session expiry detection and automatic re-authentication
 *
 * Required environment variables (set in Vercel project settings):
 *   VITE_ODOO_URL    – e.g. https://crm-adage-5.odoo.com
 *   VITE_ODOO_DB     – e.g. crm-adage-5
 *   VITE_ODOO_LOGIN  – your Odoo login email
 *   VITE_ODOO_API_KEY – your Odoo API key (used as password)
 */

// ── XML-RPC helpers ──────────────────────────────────────────────────────────

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlRpcValue(value) {
  if (typeof value === "string")
    return `<value><string>${escapeXml(value)}</string></value>`;
  if (typeof value === "number")
    return `<value><int>${value}</int></value>`;
  if (typeof value === "boolean")
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  if (Array.isArray(value))
    return `<value><array><data>${value.map(xmlRpcValue).join("")}</data></array></value>`;
  if (value && typeof value === "object") {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${escapeXml(k)}</name>${xmlRpcValue(v)}</member>`)
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><nil/></value>`;
}

function xmlRpcRequest(method, params) {
  const encodedParams = params
    .map((p) => `<param>${xmlRpcValue(p)}</param>`)
    .join("");
  return `<?xml version="1.0"?>\n<methodCall><methodName>${escapeXml(method)}</methodName><params>${encodedParams}</params></methodCall>`;
}

function parseXmlRpcResponse(text) {
  const faultMatch =
    /<fault>[\s\S]*?<name>\s*faultString\s*<\/name>[\s\S]*?<string>([^<]+)<\/string>/i.exec(text);
  if (faultMatch) throw new Error(faultMatch[1].trim());

  const intMatch =
    /<value>\s*<(?:int|i4)>([\s\S]*?)<\/(?:int|i4)>\s*<\/value>/i.exec(text);
  if (intMatch) return Number(intMatch[1].trim());

  const boolMatch =
    /<value>\s*<boolean>\s*([01])\s*<\/boolean>\s*<\/value>/i.exec(text);
  if (boolMatch) return boolMatch[1] === "1";

  if (/<!DOCTYPE|<html/i.test(text))
    throw new Error(
      `Odoo returned HTML instead of XML: ${text.slice(0, 200).replace(/\s+/g, " ")}...`
    );

  throw new Error(
    `Unexpected XML-RPC response: ${text.slice(0, 300).replace(/\s+/g, " ")}`
  );
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function authenticate(url, db, login, password) {
  // Step 1: XML-RPC uid check
  const xmlPayload = xmlRpcRequest("authenticate", [db, login, password, {}]);
  const xmlRes = await fetch(`${url}/xmlrpc/2/common`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xmlPayload,
  });
  const xmlText = await xmlRes.text();
  const uid = parseXmlRpcResponse(xmlText);
  if (!uid) throw new Error("Odoo XML-RPC authentication failed — check credentials");

  // Step 2: JSON-RPC session (gets us a cookie)
  const sessionRes = await fetch(`${url}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { db, login, password },
      id: 1,
    }),
  });
  const sessionData = await sessionRes.json();
  if (sessionData.error)
    throw new Error(
      sessionData.error.data?.message ||
        sessionData.error.message ||
        "Odoo session authentication failed"
    );
  if (!sessionData.result?.uid)
    throw new Error("Odoo authentication failed — invalid credentials or database");

  const setCookieHeaders =
    sessionRes.headers.getSetCookie?.() ||
    (sessionRes.headers.get("set-cookie")
      ? [sessionRes.headers.get("set-cookie")]
      : []);

  const cookie = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");
  console.log(`[odoo-proxy] Authenticated as uid=${sessionData.result.uid}`);
  return cookie;
}

// ── Serverless handler ───────────────────────────────────────────────────────

// Module-level cache: survives warm re-invocations of the same function instance
let cachedCookie = null;

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const url =
    process.env.VITE_ODOO_URL ||
    process.env.ODOO_URL ||
    "https://crm-adage-5.odoo.com";
  const db =
    process.env.VITE_ODOO_DB || process.env.ODOO_DB || "crm-adage-5";
  const login =
    process.env.VITE_ODOO_LOGIN || process.env.ODOO_USER;
  const password =
    process.env.VITE_ODOO_PASSWORD ||
    process.env.ODOO_PASS ||
    process.env.VITE_ODOO_API_KEY ||
    process.env.ODOO_API_KEY;

  if (!login || !password) {
    console.error("[odoo-proxy] Missing credentials in environment variables");
    res.status(500).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: 500,
        message:
          "Server misconfiguration: VITE_ODOO_LOGIN and VITE_ODOO_API_KEY must be set in Vercel environment variables",
      },
    });
    return;
  }

  // Reconstruct the Odoo endpoint path from the incoming URL
  // Vercel routes /api/odoo/* to this function; the remainder is the Odoo path
  const odooPath =
    req.url?.replace(/^\/api\/odoo/, "") || "/web/dataset/call_kw";

  // Read the request body (Vercel provides it as a parsed object or raw string)
  let body;
  if (typeof req.body === "string") {
    body = req.body;
  } else if (req.body && typeof req.body === "object") {
    body = JSON.stringify(req.body);
  } else {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }

  const forwardRequest = async (cookie) => {
    const upstream = await fetch(`${url}${odooPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body,
    });
    const text = await upstream.text();
    return { status: upstream.status, text };
  };

  try {
    // Authenticate if no cached session
    if (!cachedCookie) {
      cachedCookie = await authenticate(url, db, login, password);
    }

    let { status, text } = await forwardRequest(cachedCookie);

    // Detect expired session and retry once
    if (
      text.includes("Session Expired") ||
      text.includes("Session expired") ||
      text.includes('"type": "ir.actions.act_url"')
    ) {
      console.log("[odoo-proxy] Session expired — re-authenticating");
      cachedCookie = null;
      cachedCookie = await authenticate(url, db, login, password);
      ({ status, text } = await forwardRequest(cachedCookie));
    }

    res.status(status).setHeader("Content-Type", "application/json").send(text);
  } catch (err) {
    console.error("[odoo-proxy] Error:", err.message);
    cachedCookie = null; // clear cache so next request retries auth
    res.status(502).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: 502, message: err.message },
    });
  }
}
