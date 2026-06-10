import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { odooProxyPlugin } from "./vite-odoo-proxy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isDev = command === "serve";

  return {
    // Only load the dev proxy plugin in local dev — not during Vercel build
    plugins: [react(), ...(isDev ? [odooProxyPlugin()] : [])],

    resolve: {
      alias: {
        // Removed broken @dashboard alias that pointed outside the project
        "@": path.resolve(__dirname, "src"),
      },
    },

    server: {
      port: 5173,
    },

    build: {
      // Produce source maps so Vercel logs show real file/line numbers on errors
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split vendor chunk for better caching
          manualChunks: {
            react: ["react", "react-dom"],
          },
        },
      },
    },
  };
});
