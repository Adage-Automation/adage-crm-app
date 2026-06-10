# Kiro Prompt: Redesign `VisitsTab.jsx` — Smarter Visit List

## Context

The current `VisitsTab` component (`src/views/VisitsTab.jsx`) shows a basic upcoming-visits table with a side panel for type breakdown and status summary. The data source is the **Engagement Tracker** custom model: `x_crm_lead_line_1519d`.

Key fields available on each engagement record:
- `x_studio_proposed_date` — the visit/activity date (primary sort key)
- `x_studio_visit_date` — actual interaction date (if completed)
- `x_studio_next_follow_up_date`
- `x_studio_engagement_type` — Phone Call, Email, Meeting, Exhibition
- `x_studio_engagement_status` — Planned, Completed, Rescheduled, Cancelled
- `x_studio_visit_by` — Many2many employee IDs (resolved via `userMap`)
- `x_crm_lead_id` — linked CRM lead (provides company name, order value, region)
- `x_studio_remarkscomments`

The design reference for the **detail panel and Odoo redirect link** is `SwimlaneView.jsx` → `DetailPanel` component. Replicate that pattern here.

---

## What to Build

Replace the current `VisitsTab` implementation entirely with the following design.

---

### Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  FILTER TABS          [All] [Planned (12)] [Unassigned (3)] [Rescheduled (2)]│
│  SEARCH BAR           [🔍 Search company or person…]     [Sort: Visit Date ▼] │
├──────────────────────────────────────────────────────────────────────────────┤
│  VISITS TABLE                                                                │
│  Date     │ Date Type  │ Eng. Type │ Company │ Order Value │ Assigned To │ Region   │
│  ─────────│─────────│──────│─────────│─────────────│─────────────│─────────  │
│  rows…                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  DETAIL PANEL (expands below table on row click — same as SwimlaneView)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

No side panels. The layout is **full-width, single column**, with the detail panel expanding inline at the bottom on row click.

---

## Filter Tabs

Render four pill-style tabs above the table. Each tab shows a **count badge** reflecting how many records match under the current search query.

| Tab Label     | Filter Logic |
|---------------|--------------|
| **Planned**   | `x_studio_engagement_status === "Planned"` — **default active tab** |
| **Unassigned**| `x_studio_visit_by` is empty (`[]` or falsy) |
| **Rescheduled** | `x_studio_engagement_status === "Rescheduled"` |
| **All**       | No filter — show everything |

Switching tabs does **not** reset the search bar.

---

## Search Bar

A single text input at the top right of the filter row. Filters results in real time by:
- Company name (`lead.partner_id[1]`)
- Assigned person name (from resolved `userMap`)

Case-insensitive partial match.

---

## Urgency Color Coding

For each row, compute urgency based on the row's **effective date** (either `x_studio_proposed_date` or `x_studio_next_follow_up_date` depending on the row type) compared to today:

| Condition | Urgency | Row Left Border Color |
|-----------|---------|----------------------|
| Status is **Completed** | — | No color indicator |
| Status is **Cancelled** | — | No color indicator |
| Date is **past today** and status is NOT Completed/Cancelled | 🔴 Overdue | `#EF4444` (danger red) |
| Date is **today or within next 2 days** | 🟠 Urgent | `#F97316` (orange) |
| Date is **3–7 days away** | 🟡 Soon | `#F59E0B` (amber/yellow) |
| Date is **more than 7 days away** | — | No left border / neutral |

Apply the urgency as a **4px left border** on the entire table row. Additionally, render the date cell text in the same urgency color. Do **not** add background shading to the row — only the left border and date text change color.

Also add a small urgency legend below the filter tabs (one line, inline):
```
🔴 Overdue  🟠 Due in ≤2 days  🟡 Due this week
```

---

## Table Columns

| Column | Source | Notes |
|--------|--------|-------|
| **Date** | See sorting logic below | Formatted as "28 May, Thu". Color-coded per urgency. |
| **Date Type** | Derived | Small muted pill next to the date: **"Proposed"** or **"Follow-Up"** — indicates which date field this row is representing. See Sorting section. |
| **Engagement Type** | `x_studio_engagement_type` | Pill with emoji: ✉️ Email, 📞 Phone Call, 🤝 Meeting, 🏛️ Exhibition, 📌 (default) |
| **Company** | `lead.partner_id[1]` | Truncated with ellipsis if long. Show `x_crm_lead_id[1]` as fallback. |
| **Order Value** | `lead.expected_revenue` | Formatted via `fmt()`. Green color. Show "—" if zero/null. |
| **Assigned To** | `x_studio_visit_by` resolved via `userMap` | List persons comma-separated. If empty: show `Unassigned` pill in amber. |
| **Region** | `lead.x_studio_responsible_region_1` | Colored pill using `REGION_COLORS` |
| **Status** | `x_studio_engagement_status` | Pill with STATUS_CONFIG colors (same as SwimlaneView) |

---

## Sorting and Date Expansion

Each engagement record can generate **up to two rows** in the table:

1. One row for `x_studio_proposed_date` (always, if the date is present)
2. A **second row** for `x_studio_next_follow_up_date` — only if the field is non-empty **and** the follow-up date is different from the proposed date

Both rows show the same engagement data (same company, type, assigned person, status, order value) but differ in their **Date** cell and **Date Type** pill.

The full expanded list is then sorted chronologically by the row's effective date (ascending by default). This means a single engagement can appear twice in the list if it has both a proposed date and a follow-up date — once at its proposed date position and once at its follow-up date position.

**Date Type pill styling:**
- `Proposed` — subtle neutral pill: background `rgba(100,116,139,0.10)`, text `#64748B`
- `Follow-Up` — accent pill: background `rgba(99,102,241,0.10)`, text `#6366F1`

**Urgency for follow-up rows:** Apply urgency color coding to the follow-up row using `x_studio_next_follow_up_date` as the reference date (same thresholds as proposed date rows). Do not skip urgency just because it is a follow-up row.

**Sort dropdown top-right options:**
- Date ↑ (default — earliest effective date first)
- Date ↓ (latest first)
- Order Value ↓

**Deduplication rule:** If `x_studio_next_follow_up_date === x_studio_proposed_date`, only emit one row for that date (label it "Proposed", not "Follow-Up").

**Key for each row:** Use `${engagement.id}-proposed` and `${engagement.id}-followup` as React keys so both rows can coexist without key conflicts.

---

## Anomaly Warning

If a row has `x_studio_visit_date` set but `x_studio_engagement_status` is still `"Planned"`, show a ⚠ icon next to the status pill with the tooltip: _"Visit recorded but status not updated"_.

This is the same logic as `SwimlaneView → Pill → isAnomaly`.

---

## Detail Panel (on Row Click)

When a row is clicked, expand a **`DetailPanel`** inline below the table. Clicking the same row again collapses it.

The panel must replicate the `DetailPanel` component from `SwimlaneView.jsx` **exactly**, including:

- 3-column grid layout
- Fields: Customer, Deal Value, Engagement Type, Assigned To, Proposed Date, Actual Interaction Date, Next Follow-Up Date, Remarks/Comments
- Anomaly warning in the panel header
- **"View in Odoo →"** button linking to:
  ```
  https://crm-adage-6.odoo.com/odoo/crm/{x_crm_lead_id[0]}
  ```
  _(This is the correct CRM base URL — use `crm-adage-6`, regardless of what appears in `App.jsx` or `SwimlaneView.jsx`)_
- A close `×` button in the panel header
- `fadeIn` animation on mount

---

## Props Interface

`VisitsTab` receives the following props from `App.jsx`:

```js
{
  leads,          // array — full active leads
  engagements,    // array — all engagement records
  plannedVisits,  // array — pre-filtered: status === "Planned"
  upcomingVisits, // array — planned + sorted by date (top 12) — can be ignored; use engagements directly
  userMap,        // object — { employeeId: "Name" }
}
```

> **Important**: Do not rely on `upcomingVisits` (it was pre-sliced to 12 rows). Instead, derive the filtered + sorted list **inside the component** from `engagements` directly so the filter tabs work across all records.

Build a `leadMap` inside the component:
```js
const leadMap = useMemo(() => {
  const m = {};
  leads.forEach(l => { m[l.id] = l; });
  return m;
}, [leads]);
```

---

## Suggested Additional Improvements (include all of these)

The following improvements were identified during review and should be included in the implementation:

### 1. Empty State Per Filter
When a filter tab + search combination returns zero results, show a contextual empty state rather than a blank table:
- **Unassigned (empty):** "✅ All visits have been assigned."
- **Planned (empty):** "No planned visits found."
- **General:** "No results match your search."

### 2. Count Badges on Filter Tabs
Each tab should show a live count badge that updates as the search query changes. The count reflects how many records match **both** the tab filter and the current search string.

### 3. Keyboard Shortcut to Clear Search
Add an `×` clear button inside the search input that appears when there is text in it. Clicking it resets the search string.

### 4. Sticky Table Header
The column header row should be `position: sticky; top: 0` so it stays visible when the list is long. Wrap the table in a `div` with `maxHeight: "60vh"; overflowY: "auto"`.

### 5. Unassigned Pill
When `x_studio_visit_by` is empty, render a pill:
```
⚠ Unassigned
```
in amber (`#F59E0B` background with white text), rather than a plain dash, so it draws attention.

### 6. Region Color in Assigned-To Column
If only one person is assigned, show their name in their stable person-color (same palette as `SwimlaneView: PERSON_COLORS`). For multiple assignees, use default secondary text color.

### 7. Visit Type Quick Stats Bar
Replace the current "Visit Type Breakdown" and "Status Summary" side panels with a compact **quick-stats strip** above the table (below the filter tabs). It shows the count of each engagement type visible in the current filtered view — one small badge per type:

```
📞 Phone Call: 5   ✉️ Email: 3   🤝 Meeting: 2   🏛️ Exhibition: 1
```

This updates dynamically as filters change.

---

## Implementation Notes

- Import `T` from `src/constants/theme.js`
- Import `REGION_COLORS`, `PERSON_COLORS` from `src/constants/colors.js`
- Import `fmt`, `fmtDate`, `getPersonName` from `src/lib/format.js`
- Do **not** import from SwimlaneView — re-implement the `DetailPanel` and `STATUS_CONFIG` locally inside `VisitsTab.jsx`
- Use `useMemo` for `leadMap`, filtered list, and count badges to avoid recomputing on every keystroke
- Use `useState` for: `activeFilter`, `searchQuery`, `sortOrder`, `selectedEngagement`
- The `STATUS_CONFIG` object to use:
  ```js
  const STATUS_CONFIG = {
    Planned:     { bg: "#10B981", text: "#fff" },
    Completed:   { bg: "#3B82F6", text: "#fff" },
    Rescheduled: { bg: "#F59E0B", text: "#fff" },
    Cancelled:   { bg: "#94A3B8", text: "#fff" },
  };
  ```
- The `TYPE_EMOJI` map:
  ```js
  const TYPE_EMOJI = { "Email": "✉️", "Phone Call": "📞", "Meeting": "🤝", "Exhibition": "🏛️" };
  ```

---

## Acceptance Criteria

- [ ] Default tab on mount is "Planned" (not "All")
- [ ] Engagements with a follow-up date generate a second row sorted by that date
- [ ] Proposed rows show "Proposed" pill; follow-up rows show "Follow-Up" pill in accent color
- [ ] Urgency color coding applies independently to proposed-date rows and follow-up-date rows
- [ ] No duplicate rows when proposed date and follow-up date are the same
- [ ] Urgency left-border and date text color work correctly for past/near/upcoming dates
- [ ] Completed and Cancelled records have no urgency indicator
- [ ] Unassigned filter correctly shows only records with empty `x_studio_visit_by`
- [ ] Search filters by company name AND person name simultaneously
- [ ] Count badges on filter tabs update in real time as search query changes
- [ ] Clicking a row expands the detail panel; clicking again collapses it
- [ ] "View in Odoo →" link uses `crm-adage-6.odoo.com` base URL
- [ ] Anomaly warning (`⚠`) appears on rows AND in detail panel header when applicable
- [ ] Sticky table header works when the list overflows
- [ ] Quick-stats type bar reflects the current filtered view
- [ ] Empty state messages are contextual per filter tab
- [ ] No regressions in other tabs
