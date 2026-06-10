# Kiro Prompt: Refactor App.jsx into Clean Component Architecture

## Context

I have a React CRM dashboard (`App.jsx`) that has grown into a single large file (~700+ lines). It contains:

- A root `App` component with all state, data fetching, and rendering logic
- Five tab views rendered inline: **Overview**, **Pipeline**, **Visits**, **Team View**, and **Swimlane/Calendar**
- A **Calendar Day Popup** overlay rendered inline at the bottom
- Shared constants: `T` (theme tokens), `REGION_COLORS`, `STAGE_COLORS`, `PERSON_COLORS`, `ODOO_BASE`, `API_KEY`
- Shared utility functions: `fetchOdoo`, `fmt`, `fmtDate`, `getPersonName`, `getPersonNames`
- A `SwimlaneView` component already split out in `SwimlaneView.jsx`

## Goal

Refactor `App.jsx` so that:

1. Each tab view is extracted into its **own component file** under `src/views/`
2. Shared constants, colors, and utility functions are extracted into dedicated files under `src/lib/` or `src/constants/`
3. The `App.jsx` file becomes a **clean orchestrator** — it only handles:
   - State declarations
   - Data fetching (`loadData`)
   - Derived computations (aggregations like `byRegion`, `byStage`, etc.)
   - Tab routing (rendering the correct view)
   - The sticky header + tab nav
4. No logic or JSX beyond the above should remain in `App.jsx`

---

## Exact File Structure to Create

```
src/
├── App.jsx                          ← cleaned orchestrator only
├── SwimlaneView.jsx                 ← already exists, leave untouched
├── constants/
│   ├── theme.js                     ← export const T = { ... }
│   └── colors.js                    ← REGION_COLORS, STAGE_COLORS, PERSON_COLORS, GB_COLORS, PB_COLORS
├── lib/
│   ├── odoo.js                      ← fetchOdoo, ODOO_BASE, API_KEY
│   └── format.js                    ← fmt(), fmtDate(), getPersonName(), getPersonNames()
└── views/
    ├── OverviewTab.jsx
    ├── PipelineTab.jsx
    ├── VisitsTab.jsx
    ├── TeamTab.jsx
    └── CalendarDayPopup.jsx
```

---

## Extraction Rules Per File

### `src/constants/theme.js`
Extract the entire `T` object (the `const T = { ... }` block with all design tokens). Export as named export.

### `src/constants/colors.js`
Extract all color maps:
- `REGION_COLORS`
- `STAGE_COLORS`
- `PERSON_COLORS`
- `GB_COLORS`
- `PB_COLORS`

Export each as a named export.

### `src/lib/odoo.js`
Extract:
- `ODOO_BASE` constant
- `API_KEY` constant
- `fetchOdoo` async function

Export all three as named exports.

### `src/lib/format.js`
Extract:
- `fmt(n)` — formats a number as ₹ crores / lakhs / K
- `fmtDate(d)` — formats a date string to Indian locale
- `getPersonName(p)` — resolves a person from a Many2many field value
- `getPersonNames(persons, userMap)` — resolves all persons from an array, returns joined string

> ⚠️ `getPersonName` and `getPersonNames` currently use `userMap` from closure scope in `App.jsx`. When extracting, pass `userMap` as a parameter to both functions.

### `src/views/OverviewTab.jsx`
Extract the entire `{activeTab === "overview" && (...)}` block.

**Props it needs:**
```js
{
  leads,           // array
  data,            // full data object (for closedLeads)
  engagements,     // array
  totalRev,        // number
  hotLeads,        // array
  plannedVisits,   // array
  wonLeads,        // array
  lostLeads,       // array
  winRate,         // number | null
  overdueLeads,    // array
  overdueRev,      // number
  byRegion,        // object
  byStage,         // object
  gbEntries,       // array
  pbEntries,       // array
  gbTotal,         // number
  pbTotal,         // number
  hotSorted,       // array
  selectedLead,    // object | null
  setSelectedLead, // function
}
```

### `src/views/PipelineTab.jsx`
Extract the `{activeTab === "pipeline" && (...)}` block.

**Props it needs:**
```js
{
  leads,   // array
  stages,  // array (data.stages)
}
```

### `src/views/VisitsTab.jsx`
Extract the `{activeTab === "visits" && (...)}` block.

**Props it needs:**
```js
{
  leads,          // array
  engagements,    // array
  plannedVisits,  // array
  upcomingVisits, // array
  userMap,        // object
}
```

### `src/views/TeamTab.jsx`
Extract the `{activeTab === "team" && (...)}` block.

**Props it needs:**
```js
{
  leads,         // array
  personRegion,  // object
  personKeys,    // array
  allRegions,    // array
}
```

### `src/views/CalendarDayPopup.jsx`
Extract the `{popupDay && (() => { ... })()}` block at the bottom of the return.

**Props it needs:**
```js
{
  popupDay,        // object | null
  setPopupDay,     // function
  popupDetail,     // object | null
  setPopupDetail,  // function
  leads,           // array
  userMap,         // object
}
```

---

## What Should Remain in `App.jsx` After Refactor

`App.jsx` should only contain:

1. **Imports** — React hooks, all view components, lib/constants
2. **State declarations** — `activeTab`, `data`, `loading`, `error`, `calMonth`, `calViewMode`, `calFilterPerson`, `calFilterStatus`, `popupDay`, `popupDetail`, `selectedLead`, `userMap`
3. **`loadData` callback** — the full `useCallback` block with all three fetch steps and `setUserMap` / `setData`
4. **Derived variables** — all aggregations computed from `leads` and `engagements`: `byRegion`, `byStage`, `byIndustry`, `byCustomerType`, `byProjectBg`, `personRegion`, `gbEntries`, `pbEntries`, etc.
5. **Sorted/filtered slices** — `hotSorted`, `upcomingVisits`, `overdueLeads`, `personKeys`, `allRegions`, etc.
6. **JSX** — only the outer shell:
   - The global `<style>` block
   - The sticky header with tab buttons and Refresh
   - The loading spinner
   - The error banner
   - One `{activeTab === "X" && <XTab ...props />}` line per tab
   - `<CalendarDayPopup ...props />` at the bottom

---

## Constraints

- Do **not** change any logic, styling, or behavior — this is a pure structural refactor
- All color maps, theme tokens, and helper functions used inside a view must be imported from the correct `constants/` or `lib/` file — do not re-declare them inside view files
- Keep the `SwimlaneView.jsx` import path unchanged: `"./SwimlaneView"`
- Use named exports everywhere; no default exports except for the component in each file
- Each view file should import only what it actually uses
- `getPersonName` inside view files should receive `userMap` as a parameter (or via props), since it no longer has closure access to `App`'s state

---

## Acceptance Criteria

- [ ] `App.jsx` is under 120 lines (excluding imports)
- [ ] No inline tab rendering logic remains in `App.jsx`
- [ ] Each view in `src/views/` is self-contained and importable independently
- [ ] All shared utilities come from `src/lib/` — no duplication
- [ ] App runs and all five tabs render identically to before the refactor
- [ ] `CalendarDayPopup` opens and shows detail view correctly
- [ ] No console errors related to undefined props or missing imports
