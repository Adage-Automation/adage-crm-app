## Task

Build a **Team Activity Swimlane View** as a new tab/view inside this existing React app. Use the same `fetchOdoo()` pattern already in `App.jsx`. This is **not** an Odoo addon — no OWL, no `__manifest__.py`, no addon structure.

---

## Data Source

Use the existing `fetchOdoo()` pattern to make two API calls:

**Call 1** — Search-read `x_crm_lead_line_1519d` with a domain filtering `x_studio_proposed_date` OR `x_studio_next_follow_up_date` within the selected month.

Fetch these fields:

| Field | Label |
|---|---|
| `x_studio_proposed_date` | Proposed Date |
| `x_studio_visit_date` | Actual Interaction Date |
| `x_studio_next_follow_up_date` | Next Follow Up Date |
| `x_studio_engagement_type` | Engagement Type |
| `x_studio_engagement_status` | Engagement Status |
| `x_studio_visit_by` | Assigned Salesperson (many2many → `hr.employee`) |
| `x_crm_lead_id` | Lead |
| `x_studio_remarkscomments` | Remarks/Comments |

**Call 2** — From the collected `x_crm_lead_id` values, search-read `crm.lead` for `partner_id` and `expected_revenue`.

---

## Swimlane Layout

- **Rows** = one per unique employee from `x_studio_visit_by`. Since it is many2many, one activity assigned to multiple employees must appear as a pill in each of their rows — expand this client-side after fetching.
- **Columns** = every calendar day of the selected month labeled as a number. Weekends (Sat/Sun) visually dimmed but still present.
- **Primary pill** = placed in the column of `x_studio_proposed_date` (single date, never a range). Shows engagement type + truncated customer name.
- **Follow-up ghost pill** = if `x_studio_next_follow_up_date` exists and falls within the viewed month, render a second lighter dashed-border pill in that date's column labeled "Follow-up: [customer name]".
- If `x_studio_proposed_date` is null for a record, skip it silently — do not crash.

---

## Pill Colors by `x_studio_engagement_status`

| Status | Style |
|---|---|
| Planned | Green solid fill |
| Completed | Blue solid fill |
| Rescheduled | Orange solid fill |
| Cancelled | Gray solid fill, strikethrough text |

**Anomaly flag:** If `x_studio_visit_date` is filled but `x_studio_engagement_status` is still "Planned", show a ⚠ icon on the pill. This means the visit happened but the status was never updated.

---

## Tooltip on Hover (per pill)

Show all of the following if available:

- Customer name (from `crm.lead` → `partner_id.name`)
- Engagement type
- Deal value (`expected_revenue` formatted in ₹)
- Status
- Proposed date
- Actual interaction date (if filled)
- Next follow-up date (if filled)
- Remarks/Comments (if filled)

---

## Header Controls

- Left / right arrows + month + year label (e.g. "June 2026")
- "Today" button to return to the current month
- Multi-select dropdown to filter visible rows by salesperson

---

## Summary Bar (bottom of view)

Fixed bar showing counts for the visible month:

- Total activities
- Planned (green)
- Completed (blue)
- Rescheduled (orange)
- Cancelled (gray)
- ⚠ Anomaly count (visit done but status not updated)

---

## Deliverables — Exact Files to Produce

| File | Purpose |
|---|---|
| `src/SwimlaneView.jsx` | New React component — all state, fetch, grouping, and rendering logic self-contained |
| `App.jsx` (edit only) | Add `SwimlaneView` as a new tab alongside existing views — do not remove or modify any existing tab or component |

---

## Constraints

- React only — no new libraries, no OWL, no Odoo addon structure
- Use plain CSS consistent with the existing project styling
- Do **not** modify `.env`, `vite.config.js`, `main.jsx`, or any existing component other than adding the new tab entry in `App.jsx`
- No `__manifest__.py`, no XML views, no asset bundles

---

## Critical Implementation Notes

> **Many2many employee expansion** — `x_studio_visit_by` is many2many, not many2one. An activity assigned to multiple employees must produce a pill in each of their rows. Expand this client-side after the API response — do not treat it as a single value.

> **Single date columns** — `x_studio_proposed_date` is always one date. Pills sit in exactly one column. There are no date ranges.

> **Non-destructive integration** — Only add `SwimlaneView.jsx` as a new file and insert the new tab in `App.jsx`. Do not touch any other existing file.