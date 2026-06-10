# TeamTab — Feature Specification for Kiro

## Context & Codebase

This project is a React CRM dashboard built with inline styles using a shared theme token object `T` (from `../constants/theme`), `REGION_COLORS` and `PERSON_COLORS` (from `../constants/colors`), and utility functions `fmt`, `fmtDate`, `getPersonName` (from `../lib/format`).

The two relevant files are:

- **`TeamTab.jsx`** — currently renders two sections:
  1. A **pivot table** (planned visits per person × per region)
  2. An **opportunity ownership** section (revenue bar chart per salesperson)

- **`VisitsTab.jsx`** — the reference component. Study this file carefully. It contains:
  - `DetailPanel` — renders full engagement detail (fields: customer, deal value, engagement type, assignees, proposed date, visit date, next follow-up date, remarks, Odoo link)
  - `VisitRow` — a single styled row in a scrollable grid table, with urgency left-border coloring, status pill, engagement type pill, region pill, and assignee list
  - `getUrgency(isoDate, status)` — urgency classification logic (`"overdue"`, `"urgent"`, `"soon"`, `"none"`)
  - `fmtShort(iso)` — formats an ISO date as `"28 May, Thu"`
  - `STATUS_CONFIG`, `TYPE_EMOJI`, `URGENCY` — local constants for styling
  - `MultiSelect` — a reusable dropdown component with checkbox-style multi-selection

The `engagements` array (available as a prop) contains objects with these relevant fields:
- `id`, `x_studio_engagement_status`, `x_studio_engagement_type`
- `x_studio_proposed_date`, `x_studio_next_follow_up_date`, `x_studio_visit_date`
- `x_studio_visit_by` — array of `[id, name]` tuples (the assigned persons)
- `x_crm_lead_id` — `[id, name]` tuple referencing the related lead
- `x_studio_remarkscomments`

The `leads` array contains objects with:
- `id`, `partner_id` (`[id, name]`), `expected_revenue`, `x_studio_responsible_region_1`, `user_id` (`[id, name]`)

---

## Feature 1 — Planned Visits Pivot Table: Drill-Down Navigation

### Current Behaviour
The pivot table shows a static summary: rows = persons, columns = regions, cells = visit counts.

### Required Behaviour

Implement **two-level drill-down** inside the pivot table card, replacing the static table with a navigable view. Use a `drillState` local state object to track the current level.

#### Level 0 — Summary (default)
Same as current: person × region pivot table.

- Each **person row** is now **clickable** (pointer cursor, hover highlight).
- Clicking a person row transitions to Level 1 for that person.
- No column or region is clickable — only person rows drill down.

#### Level 1 — Person Detail, Grouped by Region
When a person is selected:

- Show a **breadcrumb** at the top of the card: `All People › {PersonName}` — clicking "All People" returns to Level 0.
- Show the person's avatar (initials + color, same style as current).
- Below, render **region groups**. For each region where this person has engagements:
  - A **region header** styled with its `REGION_COLORS` color (pill or colored left-border label).
  - A **compact list** of engagements under that region. Each item shows:
    - Engagement type emoji + label
    - Company name (`lead.partner_id[1]`)
    - Proposed date (formatted with `fmtShort`)
    - Status pill (using `STATUS_CONFIG`)
    - Urgency left-border (using `getUrgency`)
  - Each engagement item is **clickable** → transitions to Level 2 for that engagement.
- If a person has engagements with no associated region, group them under `"Unassigned Region"`.

#### Level 2 — Single Engagement Detail
When an engagement is selected from Level 1:

- Show breadcrumb: `All People › {PersonName} › {CompanyName}` — each segment is clickable to navigate back.
- Render the **`DetailPanel`** component (imported/copied from `VisitsTab.jsx`) to display full engagement details.
- Do **not** show a separate close button — navigating via breadcrumb is sufficient.

### Implementation Notes
- Store drill state as: `{ level: 0 | 1 | 2, personName: string | null, engagementId: number | null }`
- Derive the filtered engagements for a person by matching `eng.x_studio_visit_by` entries (resolve names via `userMap` using `getPersonName`).
- Reuse `DetailPanel`, `fmtShort`, `getUrgency`, `URGENCY`, `STATUS_CONFIG`, `TYPE_EMOJI` — either import them from `VisitsTab.jsx` (if they are exported) or duplicate the constants/functions locally in `TeamTab.jsx`.
- The `userMap` prop must be added to `TeamTab` — update the parent component that renders `<TeamTab>` to pass it through.
- Keep the card height consistent across levels; add `overflowY: "auto"` with a `maxHeight` if the region list is long.

---

## Feature 2 — Replace Opportunity Ownership with "This Week's Planned Activities" by Person

### Current Behaviour
The second card shows a revenue bar chart per salesperson (labelled "Opportunity ownership — by salesperson").

### Required Behaviour
**Remove** the opportunity ownership section entirely. Replace it with a new card: **"This Week's Planned Activities — by assignee"**.

### Data Scope
Filter `engagements` to only those where **either** `x_studio_proposed_date` **or** `x_studio_next_follow_up_date` falls within the **current calendar week** (Monday 00:00 to Sunday 23:59, local time). Include both `"Planned"` and `"Rescheduled"` statuses. Exclude `"Completed"` and `"Cancelled"`.

### Grouping
Group the filtered engagements by assigned person (`x_studio_visit_by`). An engagement assigned to multiple persons appears in each person's group. Engagements with no assignees go into an `"Unassigned"` group.

### Priority Ordering (within each person's group)
Sort each person's engagements in this order:
1. **Overdue** first (urgency = `"overdue"` — proposed/follow-up date is before today)
2. **Urgent** (due within 2 days)
3. **Soon** (due this week)
4. Within the same urgency tier, sort by date ascending.

Use the earlier of `x_studio_proposed_date` and `x_studio_next_follow_up_date` as the sort key.

### Layout
Use a **list view** (not grid). For each person group:

- **Person header row**: avatar (initials + `PERSON_COLORS` color, same style as pivot table), person name, and a count badge showing total activities for the week.
- Below the header, render each engagement as a **compact activity card** (a row with a left urgency border, identical to the border logic in `VisitRow` from `VisitsTab.jsx`). Each card shows:
  - **Engagement Type**: emoji + label pill (reuse the purple pill style from `VisitRow`)
  - **Company**: `lead.partner_id[1]` or fallback to `eng.x_crm_lead_id[1]`
  - **Date field**: show both dates if present, labelled:
    - "Proposed: 28 May, Thu" (using `fmtShort`)
    - "Follow-Up: 30 May, Sat" (using `fmtShort`) — only if `x_studio_next_follow_up_date` exists and differs from proposed
  - **Date type pill**: same `"Proposed"` / `"Follow-Up"` pills as `VisitRow` (indigo vs slate)
  - **Status pill**: using `STATUS_CONFIG`
  - Clicking a card opens/closes an **inline `DetailPanel`** (same expand-in-place pattern as `VisitsTab` — track `selectedKey` state).

- Separate person groups with a visible divider.
- If the week has **no activities at all**, show a centred empty state: _"✅ No activities scheduled for this week."_

### "This Week" Calculation
```js
const getWeekRange = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay(); // 0 = Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  return { mon, sun };
};
```

Use this to check whether an ISO date string falls within the week:
```js
const inWeek = (iso) => {
  if (!iso) return false;
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date >= mon && date <= sun;
};
```

---

## Props Update

`TeamTab` currently receives: `{ leads, personRegion, personKeys, allRegions }`

After these changes it also needs:
- `engagements` — the full engagements array (same as passed to `VisitsTab`)
- `userMap` — the user ID → name lookup map (same as passed to `VisitsTab`)

Update the parent component that renders `<TeamTab>` to pass these two additional props.

---

## Style Consistency Rules

- All new UI must use `T.*` tokens for colors, **not** hardcoded hex values, except for urgency colors (`#EF4444`, `#FF9933`, `#F59E0B`) which are intentional semantic values shared with `VisitsTab.jsx`.
- Match existing card padding (`"20px 22px"`), section label style (`fontSize: 11, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, color: T.textMuted`), and border radius (`borderRadius: 12` for cards, `borderRadius: 100` for pills).
- Animations: reuse the existing `fadeIn` keyframe (`from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; }`) for panel expansions and drill-down transitions.
- Do **not** introduce any new external dependencies.
