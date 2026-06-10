## Issues to Fix

### 1. Pill Overflow — Pills Must Stay Within Their Date Column

**Current problem:** Pills are overflowing into adjacent date columns, making activities look like they span multiple days.

**Fix:**
- Each date column must have `overflow: hidden` and a fixed width
- Pills inside a column must be constrained to 100% of the column width
- Use `text-overflow: ellipsis`, `white-space: nowrap`, and `overflow: hidden` on pill text
- Pills must **never** bleed into the next column under any screen size
- If multiple pills exist on the same date for the same person, stack them **vertically** within the cell — do not let them push sideways
- The column width must be uniform and rigid across all rows and the header row

---

## New Features to Add

### 2. Time Range Filter — Month / Week / Day

Add a segmented toggle control in the header (next to the month navigator) with three options:

| View | Behaviour |
|---|---|
| **Month** | Shows all days of the selected month (current behaviour) |
| **Week** | Shows only the 7 days of the selected week. Week starts on Monday. |
| **Day** | Shows a single selected day. Rows remain the same (one per salesperson). Columns collapse to just one date. |

**Default view on load: Week**

**Navigation behaviour per view:**
- Month view → prev/next moves by one month
- Week view → prev/next moves by one week. Show the week range in the header (e.g. "2 Jun – 8 Jun 2026")
- Day view → prev/next moves by one day. Show the full date in the header (e.g. "Tuesday, 2 Jun 2026")

**"Today" button** must always jump to the current period in whatever view is active:
- Month view → current month
- Week view → current week
- Day view → today

---

### 3. Activity Detail Panel

Add a **detail panel** in the white space below the summary/legend bar. It should be empty and hidden by default, and appear when a pill is clicked.

**Behaviour:**
- Clicking any pill (primary or follow-up ghost) opens the detail panel below
- Clicking the same pill again or pressing a close (×) button collapses the panel
- Only one activity is shown at a time — clicking a different pill replaces the current detail

**Detail panel content (show all available fields):**

| Label | Field |
|---|---|
| Customer | `partner_id.name` from linked `crm.lead` |
| Deal Value | `expected_revenue` formatted as ₹ |
| Engagement Type | `x_studio_engagement_type` |
| Status | `x_studio_engagement_status` (with color badge matching pill color) |
| Assigned To | All employees from `x_studio_visit_by` (comma-separated) |
| Proposed Date | `x_studio_proposed_date` |
| Actual Interaction Date | `x_studio_visit_date` (show "Not recorded" if empty) |
| Next Follow-Up Date | `x_studio_next_follow_up_date` (show "None" if empty) |
| Remarks / Comments | `x_studio_remarkscomments` (show "—" if empty) |
| ⚠ Anomaly Warning | If `x_studio_visit_date` is filled but status is still "Planned", show a warning: "Visit recorded but status not updated" |

**Panel design:**
- Sits below the legend/summary bar, inside the same card/container
- Smooth expand/collapse animation
- Clean two-column label + value layout
- Clearly shows which activity is selected (highlight the active pill with a visible outline/ring)

---

## Summary of All Changes

| # | Change | Type |
|---|---|---|
| 1 | Pills contained within date column — no overflow | Bug fix |
| 2 | Month / Week / Day toggle with correct navigation | New feature |
| 3 | Default view set to Week on load | Behaviour change |
| 4 | Activity detail panel below legends on pill click | New feature |

---

## Constraints

- Do not modify any file other than `SwimlaneView.jsx` and its associated CSS
- Do not add any new npm libraries
- Keep all existing props, data fetch logic, and `fetchOdoo()` calls intact — only change rendering and UI state
- The detail panel must be part of `SwimlaneView.jsx` — do not create a separate modal or component file unless absolutely necessary
- All layout must remain responsive and horizontally scrollable on smaller screens
