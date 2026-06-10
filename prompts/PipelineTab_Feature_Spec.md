# PipelineTab — Feature Specification for Kiro

## Context & Codebase

This is a React CRM dashboard using inline styles with shared theme tokens `T` (from `../constants/theme`), `REGION_COLORS` and `STAGE_COLORS` (from `../constants/colors`), and `fmt` (from `../lib/format`).

**Current state of `PipelineTab.jsx`:** A basic kanban-style grid — 4 columns (one per stage), each with a stage header, total revenue label, and scrollable cards. No filtering, no grouping, no charts.

**Reference component:** Study `VisitsTab.jsx` for patterns to reuse:
- `DetailPanel` — full-detail expand panel (fields, layout, Odoo link)
- `MultiSelect` — checkbox dropdown component
- `getUrgency` / `URGENCY` — urgency border coloring based on ISO date proximity
- `fmtShort(iso)` — formats ISO date as `"28 May, Thu"`
- `fadeIn` keyframe animation

**Props currently received by `PipelineTab`:** `{ leads, stages }`

**No new props are required.** All needed data lives on the `crm.lead` model and must come through the existing `leads` array.

---

## Data Fetching — Required Update to Parent

All fields used in this component — including the new Studio-added ones — are stored directly on the `crm.lead` model in Odoo. There is no cross-model join needed.

Find the parent component (or data-fetching hook/service) that calls the Odoo API to load `crm.lead` records and passes them as the `leads` prop to `PipelineTab`. This is likely a `searchRead` or `web_search_read` RPC call on the `crm.lead` model.

**Add the following fields to that call's `fields` array** if they are not already present:

```js
"x_studio_lead_status",
"x_studio_tentative_finalization_date",
"x_studio_assigned_salesperson",   // Many2one → returns [id, name]
"x_studio_sales_lead",             // Many2one → returns [id, name]
"x_studio_project_background",     // Selection or Char → returns string or false
```

These are all standard Studio fields on `crm.lead`. No model changes are needed — only the fetch fields list.

**Do not add any new Odoo RPC calls or new API endpoints.** The single existing `crm.lead` fetch, with the expanded fields list, is sufficient for the entire `PipelineTab`.

---

## Lead Data Fields (relevant)

```
l.id
l.name                                  — deal/opportunity name
l.partner_id[1]                         — company name
l.partner_name                          — fallback company name
l.stage_id[0], l.stage_id[1]           — stage id and label
l.expected_revenue                      — deal value
l.x_studio_responsible_region_1        — region string
l.x_studio_lead_status                 — "Active" | "Inactive" | other
l.x_studio_tentative_finalization_date — ISO date string (may be null)
l.x_studio_assigned_salesperson        — [id, name] tuple — the assigned salesperson
l.x_studio_sales_lead                  — [id, name] tuple — the sales lead person
l.x_studio_project_background          — string describing type/background of order (e.g. "New", "AMC", "Retrofit") — may be null
```

**Fields explicitly NOT used (do not reference these anywhere):**
- `l.x_studio_importance_of_lead` — removed
- `l.user_id` — removed, replaced by `x_studio_sales_lead`
- Stage pill on cards — removed

---

## Feature 1 — View Mode Toggle (List / Kanban)

Add a **view mode toggle** in the top filter bar (far right). Two icon-style buttons side by side:
- **List view** icon: three horizontal lines (≡)
- **Kanban view** icon: a 2×2 grid of squares (⊞)

**Default: List view.**

State: `viewMode` — `"list"` | `"kanban"`. Switching view mode does not reset filters, grouping, or selected lead.

The toggle buttons use the same connected-pill segmented style as the grouping control (rounded left for list, rounded right for kanban). Active button uses `T.accent` background + white; inactive uses `T.bgCard` + `T.textSecondary`.

---

## Feature 2 — Active Lead Filter (Default On)

Add a toggle button (pill-style, same as filter tabs in `VisitsTab`) labelled **"Active Only"** that defaults to **on**.

- When on: only show leads where `l.x_studio_lead_status === "Active"`.
- When off: show all leads regardless of status.
- Place this toggle in the top filter bar (left side).
- Toggling does not reset the grouping mode, view mode, or sort order.

---

## Feature 3 — Grouping Mode Toggle

Add a segmented control in the top filter bar with three options:

| Option | Label | Groups by |
|---|---|---|
| `"region"` | By Region | `l.x_studio_responsible_region_1` (fallback `"No Region"`) |
| `"person"` | By Person | `l.x_studio_assigned_salesperson[1]` (fallback `"Unassigned"`) |
| `"stage"` | By Stage | `l.stage_id[1]` (fallback `"No Stage"`) |

**Default:** `"region"`

Segmented control style: connected pills (left button rounded-left, right button rounded-right, middle no rounding). Active segment: `T.accent` bg + white text. Inactive: `T.bgCard` + `T.textSecondary`.

### Sort order within each group
Sort leads by `x_studio_tentative_finalization_date` ascending (earliest closing date first). Leads with **no finalization date** go to the **bottom** of their group. Within the no-date leads, sort by `expected_revenue` descending.

### Group header (List view)
Each group has a collapsible header row:
- **Group name** colored with `REGION_COLORS`, `PERSON_COLORS[index % PERSON_COLORS.length]`, or `STAGE_COLORS` depending on grouping mode
- **Lead count** badge (pill)
- **Total revenue** for the group (`fmt()`, `T.success`)
- **Collapse/expand chevron** — all groups start expanded

### Group header (Kanban view)
Same header row, but the collapse toggle is removed — kanban columns are always visible. The header sits above the column of cards.

### Empty groups
If a group has zero visible leads after filtering, omit it entirely.

---

## Feature 4 — List View Layout

When `viewMode === "list"`, render leads as **horizontal rows** inside each group (full-width cards stacked vertically).

### List Row columns (use CSS grid)

```
GRID = "1.6fr 120px 110px 120px 100px 120px"
```

Column headers (sticky, same pattern as VisitsTab):
```
LEAD / COMPANY | PROJECT TYPE | REGION | SALES LEAD | CLOSING DATE | VALUE
```

Each lead row contains:

| Column | Content |
|---|---|
| Lead / Company | Lead name (`fontSize: 13, fontWeight: 600, T.textPrimary`) on line 1; company name (`fontSize: 11, T.textMuted`) on line 2 |
| Project Type | `l.x_studio_project_background` as a pill. If null, show `"—"` in `T.textMuted`. Pill background: `rgba(124,58,237,0.10)`, color: `#7C3AED` (same style as engagement type pill in `VisitRow`) |
| Region | Region pill using `REGION_COLORS`. If null, `"—"` |
| Sales Lead | `l.x_studio_sales_lead[1]`. If null, `"—"` in `T.textMuted` |
| Closing Date | `fmtShort(l.x_studio_tentative_finalization_date)`. Color with `URGENCY[getUrgency(l.x_studio_tentative_finalization_date, null)].dateColor`. If null, `"No date"` in `T.textMuted` |
| Value | `fmt(l.expected_revenue)` in `T.success`, bold. If zero/null, `"—"` |

### Urgency left border
Each row has a left border colored via `URGENCY[getUrgency(l.x_studio_tentative_finalization_date, null)].border` — identical to `VisitRow` in `VisitsTab.jsx`. Use `borderLeft: "4px solid ..."`.

### Hover & click
- Hover: `T.bgCardAlt` background (use `useState` hover flag per row, same as `VisitRow`)
- Click: toggle inline `LeadDetailPanel` immediately below the clicked row (see Feature 6)

---

## Feature 5 — Kanban View Layout

When `viewMode === "kanban"`, render the groups as **horizontal columns**, each with a scrollable stack of vertical cards.

Layout: `display: grid`, `gridTemplateColumns: repeat(auto-fill, minmax(220px, 1fr))`, `gap: 14`, `alignItems: start`.

### Kanban Card

Each card is a vertical card (`background: T.bgCard, border: 1px solid T.border, borderRadius: 10, padding: "12px 14px"`).

Card contents (top to bottom):
1. **Lead name** — `fontSize: 13, fontWeight: 600, T.textPrimary, marginBottom: 4`
2. **Company** — `fontSize: 11, T.textMuted, marginBottom: 8`
3. **Project Type pill** — `l.x_studio_project_background`. Same purple pill style as list view. If null, omit.
4. **Region pill** — `l.x_studio_responsible_region_1`. If null, omit.
5. **Bottom row** (space-between): Sales Lead name (`fontSize: 11, T.textSecondary`) on the left; Revenue (`fmt`, `T.success`, bold) on the right
6. **Closing date** below the bottom row — `fmtShort()` with urgency date color. If null, `"No date"` in `T.textMuted`.

**Left border urgency** on each card: `borderLeft: "4px solid ..."` using `URGENCY[getUrgency(...)].border`.

**Hover & click** — same as list rows: hover highlight, click opens `LeadDetailPanel`.

---

## Feature 6 — Inline Lead Detail Panel (`LeadDetailPanel`)

When a lead row or card is clicked, expand a `LeadDetailPanel` immediately below it (list view: below the row; kanban view: below the card). One panel open at a time — clicking another lead closes the previous one. Clicking the same lead again closes it.

Track with `selectedLeadId` state (null by default).

### Panel layout
Model after `DetailPanel` in `VisitsTab.jsx`: header bar with title + close button (`×`), then a 3-column grid of `Field` sub-components.

Fields:

| Label | Value |
|---|---|
| Company | `l.partner_id[1]` |
| Stage | `l.stage_id[1]` |
| Region | `l.x_studio_responsible_region_1` |
| Assigned Salesperson | `l.x_studio_assigned_salesperson[1]` or `"—"` |
| Sales Lead | `l.x_studio_sales_lead[1]` or `"—"` |
| Deal Value | `fmt(l.expected_revenue)` colored `T.success` |
| Project Type | `l.x_studio_project_background` or `"—"` |
| Tentative Closing | `fmtShort(l.x_studio_tentative_finalization_date)` colored with urgency date color |
| Lead Status | `l.x_studio_lead_status` |

Full-width bottom row:
- **Odoo link**: `https://crm-adage-6.odoo.com/odoo/crm/{l.id}` — same "View in Odoo →" anchor style as `DetailPanel` in `VisitsTab`.

Apply `fadeIn` animation on mount via a `<style>` tag (inject the keyframe if not globally available).

---

## Feature 7 — Charts Section (Above the Grouped List/Kanban)

Render a **two-column chart row** between the filter bar and the main content. Each column is a `className="card"` with `padding: "20px 22px"`. Charts respond to the active filter (Active Only + dropdown filters) — they only show data for currently visible leads.

### Left Column — Revenue by Stage (SVG Donut Chart)

**No external chart library. SVG only.**

- Donut chart using SVG `<circle>` with `stroke-dasharray` / `stroke-dashoffset`.
- One segment per stage that has at least one visible lead. Color: `STAGE_COLORS[stage.name]` (fallback `T.accent`).
- Center text: `fmt(totalRevenue)` large bold + `"Pipeline"` label in `T.textMuted`.
- Right-side vertical legend: colored dot, stage name, revenue, lead count. Sorted by revenue descending.
- Section label: `"Revenue by Stage"`

**Implementation pattern:**
```js
const circumference = 2 * Math.PI * 52; // radius 52, viewBox ~130
// per segment:
const dash = (segmentValue / totalValue) * circumference;
const gap  = circumference - dash;
// strokeDashoffset = circumference - sum of all previous dashes (starts at top)
```

### Right Column — Projected Monthly Closings (Bar Chart)

**No external chart library. SVG or div-based bars.**

- X-axis: calendar months from `x_studio_tentative_finalization_date` of visible leads. Only months with ≥1 lead. Up to 12 months, sorted chronologically.
- Y-axis: total `expected_revenue` per month.
- Bars colored `T.accent`. Month label below (`"Jun '25"`). Revenue above bar.
- Leads with no finalization date excluded.
- If fewer than 2 months have data: show `"Not enough date data to show trend."` centered in `T.textMuted`.
- Section label: `"Projected Monthly Closings"`

---

## Feature 8 — Additional Filters (Top Bar)

Reuse the `MultiSelect` component from `VisitsTab.jsx`. Add two dropdowns:

- **Region** — unique `x_studio_responsible_region_1` values from all leads
- **Stage** — unique `stage_id[1]` values from all leads

Both default to empty. Add a `✕` clear button when any dropdown is active (same as `VisitsTab`). Filters apply globally to charts, grouped list, and kanban.

---

## Top Filter Bar Layout

```
[ Active Only ] [ By Region | By Person | By Stage ] [ Region ▼ ] [ Stage ▼ ] [ ✕ if active ]   ···   [ ≡ List | ⊞ Kanban ]
```

`display: flex`, `alignItems: center`, `gap: 8`, `flexWrap: wrap`, `marginBottom: 14`, `justifyContent: space-between`.

Left group: Active Only + grouping segmented control + dropdowns + clear.
Right group: List/Kanban view toggle.

---

## Urgency Legend

Below the filter bar and above the charts, show the urgency legend (same as `VisitsTab`):

```
● Overdue   ● Due in ≤2 days   ● Due this week
```

Colors: `#EF4444`, `#FF9933`, `#F59E0B`. `fontSize: 11, T.textSecondary`.

---

## Style Consistency Rules

- All color tokens from `T.*` — no raw hex except urgency colors (`#EF4444`, `#FF9933`, `#F59E0B`) and the project type pill (`rgba(124,58,237,0.10)` / `#7C3AED`), both shared with `VisitsTab`.
- List row / kanban card padding: `"12px 14px"`, border radius: `10px`, border: `1px solid ${T.border}`.
- Chart card padding: `"20px 22px"`, border radius: `12px`.
- Section labels: `fontSize: 11, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, color: T.textMuted, marginBottom: 14`.
- Pills: `borderRadius: 100`, `padding: "2px 8px"`, `fontSize: 10–11`, `fontWeight: 600`.
- Do **not** introduce any new external npm dependencies.
