# ADAGE CRM Dashboard

React dashboard for Odoo CRM (leads, pipeline, visits, calendar, team view).

## Run locally

```powershell
cd C:\Users\adarsh.ADAGE\Projects\adage-crm-dashboard
npm install
npm run dev
```

Open **http://localhost:5173/**

## Odoo credentials

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|---|---|
| `VITE_ODOO_URL` | Your Odoo instance URL, e.g. `https://your-instance.odoo.com` |
| `VITE_ODOO_DB` | Database name — usually the subdomain (optional on Odoo SaaS) |
| `VITE_ODOO_LOGIN` | Login email of the Odoo user |
| `VITE_ODOO_API_KEY` | API key — generate in Odoo → Settings → Technical → API Keys |

These are **server-side only** — they are never sent to the browser. The proxy (`api/odoo.js` on Vercel, `vite-odoo-proxy.js` in dev) uses HTTP Basic auth (`login:apikey`) and forwards all requests to Odoo, avoiding CORS entirely.

For Vercel: add the same four variables in **Project → Settings → Environment Variables**.
