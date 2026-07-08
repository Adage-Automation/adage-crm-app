// vite.config.js
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "file:///D:/Projects/CRM/adage-crm-app/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Projects/CRM/adage-crm-app/node_modules/@vitejs/plugin-react/dist/index.js";

// vite-odoo-proxy.js
import { loadEnv } from "file:///D:/Projects/CRM/adage-crm-app/node_modules/vite/dist/node/index.js";
var ODOO_ENDPOINT = "/web/dataset/call_kw";
async function getSession(odooUrl, db, login, password) {
  console.log(`[odoo-proxy] Authenticating as ${login} on ${odooUrl}...`);
  const res = await fetch(`${odooUrl}/web/session/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: 1,
      params: { db, login, password }
    })
  });
  if (!res.ok) {
    throw new Error(`Odoo auth HTTP ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || "Authentication failed");
  }
  if (!data.result?.uid) {
    throw new Error("Authentication failed \u2014 check VITE_ODOO_LOGIN and VITE_ODOO_PASSWORD/VITE_ODOO_API_KEY");
  }
  const setCookieHeaders = res.headers.getSetCookie?.() || (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  const cookie = setCookieHeaders.map((c) => c.split(";")[0]).join("; ");
  console.log(`[odoo-proxy] \u2713 Authenticated (uid=${data.result.uid})`);
  return cookie;
}
function odooProxyPlugin() {
  return {
    name: "odoo-proxy",
    configureServer(server) {
      const env = loadEnv(
        server.config.mode,
        server.config.envDir || process.cwd(),
        ""
        // load ALL env vars, not just VITE_ prefixed
      );
      const odooUrl = env.VITE_ODOO_URL;
      const db = env.VITE_ODOO_DB;
      const login = env.VITE_ODOO_LOGIN;
      const password = env.VITE_ODOO_API_KEY || env.VITE_ODOO_PASSWORD;
      if (!odooUrl || !login || !password) {
        const missing = [
          !odooUrl && "VITE_ODOO_URL",
          !login && "VITE_ODOO_LOGIN",
          !password && "VITE_ODOO_API_KEY or VITE_ODOO_PASSWORD"
        ].filter(Boolean).join(", ");
        console.warn(`
[odoo-proxy] \u26A0  Missing in .env: ${missing}
  API calls will fail until these are set.
`);
      }
      let sessionCookie = null;
      let authPromise = null;
      const ensureAuth = () => {
        if (sessionCookie) return Promise.resolve(sessionCookie);
        if (authPromise) return authPromise;
        authPromise = getSession(odooUrl, db, login, password).then((cookie) => {
          sessionCookie = cookie;
          authPromise = null;
          return cookie;
        }).catch((err) => {
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
            body
          });
          let text = await upstream.text();
          if (text.includes("Session Expired") || text.includes("Session expired") || text.includes('"session_id": false')) {
            console.log("[odoo-proxy] Session expired \u2014 re-authenticating");
            sessionCookie = null;
            const freshCookie = await ensureAuth();
            upstream = await fetch(targetUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Cookie: freshCookie },
              body
            });
            text = await upstream.text();
          }
          if (/<!DOCTYPE|<html/i.test(text)) {
            const titleMatch = /<title>([^<]+)<\/title>/i.exec(text);
            const htmlError = titleMatch ? titleMatch[1].trim() : "Odoo returned an HTML error page";
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
    }
  };
}

// vite.config.js
var __vite_injected_original_import_meta_url = "file:///D:/Projects/CRM/adage-crm-app/vite.config.js";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var vite_config_default = defineConfig(({ command }) => {
  const isDev = command === "serve";
  return {
    // Only load the dev proxy plugin in local dev — not during Vercel build
    plugins: [react(), ...isDev ? [odooProxyPlugin()] : []],
    resolve: {
      alias: {
        // Removed broken @dashboard alias that pointed outside the project
        "@": path.resolve(__dirname, "src")
      }
    },
    server: {
      port: 5173
    },
    build: {
      // Produce source maps so Vercel logs show real file/line numbers on errors
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split vendor chunk for better caching
          manualChunks: {
            react: ["react", "react-dom"]
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAidml0ZS1vZG9vLXByb3h5LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcQ1JNXFxcXGFkYWdlLWNybS1hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFByb2plY3RzXFxcXENSTVxcXFxhZGFnZS1jcm0tYXBwXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Qcm9qZWN0cy9DUk0vYWRhZ2UtY3JtLWFwcC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwidXJsXCI7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgb2Rvb1Byb3h5UGx1Z2luIH0gZnJvbSBcIi4vdml0ZS1vZG9vLXByb3h5LmpzXCI7XHJcblxyXG5jb25zdCBfX2Rpcm5hbWUgPSBwYXRoLmRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBjb21tYW5kIH0pID0+IHtcclxuICBjb25zdCBpc0RldiA9IGNvbW1hbmQgPT09IFwic2VydmVcIjtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIC8vIE9ubHkgbG9hZCB0aGUgZGV2IHByb3h5IHBsdWdpbiBpbiBsb2NhbCBkZXYgXHUyMDE0IG5vdCBkdXJpbmcgVmVyY2VsIGJ1aWxkXHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgLi4uKGlzRGV2ID8gW29kb29Qcm94eVBsdWdpbigpXSA6IFtdKV0sXHJcblxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgIC8vIFJlbW92ZWQgYnJva2VuIEBkYXNoYm9hcmQgYWxpYXMgdGhhdCBwb2ludGVkIG91dHNpZGUgdGhlIHByb2plY3RcclxuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJzcmNcIiksXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG5cclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBwb3J0OiA1MTczLFxyXG4gICAgfSxcclxuXHJcbiAgICBidWlsZDoge1xyXG4gICAgICAvLyBQcm9kdWNlIHNvdXJjZSBtYXBzIHNvIFZlcmNlbCBsb2dzIHNob3cgcmVhbCBmaWxlL2xpbmUgbnVtYmVycyBvbiBlcnJvcnNcclxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICAgIG91dHB1dDoge1xyXG4gICAgICAgICAgLy8gU3BsaXQgdmVuZG9yIGNodW5rIGZvciBiZXR0ZXIgY2FjaGluZ1xyXG4gICAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAgIHJlYWN0OiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiXSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRDpcXFxcUHJvamVjdHNcXFxcQ1JNXFxcXGFkYWdlLWNybS1hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFByb2plY3RzXFxcXENSTVxcXFxhZGFnZS1jcm0tYXBwXFxcXHZpdGUtb2Rvby1wcm94eS5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUHJvamVjdHMvQ1JNL2FkYWdlLWNybS1hcHAvdml0ZS1vZG9vLXByb3h5LmpzXCI7LyoqXHJcbiAqIFZpdGUgZGV2LXNlcnZlciBwcm94eSBmb3IgT2Rvb1xyXG4gKlxyXG4gKiBBdXRoZW50aWNhdGVzIG9uY2UgdmlhIC93ZWIvc2Vzc2lvbi9hdXRoZW50aWNhdGUgKEpTT04tUlBDLCBzaW5nbGUgY2FsbCksXHJcbiAqIGNhY2hlcyB0aGUgc2Vzc2lvbiBjb29raWUgZm9yIHRoZSBsaWZldGltZSBvZiB0aGUgZGV2IHNlcnZlciwgYW5kIGZvcndhcmRzXHJcbiAqIGFsbCAvYXBpL29kb28gcmVxdWVzdHMgdG8gT2RvbyB3aXRoIHRoYXQgY29va2llLlxyXG4gKlxyXG4gKiBSZWFkcyBmcm9tIC5lbnY6XHJcbiAqICAgVklURV9PRE9PX1VSTCAgICAgIFx1MjAxMyBodHRwczovL3lvdXItaW5zdGFuY2Uub2Rvby5jb21cclxuICogICBWSVRFX09ET09fREIgICAgICAgXHUyMDEzIGNybS1hZGFnZS05XHJcbiAqICAgVklURV9PRE9PX0xPR0lOICAgIFx1MjAxMyB5b3VyLmVtYWlsQGNvbXBhbnkuY29tXHJcbiAqICAgVklURV9PRE9PX0FQSV9LRVkgIFx1MjAxMyBBUEkga2V5IChwcmVmZXJyZWQpLCBPUlxyXG4gKiAgIFZJVEVfT0RPT19QQVNTV09SRCBcdTIwMTMgYWNjb3VudCBwYXNzd29yZCAoZmFsbGJhY2spXHJcbiAqL1xyXG5pbXBvcnQgeyBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcclxuXHJcbmNvbnN0IE9ET09fRU5EUE9JTlQgPSBcIi93ZWIvZGF0YXNldC9jYWxsX2t3XCI7XHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRTZXNzaW9uKG9kb29VcmwsIGRiLCBsb2dpbiwgcGFzc3dvcmQpIHtcclxuICBjb25zb2xlLmxvZyhgW29kb28tcHJveHldIEF1dGhlbnRpY2F0aW5nIGFzICR7bG9naW59IG9uICR7b2Rvb1VybH0uLi5gKTtcclxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtvZG9vVXJsfS93ZWIvc2Vzc2lvbi9hdXRoZW50aWNhdGVgLCB7XHJcbiAgICBtZXRob2Q6IFwiUE9TVFwiLFxyXG4gICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxyXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICBqc29ucnBjOiBcIjIuMFwiLFxyXG4gICAgICBtZXRob2Q6IFwiY2FsbFwiLFxyXG4gICAgICBpZDogMSxcclxuICAgICAgcGFyYW1zOiB7IGRiLCBsb2dpbiwgcGFzc3dvcmQgfSxcclxuICAgIH0pLFxyXG4gIH0pO1xyXG5cclxuICBpZiAoIXJlcy5vaykge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBPZG9vIGF1dGggSFRUUCAke3Jlcy5zdGF0dXN9OiAke3Jlcy5zdGF0dXNUZXh0fWApO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCk7XHJcbiAgaWYgKGRhdGEuZXJyb3IpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihkYXRhLmVycm9yLmRhdGE/Lm1lc3NhZ2UgfHwgZGF0YS5lcnJvci5tZXNzYWdlIHx8IFwiQXV0aGVudGljYXRpb24gZmFpbGVkXCIpO1xyXG4gIH1cclxuICBpZiAoIWRhdGEucmVzdWx0Py51aWQpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihcIkF1dGhlbnRpY2F0aW9uIGZhaWxlZCBcdTIwMTQgY2hlY2sgVklURV9PRE9PX0xPR0lOIGFuZCBWSVRFX09ET09fUEFTU1dPUkQvVklURV9PRE9PX0FQSV9LRVlcIik7XHJcbiAgfVxyXG5cclxuICAvLyBFeHRyYWN0IHRoZSBzZXNzaW9uX2lkIGNvb2tpZVxyXG4gIGNvbnN0IHNldENvb2tpZUhlYWRlcnMgPVxyXG4gICAgcmVzLmhlYWRlcnMuZ2V0U2V0Q29va2llPy4oKSB8fFxyXG4gICAgKHJlcy5oZWFkZXJzLmdldChcInNldC1jb29raWVcIikgPyBbcmVzLmhlYWRlcnMuZ2V0KFwic2V0LWNvb2tpZVwiKV0gOiBbXSk7XHJcbiAgY29uc3QgY29va2llID0gc2V0Q29va2llSGVhZGVycy5tYXAoKGMpID0+IGMuc3BsaXQoXCI7XCIpWzBdKS5qb2luKFwiOyBcIik7XHJcblxyXG4gIGNvbnNvbGUubG9nKGBbb2Rvby1wcm94eV0gXHUyNzEzIEF1dGhlbnRpY2F0ZWQgKHVpZD0ke2RhdGEucmVzdWx0LnVpZH0pYCk7XHJcbiAgcmV0dXJuIGNvb2tpZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9kb29Qcm94eVBsdWdpbigpIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogXCJvZG9vLXByb3h5XCIsXHJcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgIGNvbnN0IGVudiA9IGxvYWRFbnYoXHJcbiAgICAgICAgc2VydmVyLmNvbmZpZy5tb2RlLFxyXG4gICAgICAgIHNlcnZlci5jb25maWcuZW52RGlyIHx8IHByb2Nlc3MuY3dkKCksXHJcbiAgICAgICAgXCJcIiAvLyBsb2FkIEFMTCBlbnYgdmFycywgbm90IGp1c3QgVklURV8gcHJlZml4ZWRcclxuICAgICAgKTtcclxuXHJcbiAgICAgIGNvbnN0IG9kb29VcmwgPSBlbnYuVklURV9PRE9PX1VSTDtcclxuICAgICAgY29uc3QgZGIgICAgICA9IGVudi5WSVRFX09ET09fREI7XHJcbiAgICAgIGNvbnN0IGxvZ2luICAgPSBlbnYuVklURV9PRE9PX0xPR0lOO1xyXG4gICAgICBjb25zdCBwYXNzd29yZCA9IGVudi5WSVRFX09ET09fQVBJX0tFWSB8fCBlbnYuVklURV9PRE9PX1BBU1NXT1JEO1xyXG5cclxuICAgICAgaWYgKCFvZG9vVXJsIHx8ICFsb2dpbiB8fCAhcGFzc3dvcmQpIHtcclxuICAgICAgICBjb25zdCBtaXNzaW5nID0gW1xyXG4gICAgICAgICAgIW9kb29VcmwgICAmJiBcIlZJVEVfT0RPT19VUkxcIixcclxuICAgICAgICAgICFsb2dpbiAgICAgJiYgXCJWSVRFX09ET09fTE9HSU5cIixcclxuICAgICAgICAgICFwYXNzd29yZCAgJiYgXCJWSVRFX09ET09fQVBJX0tFWSBvciBWSVRFX09ET09fUEFTU1dPUkRcIixcclxuICAgICAgICBdLmZpbHRlcihCb29sZWFuKS5qb2luKFwiLCBcIik7XHJcbiAgICAgICAgY29uc29sZS53YXJuKGBcXG5bb2Rvby1wcm94eV0gXHUyNkEwICBNaXNzaW5nIGluIC5lbnY6ICR7bWlzc2luZ31cXG4gIEFQSSBjYWxscyB3aWxsIGZhaWwgdW50aWwgdGhlc2UgYXJlIHNldC5cXG5gKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQ2FjaGVkIHNlc3Npb24gY29va2llIFx1MjAxNCBsaXZlcyBhcyBsb25nIGFzIHRoZSBkZXYgc2VydmVyIHByb2Nlc3NcclxuICAgICAgbGV0IHNlc3Npb25Db29raWUgPSBudWxsO1xyXG4gICAgICBsZXQgYXV0aFByb21pc2UgICA9IG51bGw7IC8vIHByZXZlbnQgcGFyYWxsZWwgYXV0aCBzdG9ybXNcclxuXHJcbiAgICAgIGNvbnN0IGVuc3VyZUF1dGggPSAoKSA9PiB7XHJcbiAgICAgICAgaWYgKHNlc3Npb25Db29raWUpIHJldHVybiBQcm9taXNlLnJlc29sdmUoc2Vzc2lvbkNvb2tpZSk7XHJcbiAgICAgICAgaWYgKGF1dGhQcm9taXNlKSAgIHJldHVybiBhdXRoUHJvbWlzZTtcclxuICAgICAgICBhdXRoUHJvbWlzZSA9IGdldFNlc3Npb24ob2Rvb1VybCwgZGIsIGxvZ2luLCBwYXNzd29yZClcclxuICAgICAgICAgIC50aGVuKChjb29raWUpID0+IHtcclxuICAgICAgICAgICAgc2Vzc2lvbkNvb2tpZSA9IGNvb2tpZTtcclxuICAgICAgICAgICAgYXV0aFByb21pc2UgICA9IG51bGw7XHJcbiAgICAgICAgICAgIHJldHVybiBjb29raWU7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmNhdGNoKChlcnIpID0+IHtcclxuICAgICAgICAgICAgYXV0aFByb21pc2UgPSBudWxsO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnI7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gYXV0aFByb21pc2U7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKFwiL2FwaS9vZG9vXCIsIGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICAgIGlmIChyZXEubWV0aG9kICE9PSBcIlBPU1RcIikgcmV0dXJuIG5leHQoKTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IGNvb2tpZSA9IGF3YWl0IGVuc3VyZUF1dGgoKTtcclxuICAgICAgICAgIGNvbnN0IHRhcmdldFVybCA9IGAke29kb29Vcmx9JHtPRE9PX0VORFBPSU5UfWA7XHJcblxyXG4gICAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgY2h1bmtzID0gW107XHJcbiAgICAgICAgICAgIHJlcS5vbihcImRhdGFcIiwgKGMpID0+IGNodW5rcy5wdXNoKGMpKTtcclxuICAgICAgICAgICAgcmVxLm9uKFwiZW5kXCIsICgpID0+IHJlc29sdmUoQnVmZmVyLmNvbmNhdChjaHVua3MpKSk7XHJcbiAgICAgICAgICAgIHJlcS5vbihcImVycm9yXCIsIHJlamVjdCk7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICBsZXQgdXBzdHJlYW0gPSBhd2FpdCBmZXRjaCh0YXJnZXRVcmwsIHtcclxuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiwgQ29va2llOiBjb29raWUgfSxcclxuICAgICAgICAgICAgYm9keSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgbGV0IHRleHQgPSBhd2FpdCB1cHN0cmVhbS50ZXh0KCk7XHJcblxyXG4gICAgICAgICAgLy8gU2Vzc2lvbiBleHBpcmVkIG1pZC1mbGlnaHQgXHUyMDE0IHJlLWF1dGggb25jZSBhbmQgcmV0cnlcclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgdGV4dC5pbmNsdWRlcyhcIlNlc3Npb24gRXhwaXJlZFwiKSB8fFxyXG4gICAgICAgICAgICB0ZXh0LmluY2x1ZGVzKFwiU2Vzc2lvbiBleHBpcmVkXCIpIHx8XHJcbiAgICAgICAgICAgIHRleHQuaW5jbHVkZXMoJ1wic2Vzc2lvbl9pZFwiOiBmYWxzZScpXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbb2Rvby1wcm94eV0gU2Vzc2lvbiBleHBpcmVkIFx1MjAxNCByZS1hdXRoZW50aWNhdGluZ1wiKTtcclxuICAgICAgICAgICAgc2Vzc2lvbkNvb2tpZSA9IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnN0IGZyZXNoQ29va2llID0gYXdhaXQgZW5zdXJlQXV0aCgpO1xyXG4gICAgICAgICAgICB1cHN0cmVhbSA9IGF3YWl0IGZldGNoKHRhcmdldFVybCwge1xyXG4gICAgICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXHJcbiAgICAgICAgICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiwgQ29va2llOiBmcmVzaENvb2tpZSB9LFxyXG4gICAgICAgICAgICAgIGJvZHksXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0ZXh0ID0gYXdhaXQgdXBzdHJlYW0udGV4dCgpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFN1cmZhY2UgSFRNTCBlcnJvciBwYWdlcyBjbGVhcmx5XHJcbiAgICAgICAgICBpZiAoLzwhRE9DVFlQRXw8aHRtbC9pLnRlc3QodGV4dCkpIHtcclxuICAgICAgICAgICAgY29uc3QgdGl0bGVNYXRjaCA9IC88dGl0bGU+KFtePF0rKTxcXC90aXRsZT4vaS5leGVjKHRleHQpO1xyXG4gICAgICAgICAgICBjb25zdCBodG1sRXJyb3IgID0gdGl0bGVNYXRjaCA/IHRpdGxlTWF0Y2hbMV0udHJpbSgpIDogXCJPZG9vIHJldHVybmVkIGFuIEhUTUwgZXJyb3IgcGFnZVwiO1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbb2Rvby1wcm94eV0gSFRNTCBmcm9tIE9kb286ICR7aHRtbEVycm9yfWApO1xyXG4gICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMjtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBqc29ucnBjOiBcIjIuMFwiLCBpZDogbnVsbCwgZXJyb3I6IHsgY29kZTogNTAyLCBtZXNzYWdlOiBodG1sRXJyb3IgfSB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHVwc3RyZWFtLnN0YXR1cztcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgICAgICAgcmVzLmVuZCh0ZXh0KTtcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtvZG9vLXByb3h5XSBFcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcclxuICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAyO1xyXG4gICAgICAgICAgcmVzLnNldEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsganNvbnJwYzogXCIyLjBcIiwgaWQ6IG51bGwsIGVycm9yOiB7IGNvZGU6IDUwMiwgbWVzc2FnZTogZXJyLm1lc3NhZ2UgfSB9KSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlSLE9BQU8sVUFBVTtBQUNsUyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7OztBQ1dsQixTQUFTLGVBQWU7QUFFeEIsSUFBTSxnQkFBZ0I7QUFFdEIsZUFBZSxXQUFXLFNBQVMsSUFBSSxPQUFPLFVBQVU7QUFDdEQsVUFBUSxJQUFJLGtDQUFrQyxLQUFLLE9BQU8sT0FBTyxLQUFLO0FBQ3RFLFFBQU0sTUFBTSxNQUFNLE1BQU0sR0FBRyxPQUFPLDZCQUE2QjtBQUFBLElBQzdELFFBQVE7QUFBQSxJQUNSLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQUEsSUFDOUMsTUFBTSxLQUFLLFVBQVU7QUFBQSxNQUNuQixTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixJQUFJO0FBQUEsTUFDSixRQUFRLEVBQUUsSUFBSSxPQUFPLFNBQVM7QUFBQSxJQUNoQyxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsTUFBSSxDQUFDLElBQUksSUFBSTtBQUNYLFVBQU0sSUFBSSxNQUFNLGtCQUFrQixJQUFJLE1BQU0sS0FBSyxJQUFJLFVBQVUsRUFBRTtBQUFBLEVBQ25FO0FBRUEsUUFBTSxPQUFPLE1BQU0sSUFBSSxLQUFLO0FBQzVCLE1BQUksS0FBSyxPQUFPO0FBQ2QsVUFBTSxJQUFJLE1BQU0sS0FBSyxNQUFNLE1BQU0sV0FBVyxLQUFLLE1BQU0sV0FBVyx1QkFBdUI7QUFBQSxFQUMzRjtBQUNBLE1BQUksQ0FBQyxLQUFLLFFBQVEsS0FBSztBQUNyQixVQUFNLElBQUksTUFBTSw2RkFBd0Y7QUFBQSxFQUMxRztBQUdBLFFBQU0sbUJBQ0osSUFBSSxRQUFRLGVBQWUsTUFDMUIsSUFBSSxRQUFRLElBQUksWUFBWSxJQUFJLENBQUMsSUFBSSxRQUFRLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQztBQUN0RSxRQUFN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LFlBQWEsYUFBYSxXQUFXLENBQUMsRUFBRSxLQUFLLElBQUk7QUFDdkQsb0JBQVEsTUFBTSxnQ0FBZ0MsU0FBUyxFQUFFO0FBQ3pELGdCQUFJLGFBQWE7QUFDakIsZ0JBQUksVUFBVSxnQkFBZ0Isa0JBQWtCO0FBQ2hELGdCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLElBQUksTUFBTSxPQUFPLEVBQUUsTUFBTSxLQUFLLFNBQVMsVUFBVSxFQUFFLENBQUMsQ0FBQztBQUM5RjtBQUFBLFVBQ0Y7QUFFQSxjQUFJLGFBQWEsU0FBUztBQUMxQixjQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUNoRCxjQUFJLElBQUksSUFBSTtBQUFBLFFBQ2QsU0FBUyxLQUFLO0FBQ1osa0JBQVEsTUFBTSx1QkFBdUIsSUFBSSxPQUFPLEVBQUU7QUFDbEQsY0FBSSxhQUFhO0FBQ2pCLGNBQUksVUFBVSxnQkFBZ0Isa0JBQWtCO0FBQ2hELGNBQUksSUFBSSxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sSUFBSSxNQUFNLE9BQU8sRUFBRSxNQUFNLEtBQUssU0FBUyxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUM7QUFBQSxRQUNsRztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7OztBRDlKeUssSUFBTSwyQ0FBMkM7QUFNMU4sSUFBTSxZQUFZLEtBQUssUUFBUSxjQUFjLHdDQUFlLENBQUM7QUFFN0QsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxRQUFRLE1BQU07QUFDM0MsUUFBTSxRQUFRLFlBQVk7QUFFMUIsU0FBTztBQUFBO0FBQUEsSUFFTCxTQUFTLENBQUMsTUFBTSxHQUFHLEdBQUksUUFBUSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFFO0FBQUEsSUFFeEQsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBO0FBQUEsUUFFTCxLQUFLLEtBQUssUUFBUSxXQUFXLEtBQUs7QUFBQSxNQUNwQztBQUFBLElBQ0Y7QUFBQSxJQUVBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFFQSxPQUFPO0FBQUE7QUFBQSxNQUVMLFdBQVc7QUFBQSxNQUNYLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQTtBQUFBLFVBRU4sY0FBYztBQUFBLFlBQ1osT0FBTyxDQUFDLFNBQVMsV0FBVztBQUFBLFVBQzlCO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
