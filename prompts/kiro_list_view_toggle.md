# Kiro Prompt — List View Toggle for Swimlane

## Change

Add a **Grid / List toggle** (top-right corner of the `SwimlaneView.jsx` card) that switches between the existing swimlane grid and a new list view. The existing swimlane is "Grid". The new view is "List".

---

## List View Layout

Group records by **month** (e.g. "May 2026", "June 2026"), each with a count badge next to the heading. Under each month, render a table with these exact columns — no more, no less:

| Column | Field | Notes |
|---|---|---|
| PROPOSED DATE | `x_studio_proposed_date` | Formatted as "28 May, Thu" |
| PERSON | `x_studio_visit_by` (many2many → `hr.employee`) | Each name on its own line, colored by consistent per-person color matching swimlane |
| CUSTOMER | `partner_id.name` from linked `crm.lead` | Plain text |
| ORDER VALUE | `expected_revenue` from linked `crm.lead` | Formatted in ₹, green bold |
| TYPE | `x_studio_engagement_type` | Pill/badge with emoji matching swimlane (✉️ Email, 📞 Phone Call, 🤝 Meeting, 🏛️ Exhibition) |
| STATUS | `x_studio_engagement_status` | Pill/badge, color matches swimlane (green = Planned, blue = Completed, orange = Rescheduled, gray = Cancelled) |
| ACTUAL DATE | `x_studio_visit_date` | Formatted as "28 May, Thu"; show "—" if empty |
| NEXT FOLLOW-UP | `x_studio_next_follow_up_date` | Formatted as "28 May, Thu"; show "—" if empty |
| REMARKS | `x_studio_remarkscomments` | Truncated to one line with ellipsis; full text visible in detail panel |

Do **not** add any column not listed above (no Region, no external fields beyond `partner_id.name` and `expected_revenue` from `crm.lead`).

Each row should have a subtle hover state. Clicking a row opens the same detail panel that exists in Grid view. If `x_studio_visit_date` is filled but status is still "Planned", show the ⚠ anomaly icon in the STATUS column.

---

## Filters

The List view must use the **exact same filter controls** already present in the swimlane header:
- Salesperson multi-select dropdown
- Month / Week / Day toggle (drives which records are shown — e.g. Week view shows only that week's records in the list)
- Prev / Next navigation and Today button

Do not add new filters. Do not duplicate filter UI. The same filter state drives both Grid and List views — switching between Grid and List must preserve the current filter selections.

---

## Constraints

- All changes inside `SwimlaneView.jsx` only
- No new libraries
- Default view on load remains Grid (swimlane)
- The Grid / List toggle sits top-right, styled as two segmented buttons matching the Month / Week / Day toggle style already in the component
