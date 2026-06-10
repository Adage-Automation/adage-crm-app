# PipelineTab — Improvements & Bug Fix Specification for Kiro

## Context

The current `PipelineTab.jsx` implementation is complete and working as a base. This document covers only the **bugs to fix and improvements to make** — do not rewrite anything that is not mentioned here.

The file uses:
- `T` from `../constants/theme`, `REGION_COLORS`, `STAGE_COLORS`, `PERSON_COLORS` from `../constants/colors`, `fmt` from `../lib/format`
- Local constants: `URGENCY`, `getUrgency`, `fmtShort`, `STATUS_COLORS`, `PROJECT_TYPE_COLORS`, `getProjectTypePill`
- Local components: `MultiSelect`, `LeadDetailPanel`, `InteractiveDonut`, `RevenueDonut`, `GreenfieldDonut`, `MonthlyClosings`, `ListRow`, `KanbanCard`
- Main export: `PipelineTab`

The date field for closing dates throughout the file is `x_studio_expected_closing`. This is correct — do not change it.

The three-column chart layout (`RevenueDonut` | `GreenfieldDonut` | `MonthlyClosings`) is correct and intentional — do not change it.

---

## Bug Fix 1 — Donut Hover Glitch (Critical)

### Problem
When hovering over any donut segment, the segment expands outward (radius `52 → 56`). Because the `<circle>` element itself receives `onMouseEnter/onMouseLeave`, expanding the geometry shifts the circle's stroke boundary, causing the mouse cursor to momentarily fall outside the element, triggering `onMouseLeave`, which shrinks it back, which brings the cursor back in, which triggers `onMouseEnter` again — an infinite flicker loop. This is worst on the "Regret" segment and any small segment where the stroke boundary is close to the cursor.

### Fix
Split each segment into two overlapping SVG circles:

1. **Hit area circle** (transparent, always at max hover radius, receives all mouse events):
   - `r={R_HOVER}` always — never changes
   - `fill="none"`, `stroke="transparent"`
   - `strokeWidth={SW_HOVER + 8}` — slightly wider than the visual stroke to create a generous hit zone
   - `strokeDasharray` and `strokeDashoffset` calculated at `R_HOVER` radius
   - Has `onMouseEnter`, `onMouseLeave`, `onClick`
   - `cursor="pointer"`
   - Rendered **on top** (after the visual circle in DOM order)

2. **Visual circle** (colored, animates radius, no mouse events):
   - `r` and `strokeWidth` animate based on `hoveredKey === seg.key` state
   - `pointerEvents="none"` — never intercepts mouse events
   - Has the `style={{ transition: "r 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease" }}`
   - Rendered **below** the hit area circle

Because the hit area geometry never changes size, the mouse never leaves it during the visual expansion, eliminating the flicker entirely.

### Implementation note for `strokeDashoffset` on hit area
The hit area must use its own circumference (`2 * Math.PI * R_HOVER`) to calculate `strokeDasharray` and `strokeDashoffset`, since those are radius-dependent. Keep a separate `circ_hover = 2 * Math.PI * R_HOVER` constant alongside the existing `circ_base`.

Also ensure the center label `<div>` overlay has `pointerEvents: "none"` so it does not intercept hover events from segments rendered beneath it.

---

## Bug Fix 2 — Pie Chart Drill-Down Not Filtering (Critical)

### Problem
Clicking a donut segment calls `onSegmentClick(seg.key)` which sets `filterLeadStatus` or `filterProjectType` state. However the leads list does not update visibly. The root cause is a **value mismatch**: the segment key is built from `String(l.x_studio_lead_status)`, but Odoo may return the field as a Selection technical key (e.g. `"active"`) while the display label shown in the UI differs (e.g. `"ACTIVE"`). Same issue applies to `x_studio_project_background` — Odoo returns `false` (boolean) for empty fields, not `null`, which causes `String(false) = "false"` to appear as a segment key.

### Fix — `RevenueDonut` and its filter
In the `byStatus` accumulation inside `RevenueDonut`, normalize the key:
```js
const s = l.x_studio_lead_status ? String(l.x_studio_lead_status).trim() : null;
if (!s) return; // skip leads with no status
```

In `filteredLeads` inside `PipelineTab`, normalize the comparison too:
```js
if (filterLeadStatus) {
  const val = l.x_studio_lead_status ? String(l.x_studio_lead_status).trim() : null;
  if (val !== filterLeadStatus) return false;
}
```

### Fix — `GreenfieldDonut` and its filter
In the `counts` accumulation inside `GreenfieldDonut`:
```js
const k = l.x_studio_project_background && l.x_studio_project_background !== false
  ? String(l.x_studio_project_background).trim()
  : null;
if (!k) return; // skip leads with no project background
```

In `filteredLeads`:
```js
if (filterProjectType) {
  const val = l.x_studio_project_background && l.x_studio_project_background !== false
    ? String(l.x_studio_project_background).trim()
    : null;
  if (val !== filterProjectType) return false;
}
```

This ensures segment keys and filter comparisons always use the same normalized string value.

---

## Bug Fix 3 — `useState` Inside `.map()` in `MonthlyClosings` (Critical)

### Problem
Inside `MonthlyClosings`, the bar rendering calls `useState(false)` directly inside `entries.map(...)`. This violates the Rules of Hooks — hooks must only be called at the top level of a React function component, never inside loops or callbacks. This will cause React errors or silent state bugs in strict mode.

### Fix
Extract the individual bar into a separate `MonthBar` component that owns its own `hovered` state:

```jsx
function MonthBar({ monthKey, data, isSelected, maxRev, onBarClick }) {
  const [hovered, setHovered] = useState(false);
  const barH = Math.max(Math.round((data.rev / maxRev) * 90), 4);
  return (
    <div
      onClick={() => onBarClick(isSelected ? null : monthKey)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 44, flex: 1, cursor: "pointer" }}
    >
      <div style={{ fontSize: 9, color: isSelected ? T.accent : T.textMuted, fontWeight: isSelected ? 700 : 600, whiteSpace: "nowrap" }}>
        {fmt(data.rev)}
      </div>
      <div style={{
        width: "100%", height: barH, minHeight: 4, borderRadius: "4px 4px 0 0",
        background: isSelected ? T.accent : hovered ? T.accentBdr : "#CBD5E1",
        transition: "background 0.15s, transform 0.15s",
        transform: hovered ? "scaleY(1.04)" : "scaleY(1)",
        transformOrigin: "bottom",
        outline: isSelected ? `2px solid ${T.accent}` : "none",
        outlineOffset: 1,
      }} />
      <div style={{ fontSize: 10, color: isSelected ? T.accent : T.textSecondary, fontWeight: isSelected ? 700 : 400, whiteSpace: "nowrap" }}>
        {data.label}
      </div>
    </div>
  );
}
```

Replace the `entries.map` inside `MonthlyClosings` to render `<MonthBar>` instead of the inline div with the hook call.

---

## Fix 4 — Group Header Collapse on Full Header Click

### Problem
Currently, collapsing a group requires clicking the small `▲▼` button on the far right of the header. The entire header row should be clickable to toggle collapse.

### Fix
Move the `onClick` handler from the `▲▼` button to the entire group header `<div>`:

```jsx
<div
  onClick={() => viewMode === "list" && toggleCollapse(key)}
  style={{
    ...,
    cursor: viewMode === "list" ? "pointer" : "default",
    userSelect: "none",
  }}
>
```

Keep the `▲▼` button in the header as a **visual indicator only** — add `pointerEvents: "none"` to it so it does not double-fire the click or interfere with the header's own handler. In kanban mode, the header is not clickable (kanban groups are always expanded), hence the `viewMode === "list"` guard.

---

## Improvement 1 — Active Segment Visual Feedback on Donut

### Problem
When a donut segment is clicked and `filterLeadStatus` or `filterProjectType` is set, the segment looks identical to unselected ones after the mouse moves away. There is no persistent visual indicator that this segment is "active".

### Fix — visual circle
When a segment's key matches the active filter, apply a permanent SVG `filter` for a glow effect on the visual circle:

```jsx
filter={
  (filterKey === seg.key)
    ? `drop-shadow(0 0 5px ${seg.color}90)`
    : undefined
}
```

Where `filterKey` is the relevant active filter prop passed into `InteractiveDonut` as a new optional prop `activeKey`.

Also keep the segment at the expanded radius permanently when it is the active key:
```js
const isActive = activeKey === seg.key;
const r  = (isHov || isActive) ? R_HOVER : R_BASE;
const sw = (isHov || isActive) ? SW_HOVER : SW_BASE;
```

### Fix — legend row
In the legend, highlight the active segment's row with a colored left border and tinted background:

```jsx
style={{
  ...,
  borderLeft: activeKey === seg.key ? `3px solid ${seg.color}` : "3px solid transparent",
  background: activeKey === seg.key ? `${seg.color}12` : "transparent",
  borderRadius: 4,
  paddingLeft: 5,
}}
```

Pass `activeKey` into `InteractiveDonut` and thread it through to both the visual circle and legend row. Update `RevenueDonut` to pass `activeKey={filterLeadStatus}` and `GreenfieldDonut` to pass `activeKey={filterProjectType}`.

---

## Improvement 2 — `selectedLeadId` Cleared on View Mode Switch

### Problem
If a lead detail panel is open in list view and the user switches to kanban view, `selectedLeadId` remains set, causing a panel to render unexpectedly under a kanban card the user never clicked.

### Fix
Clear `selectedLeadId` whenever `viewMode` changes:

```js
const handleSetViewMode = (mode) => {
  setViewMode(mode);
  setSelectedLeadId(null);
};
```

Replace all `setViewMode(...)` calls with `handleSetViewMode(...)`.

---

## Improvement 3 — Collapsed State Ignored in Kanban Mode

### Problem
If a group is collapsed while in list view and the user switches to kanban, the group's cards are hidden because `isCollapsed` is still `true` in state.

### Fix
In the kanban render block, ignore `isCollapsed` entirely — always render kanban cards regardless of collapse state:

```jsx
// List view — respects isCollapsed
{!isCollapsed && viewMode === "list" && ( ... )}

// Kanban view — always renders, never checks isCollapsed
{viewMode === "kanban" && ( ... )}
```

This is already partially present in the current code but must be verified — the kanban block must not be wrapped in any `!isCollapsed` condition.

---

## Improvement 4 — `groupBy === "stage"` Group Sort Order

### Problem
When `groupBy` is `"stage"`, the group key sort uses `STATUS_ORDER` (a lead status array). This is incorrect — when grouping by stage, the groups should be sorted by the order stages appear in the `stages` prop.

### Fix
In the group key sorting block:

```js
else if (groupBy === "stage") {
  keys.sort((a, b) => {
    const ia = stages.findIndex(s => s.name === a);
    const ib = stages.findIndex(s => s.name === b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
```

---

## Improvement 5 — `selectedMonth` Included in Active Filter Banner

### Problem
The dismissible filter banner below the charts shows pills for `filterLeadStatus` and `filterProjectType`, but not for `selectedMonth`. The monthly bar chart has its own inline clear button, but there is no consistent indicator in the shared banner row.

### Fix
Add a third pill to the existing banner `<div>` for `selectedMonth`:

```jsx
{selectedMonth && (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}40` }}>
    Closing: {monthMap[selectedMonth]?.label || selectedMonth}
    <button onClick={() => setSelectedMonth(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
  </span>
)}
```

Note: `monthMap` is currently local to `MonthlyClosings`. To reference it in the banner, either lift `monthMap` computation up to `PipelineTab` level via `useMemo`, or derive the label directly from `selectedMonth` string in place:
```js
const [sy, sm] = selectedMonth.split("-").map(Number);
const label = `${MONTHS_SHORT[sm - 1]} '${String(sy).slice(2)}`;
```

Where `MONTHS_SHORT` is the existing local constant.

Show the banner `<div>` whenever any of the three filters is active:
```jsx
{(filterLeadStatus || filterProjectType || selectedMonth) && ( ... )}
```

---

## Improvement 6 — Remove Unused `STAGE_COLORS` Import

`STAGE_COLORS` is imported from `../constants/colors` but is not referenced anywhere in the current implementation. Remove it from the import line to keep the file clean.

---

## Summary Checklist for Kiro

| # | Type | Description |
|---|---|---|
| Bug 1 | Critical | Donut hover glitch — split visual and hit-area circles, `pointerEvents="none"` on visual |
| Bug 2 | Critical | Drill-down not working — normalize field values before segment key assignment and filter comparison |
| Bug 3 | Critical | `useState` inside `.map()` in `MonthlyClosings` — extract `MonthBar` component |
| Fix 4 | UX | Group header collapse on full header click, not just the chevron button |
| Imp 1 | UX | Persistent active-segment glow + legend highlight when a donut segment is clicked |
| Imp 2 | UX | Clear `selectedLeadId` when view mode switches |
| Imp 3 | UX | Kanban cards always visible regardless of collapse state |
| Imp 4 | Logic | `groupBy === "stage"` sorts groups by `stages` prop order, not `STATUS_ORDER` |
| Imp 5 | UX | `selectedMonth` appears in the shared active filter banner with its own clear pill |
| Imp 6 | Cleanup | Remove unused `STAGE_COLORS` import |
