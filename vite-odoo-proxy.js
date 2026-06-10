import { loadEnv } from "vite";

let sessionCookie = null;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlRpcValue(value) {
  if (typeof value === "string") {
    return `<value><string>${escapeXml(value)}</string></value>`;
  }
  if (typeof value === "number") {
    return `<value><int>${value}</int></value>`;
  }
  if (typeof value === "boolean") {
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  }
  if (Array.isArray(value)) {
    return `<value><array><data>${value.map(xmlRpcValue).join("")}</data></array></value>`;
  }
  if (value && typeof value === "object") {
    const members = Object.entries(value)
      .map(
        ([key, val]) =>
          `<member><name>${escapeXml(key)}</name>${xmlRpcValue(val)}</member>`
      )
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><nil/></value>`;
}

function xmlRpcRequest(method, params) {
  const encodedParams = params
    .map((param) => `<param>${xmlRpcValue(param)}</param>`)
    .join("");

  return `<?xml version="1.0"?>\n<methodCall><methodName>${escapeXml(method)}</methodName><params>${encodedParams}</params></methodCall>`;
}

function parseXmlRpcResponse(text) {
  const faultMatch = /<fault>[\s\S]*?<name>\s*faultString\s*<\/name>[\s\S]*?<string>([^<]+)<\/string>/i.exec(text);
  if (faultMatch) {
    throw new Error(faultMatch[1].trim());
  }

  const intMatch = /<value>\s*<(?:int|i4)>([\s\S]*?)<\/(?:int|i4)>\s*<\/value>/i.exec(text);
  if (intMatch) {
    return Number(intMatch[1].trim());
  }

  const boolMatch = /<value>\s*<boolean>\s*([01])\s*<\/boolean>\s*<\/value>/i.exec(text);
  if (boolMatch) {
    return boolMatch[1] === "1";
  }

  const stringMatch = /<value>\s*<string>([\s\S]*?)<\/string>\s*<\/value>/i.exec(text);
  if (stringMatch) {
    return stringMatch[1];
  }

  if (/<!DOCTYPE|<html/i.test(text)) {
    throw new Error(`Odoo XML-RPC returned HTML instead of XML: ${text.slice(0, 200).replace(/\s+/g, " ")}...`);
  }

  throw new Error(`Odoo XML-RPC authentication returned an unexpected response: ${text.slice(0, 300).replace(/\s+/g, " ")}`);
}

async function xmlRpcAuthenticate(url, db, login, password) {
  const payload = xmlRpcRequest("authenticate", [db, login, password, {}]);
  const res = await fetch(`${url}/xmlrpc/2/common`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: payload,
  });
  const text = await res.text();
  return parseXmlRpcResponse(text);
}

async function odooAuthenticate(env) {
  const url = env.VITE_ODOO_URL || env.ODOO_URL || "https://crm-adage-5.odoo.com";
  const db = env.VITE_ODOO_DB || env.ODOO_DB || "crm-adage-5";
  const login = env.VITE_ODOO_LOGIN || env.ODOO_USER;
  const password = env.VITE_ODOO_PASSWORD || env.ODOO_PASS || env.VITE_ODOO_API_KEY || env.ODOO_API_KEY;

  if (!login || !password) {
    throw new Error("Set VITE_ODOO_LOGIN/ODOO_USER and one of VITE_ODOO_PASSWORD/ODOO_PASS or VITE_ODOO_API_KEY/ODOO_API_KEY in .env");
  }

  const uid = await xmlRpcAuthenticate(url, db, login, password);
  if (!uid) {
    throw new Error("Odoo authentication failed: invalid login, database, or API key/password");
  }

  const res = await fetch(`${url}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { db, login, password },
      id: 1,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || "Odoo authentication failed");
  }
  if (!data.result?.uid) {
    throw new Error("Odoo authentication failed: invalid login, database, or API key/password");
  }

  const setCookie = res.headers.getSetCookie?.() || [];
  sessionCookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return data.result;
}

export function odooProxyPlugin() {
  return {
    name: "odoo-proxy",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir || process.cwd(), "");

      server.middlewares.use("/api/odoo", async (req, res, next) => {
        if (req.method !== "POST") return next();

        try {
          if (!sessionCookie) await odooAuthenticate(env);

          const url = env.VITE_ODOO_URL || env.ODOO_URL || "https://crm-adage-5.odoo.com";
          const targetPath = req.url?.replace(/^\/api\/odoo/, "") || "/web/dataset/call_kw";
          const body = await new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => resolve(Buffer.concat(chunks)));
            req.on("error", reject);
          });

          let upstream = await fetch(`${url}${targetPath}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: sessionCookie,
            },
            body,
          });

          let text = await upstream.text();
          if (text.includes("Session Expired") || text.includes("Session expired")) {
            sessionCookie = null;
            await odooAuthenticate(env);
            upstream = await fetch(`${url}${targetPath}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: sessionCookie,
              },
              body,
            });
            text = await upstream.text();
          }

          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json");
          res.end(text);
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: 502, message: err.message },
            })
          );
        }
      });
    },
  };
}
