# Project Memory — ADAGE CRM Dashboard

> **Purpose of this file**: a living reference for Claude (and anyone else) picking this project
> back up in a new session. It should always reflect the *current* state of the app.
> **Update this file whenever a feature is added, removed, or materially changed** — add an
> entry to the Changelog at the bottom, and update the sections above it if architecture/behavior
> changed. Keep entries factual and terse; this is not a design doc.

## What this app is

A React + Vite dashboard that visualizes Odoo CRM data (leads/opportunities, engagements/visits,
pipeline stages) for the Adage sales team. No backend database of its own — it's a thin UI over
live Odoo data, fetched through a proxy that keeps Odoo credentials server-side.

## Tech stack

- React 18 + Vite 5, plain JS (no TypeScript), no CSS framework — all styling is inline `style={}`
  objects driven by a shared theme token object.
- No state management library — everything lives in `App.jsx` `useState`/`useCallback` and is
  passed down as props.
- No test framework configured.
- Deployed on Vercel. `vercel.json` rewrites all non-`/api/*` routes to `index.html` (SPA).

## Architecture / data flow

- **`src/App.jsx`** — app shell. Owns all top-level state (`leads`, `engagements`, `stages`,
  `closedLeads`, `userMap`), fetches everything on mount via `loadData()`, renders the tab bar and
  routes to the active tab. Has an `ErrorBoundary` keyed per-tab so one tab crashing doesn't take
  down the others.
- **`src/lib/odoo.js`** — `fetchOdoo(model, method, args, kwargs)` — thin wrapper that POSTs
  JSON-RPC to `/api/odoo`. All Odoo reads/writes in the app go through this one function. Also
  exports `ODOO_BASE_URL = import.meta.env.VITE_ODOO_URL` — the single source of truth for the
  Odoo instance's web base URL, used to build every "open in Odoo" link (`${ODOO_BASE_URL}/odoo/
  crm/${lead.id}`) across VisitsTab/CalendarDayPopup/PipelineTab/TeamTab/SwimlaneView. **Never
  hardcode the Odoo domain in a view file** — change `VITE_ODOO_URL` in `.env` instead; every link
  updates automatically. (This used to be hardcoded as `crm-adage-11.odoo.com` in 10 places across
  5 files — fixed 2026-07-20, see changelog.)
- **Odoo proxy** (auth + CORS avoidance, credentials never reach the browser):
  - **`api/odoo.js`** — Vercel serverless function used in production. Authenticates once via
    `/web/session/authenticate`, caches the session cookie in module scope (survives warm
    Vercel re-invocations), forwards to `/web/dataset/call_kw`, auto re-authenticates once on
    "Session Expired".
  - **`vite-odoo-proxy.js`** (root) — equivalent Vite dev-server middleware, same logic, used by
    `npm run dev`.
  - Required env vars (see `.env.example`): `VITE_ODOO_URL`, `VITE_ODOO_DB`, `VITE_ODOO_LOGIN`,
    `VITE_ODOO_API_KEY` (or `VITE_ODOO_PASSWORD` as fallback). Set locally in `.env` (gitignored)
    and in Vercel → Project → Settings → Environment Variables for prod.
- **`src/constants/theme.js`** (`T`) — single source of truth for colors/shadows used via inline
  styles everywhere. **`src/constants/colors.js`** — categorical color maps (region, stage,
  person, greenfield/brownfield) used by charts.
- **`src/lib/format.js`** — `fmt` (₹ Cr/L/K currency formatter), `fmtDate`, `getPersonName(s)`
  (resolves Odoo many2many person fields — handles object/tuple/id/string shapes — against the
  `userMap` built from `hr.employee`).

### Odoo models used
- `crm.lead` (type=opportunity, active=true) — the main leads/opportunities dataset, plus a
  separate `closedLeads` fetch (won/lost, inactive included via broader query) for win-rate math.
  Both queries add `["company_id","=",companyId]` to the domain when a specific company is
  selected (see Multi-company section below).
- `x_crm_lead_line_163b3` (the "Engagement Tracker" Studio model — technical model name is
  instance-specific, confirmed via the schema PDFs, see note below) — custom "engagement"/visit
  line model linked to leads via `x_crm_lead_id`, filtered client-side to only those whose lead is
  still in the active `leads` set (so it's implicitly company-scoped too, without needing its own
  `company_id` filter). Key fields: `x_studio_planned_date`, `x_studio_rescheduled_date`,
  `x_studio_completed_date`, `x_studio_engagement_type`, `x_studio_engagement_status`,
  `x_studio_action_by` (many2many → `hr.employee`), `x_studio_engagement_with` (plain char),
  `x_studio_remarkscomments`.
- `crm.stage` — pipeline stage list (ordered by `sequence`), not company-filtered (shared/global).
- `hr.employee` — resolved on demand to build `userMap` (id → name) for engagement "visit by" fields.
- `res.company` — fetched once on mount (`id`, `name`) to populate the company-switcher dropdown.

### Multi-company support
- `App.jsx` holds `companyId` state (`null` = "All Companies") and `companies` (fetched once from
  `res.company`). A `<select>` dropdown sits in the header immediately left of the tab buttons
  (Pipeline | Visits | Team View | Calendar), separated by a thin vertical divider.
- **The dashboard is scoped to only 3 companies** — `ALLOWED_COMPANY_NAMES` (top of `App.jsx`):
  `"Adage Automation Private Ltd."`, `"Adage Kanoo Analytical Industry"`,
  `"Adage Kanoo Industrial Company"`. The `res.company` fetch filters server-side by
  `["name","in",ALLOWED_COMPANY_NAMES]`, so the dropdown never lists the instance's other
  companies (e.g. "Adage Analytics", "Adage Test", "ADAGE AUTOMATION PRIVATE LIMITED" — that last
  one is a distinct company from "Adage Automation Private Ltd." despite the similar name, and is
  deliberately excluded). "All Companies" means "all 3 allowed companies", not literally every
  company in the Odoo instance — it filters `company_id in [...]` rather than omitting the filter.
  A stale `companyId` in `localStorage` pointing at a company outside this set (e.g. from before
  the restriction was added) is detected and cleared back to `null` once the company list loads.
- Changing the dropdown updates `companyId`, persists it to `localStorage`
  (`adage_crm_company_id`) so the choice survives a reload, and — because `loadData` is a
  `useCallback` keyed on `[companyId, companies]` — triggers a full refetch of leads/closedLeads
  scoped to that company (or to all 3 allowed companies if "All Companies") via the `company_id`
  domain filter.
- Only `crm.lead` reads are filtered directly; engagements inherit the scoping indirectly via
  `activeLeadIds`. If a future feature needs company-scoped engagements independent of leads,
  `x_crm_lead_line_163b3` will need its own `company_id`-equivalent filter (check whether that
  model even carries a company field before assuming it does).
- **If the set of allowed companies changes**, update `ALLOWED_COMPANY_NAMES` in `App.jsx` — that's
  the single source of truth, nothing else needs touching.

## Tabs / features (as wired in `App.jsx`)

| Tab id | Component | File | Purpose |
|---|---|---|---|
| `pipeline` | `PipelineTab` | `src/views/PipelineTab.jsx` (~1980 lines, largest file) | Kanban + list views of leads, revenue-by-status donut, greenfield/brownfield pie, projected monthly closings bar chart (drill-down), lead detail card (`LeadCard`) |
| `visits` | `VisitsTab` | `src/views/VisitsTab.jsx` | Planned/upcoming engagement visits list |
| `team` | `TeamTab` | `src/views/TeamTab.jsx` | Per-person × region breakdown of engagements |
| `swimlane` | `SwimlaneView` | `src/views/SwimlaneView.jsx` (~1160 lines) | Calendar/swimlane view of engagements by week, with list view, multi-select filters, tooltips |

Supporting/shared components:
- `src/views/CalendarDayPopup.jsx` — popup shown when a calendar day is clicked (from swimlane or
  elsewhere), shows leads/engagements for that day.
- `src/components/HealthSpeedometer.jsx`, `src/components/HealthTag.jsx` — visualize
  `x_studio_prospect_health` on leads.

**Note:** `src/views/OverviewTab.jsx` exists but is **not imported/routed in `App.jsx`** — appears
to be an earlier/alternate overview screen, currently dead code. Don't assume it's live; confirm
before building on it.

## Known repo quirks

- `.kiro/steering/ui-ux-pro-max/` is a bundled design-reference skill (colors/typography/UX
  guideline CSVs + scripts), not application code.
- `prompts/` directory exists at root — not yet inspected in depth; check contents before
  assuming it's unused.

## Working conventions observed in this codebase

- Section dividers in code use the `// ─── Name ───...` comment style — match this when adding
  new sections to existing files rather than introducing a different divider style.
- Styling is 100% inline JS style objects referencing `T` (theme.js) and the color maps in
  colors.js — no Tailwind/CSS modules. Keep new UI consistent with this pattern.
- Odoo field names are Studio custom fields prefixed `x_studio_*` — when adding new data, check
  the actual Odoo instance field name rather than guessing.
- **Studio model/field technical names are instance-specific and drift across database
  migrations** (this repo has switched Odoo databases at least twice per git history —
  crm-adage-7 → crm-adage-9 → crm-adage-11). A Studio child model's technical name (e.g.
  `x_crm_lead_line_163b3`) gets a new random suffix if the model is recreated rather than
  migrated, and field names can be renamed. **Whenever behavior seems wrong for the engagement/
  visit data specifically, check root-level schema export PDFs (if present, e.g. `crm model.pdf`,
  `Engagement Tracker.pdf`) against the field/model names actually used in code before assuming
  it's a logic bug** — see the 2026-07-20 fix below for a concrete precedent.

---

## Changelog

Append a new entry each session under today's date, newest on top. One line per change is enough;
add detail only if it's non-obvious from the code/git log.

### 2026-07-20
- Removed hardcoded `https://crm-adage-11.odoo.com` from 10 "open in Odoo" link locations across
  `VisitsTab.jsx`, `CalendarDayPopup.jsx`, `PipelineTab.jsx` (5 occurrences), `TeamTab.jsx` (2), and
  `SwimlaneView.jsx` — this was stale from a prior database (`crm-adage-11`) and didn't match the
  current instance (`adage-automation`). Added `ODOO_BASE_URL` export to `lib/odoo.js`
  (`= import.meta.env.VITE_ODOO_URL`), reusing the existing `VITE_ODOO_URL` env var rather than
  introducing a new one — no `.env` changes needed since it was already set correctly. Verified:
  `npm run build` passes and the built bundle contains `adage-automation.odoo.com` (confirmed via
  grep on the dist bundle — couldn't click through to a lead-detail link in the headless-browser
  check due to a flaky expand-group click, but the bundle inspection is conclusive since it's a
  simple deterministic template-literal substitution).
- Restricted the company dropdown to only the 3 companies this dashboard should cover:
  "Adage Automation Private Ltd.", "Adage Kanoo Analytical Industry", "Adage Kanoo Industrial
  Company" (list lives in `ALLOWED_COMPANY_NAMES` at the top of `App.jsx`). Previously all 6
  companies in the Odoo instance were listed/selectable, including near-duplicates like "ADAGE
  AUTOMATION PRIVATE LIMITED" and unrelated ones like "Adage Analytics"/"Adage Test". "All
  Companies" now means "all 3 allowed" (filters `company_id in [...]`), not literally unfiltered.
  Verified against live Odoo: dropdown now shows exactly the 4 expected options, no console errors.
- Fixed stale Odoo technical names for the Engagement Tracker data, cross-checked against root-
  level schema export PDFs (`crm model.pdf`, `Engagement Tracker.pdf`) provided by the user. The
  live Odoo schema (current database) differs from what the code was still using:
  - Model name: `x_crm_lead_line_6bc5b` → **`x_crm_lead_line_163b3`** (the child model backing
    `crm.lead`'s `x_studio_engagement_tracker` one2many). This alone would have made every
    engagement/visit fetch fail (unknown model) against the current database.
  - Field: `x_studio_proposed_date` → **`x_studio_planned_date`** (doesn't exist under the old name).
  - Field: `x_studio_visit_by` → **`x_studio_action_by`** (many2many → `hr.employee`; doesn't exist
    under the old name — this is what all the "assigned to" / visit-by-person UI was built on).
  - Field: `x_studio_remarkscommments` (3 m's, typo) → **`x_studio_remarkscomments`** (2 m's,
    correct). Several files had defensive `a || b` fallbacks checking both spellings; simplified
    those back to a single reference now that the correct name is fetched directly.
  - Updated in `App.jsx`, `VisitsTab.jsx`, `CalendarDayPopup.jsx`, `TeamTab.jsx`, `PipelineTab.jsx`,
    `SwimlaneView.jsx`, and the doc comment in `lib/format.js`. All `crm.lead` fields (the other
    PDF) were cross-checked too and already matched — no changes needed there.
  - Verified `npm run build` passes. Could not verify against live Odoo data (no real credentials
    configured locally, `.env` still has placeholders) — the fix is correct per the schema PDFs but
    hasn't been confirmed against the live API response.
- Added multi-company support: a "Company" dropdown in the header (beside the tab buttons) lets
  the user switch between Odoo companies (`res.company`) or "All Companies"; selecting one filters
  `crm.lead` reads (both the main leads fetch and the closedLeads fetch) by `company_id`, and the
  choice persists across reloads via `localStorage`. Verified locally: `npm install` (deps weren't
  installed), `npm run build` passes, and visually confirmed via a headless Chrome (system Chrome,
  driven with `playwright-core` since the Playwright browser download was blocked by the sandbox
  network) — dropdown renders correctly next to Pipeline/Visits/Team View/Calendar, no console
  errors beyond the expected 502s from placeholder Odoo creds. Copied `.env.example` → `.env`
  locally for this test — **it still has placeholder values**, replace with real credentials to
  actually load data.
- Deleted 12 leftover debug/scratch files from repo root (Odoo auth troubleshooting artifacts):
  `api-test.txt`, `auth-test.txt`, `build-log.txt`, `run-output.txt`, `session-detail.json`,
  `session-test.txt`, `test-api.ps1`, `test-auth.ps1`, `test-session.ps1`,
  `test-session-detail.ps1`, `temp-odoo-xmlrpc-test.py`, `vite.config.js.timestamp-*.mjs`.
  Removed via `git rm` (staged, not committed as of this entry). None were referenced by app code
  or `package.json` scripts.
- Initial creation of this memory file. Explored full repo structure, `App.jsx` data flow, Odoo
  proxy (`api/odoo.js` + `vite-odoo-proxy.js`), all four routed tabs, and shared
  theme/color/format helpers. No code changes made this session — documentation only.
