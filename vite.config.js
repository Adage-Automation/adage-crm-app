import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { odooProxyPlugin } from "./vite-odoo-proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), odooProxyPlugin()],
    resolve: {
      alias: {
        "@dashboard": path.resolve(__dirname, "../../Downloads"),
      },
    },
    server: {
      port: 5173,
      fs: {
        allow: [path.resolve(__dirname, "../..")],
      },
    },
  };
});
