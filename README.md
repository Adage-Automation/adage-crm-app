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

Copy `.env.example` to `.env` and set:

- `VITE_ODOO_URL` or `ODOO_URL` — your Odoo instance (default: `https://crm-adage-5.odoo.com`)
- `VITE_ODOO_DB` or `ODOO_DB` — database name (usually the subdomain, e.g. `crm-adage-5`)
- `VITE_ODOO_LOGIN` or `ODOO_USER` — email/login of the user who owns the API key or password
- `VITE_ODOO_API_KEY` or `ODOO_API_KEY` — API key from Odoo → Preferences → Account Security
- `VITE_ODOO_PASSWORD` or `ODOO_PASS` — account password if you want to authenticate via XML-RPC

The proxy now supports either a valid API key or a valid account password from either VITE_ or ODOO_-prefixed env names. You still need the correct login email.

In development, Vite authenticates to Odoo and proxies `/api/odoo/*` so the browser avoids CORS issues.
