# Kiro Prompt — Make.com-Inspired Visual Retheme for ADAPT Dashboard

## Objective

Restyle the ADAPT CRM dashboard to be aesthetically inspired by **Make.com's UI language** — clean white/near-white backgrounds, Adage brand teal `#02818A` as the primary accent, sharp geometric card shapes with subtle shadows, crisp Inter typography, and muted cool-grey supporting tones. No dark mode. Light, professional, modern SaaS feel.

---

## Reference Visual Language (Make.com)

| Element | Make.com Style |
|---|---|
| Background | Pure white `#FFFFFF` or very light grey `#F7F7FA` |
| Cards | White with subtle `box-shadow`, no heavy borders |
| Accent / primary | Adage brand teal `#02818A` |
| Accent light bg | `#E6F4F5` (teal tint) |
| Accent border | `#9DD0D4` |
| Text primary | Near-black `#111827` |
| Text secondary | Medium grey `#6B7280` |
| Text muted | Light grey `#9CA3AF` |
| Borders | Very light `#E5E7EB` |
| Success / green | `#059669` |
| Warning / orange | `#D97706` |
| Danger / red | `#DC2626` |
| Tag / badge bg | Soft tinted pill, e.g. `#F3F4F6` with `#374151` text |
| Font | Inter (already in use — keep it) |
| Border radius | Cards: `12px`, buttons: `8px`, tags: `100px` |
| Shadow | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| Hover shadow | `0 4px 12px rgba(0,0,0,0.10)` |

---

## File to Edit

**`src/constants/theme.js`** (or `theme.ts`)

Replace the entire export object (the `T` constant) with the following:

```js
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  bgPage:       "#F7F7FA",       // page/app background
  bgCard:       "#FFFFFF",       // kanban card, list row, panels
  bgCardAlt:    "#F9F9FB",       // hovered card or alternate row
  bgSidebar:    "#FFFFFF",       // sidebar/header if applicable

  // ── Borders ──────────────────────────────────────────────────────────────────
  border:       "#E5E7EB",       // default card/container border
  borderMd:     "#D1D5DB",       // medium emphasis border (inputs, dividers)

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:  "#111827",       // headings, lead names
  textSecondary:"#374151",       // body / field values
  textMuted:    "#9CA3AF",       // labels, secondary metadata

  // ── Accent (Adage brand teal) ────────────────────────────────────────────────
  accent:       "#02818A",       // buttons, links, highlights, active states
  accentHover:  "#026E76",       // accent on hover (slightly darker)
  accentBg:     "#E6F4F5",       // accent-tinted background (selected, badge bg)
  accentBdr:    "#9DD0D4",       // accent-tinted border

  // ── Semantic ─────────────────────────────────────────────────────────────────
  success:      "#059669",       // deal value, won status
  successBg:    "#D1FAE5",
  warning:      "#D97706",       // urgent closing date
  warningBg:    "#FEF3C7",
  danger:       "#DC2626",       // overdue
  dangerBg:     "#FEE2E2",

  // ── Shadows ──────────────────────────────────────────────────────────────────
  shadowSm:     "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:     "0 4px 12px rgba(0,0,0,0.10)",
};
```

---

## Additional Style Adjustments (in PipelineTab.jsx)

After updating `theme.js`, apply these targeted tweaks in `PipelineTab.jsx` to complete the Make.com look:

### 1. KanbanCard root `div` — replace border + add shadow

```jsx
// Replace the border and add box-shadow
border: `1px solid ${T.border}`,
boxShadow: hovered ? T.shadowMd : T.shadowSm,
borderRadius: 12,
// Remove the borderLeft urgency coloring — move urgency signal to a top-left dot instead (see below)
```

### 2. Urgency indicator — replace left border with a coloured dot in the name row

Instead of `borderLeft: 4px solid urg.border`, add a small coloured circle next to the lead name:

```jsx
{/* Urgency dot */}
{closingDate && (
  <span style={{
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: urg.border === "transparent" ? "transparent" : urg.border,
    flexShrink: 0,
    marginTop: 3,
  }} />
)}
```

Place this dot inline with the lead name `div` using a flex row wrapper:

```jsx
<div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
  {/* urgency dot here */}
  <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, lineHeight: 1.4, wordBreak: "break-word" }}>
    {lead.name}
  </div>
</div>
```

### 3. Status tags — use tinted pill style (Make.com badge language)

Update the status badge to use a softer pill with no hard border:

```jsx
// CONVERTED TO RFQ
background: "#EDE9FE", color: "#6D28D9"   // purple tint

// ACTIVE
background: "#D1FAE5", color: "#065F46"   // green tint

// LOST / DEAD
background: "#FEE2E2", color: "#991B1B"   // red tint

// default / fallback
background: "#F3F4F6", color: "#374151"   // neutral grey
```

Update `STATUS_COLORS` to return objects `{ bg, text }` and apply both in the badge render:

```jsx
const STATUS_PILL = {
  "CONVERTED TO RFQ": { bg: "#E6F4F5", text: "#02818A" },
  "ACTIVE":           { bg: "#D1FAE5", text: "#065F46" },
  "LOST":             { bg: "#FEE2E2", text: "#991B1B" },
  "DEAD":             { bg: "#FEE2E2", text: "#991B1B" },
};
const getPill = (val) => STATUS_PILL[val] || { bg: "#F3F4F6", text: "#374151" };

// In the badge JSX:
const pill = getPill(statusVal);
<span style={{
  fontSize: 10, fontWeight: 700,
  padding: "2px 8px", borderRadius: 100,
  background: pill.bg, color: pill.text,
  border: "none",
}}>
  {statusVal}
</span>
```

### 4. "View in Odoo →" button — Make.com action button style

```jsx
<a style={{
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  background: T.accentBg,
  color: T.accent,
  border: `1px solid ${T.accentBdr}`,
  textDecoration: "none",
  transition: "background 0.15s, box-shadow 0.15s",
  letterSpacing: "0.2px",
}}>
  View in Odoo →
</a>
```

### 5. Field label style — Make.com uppercase label treatment

```jsx
// Labels: lighter grey, smaller, wider letter-spacing
fontSize: 9,
color: T.textMuted,
fontWeight: 600,
letterSpacing: "0.8px",
textTransform: "uppercase",
marginBottom: 2,
```

### 6. Group header row (region group label) — update background

```jsx
// Group row: white bg, left teal accent line
background: "#FFFFFF",
borderLeft: `3px solid #02818A`,
paddingLeft: 12,
borderRadius: 6,
```

### 7. Filter bar buttons (MultiSelect) — round pill style

```jsx
// Filter chip buttons
borderRadius: 100,      // fully rounded pill (Make.com filter chips)
padding: "5px 14px",
fontSize: 12,
fontWeight: 500,
```

---

## Page Background

In `App.jsx` or the root layout wrapper, set the page background:

```jsx
style={{ background: "#F7F7FA", minHeight: "100vh" }}
```

---

## Do NOT Change

- All data-fetching logic
- All filter/grouping logic
- Field names and API calls
- The `LeadDetailPanel` component behaviour
- Any `.env` variables or Odoo connection config
- The `REGION_COLORS` and `PERSON_COLORS` constants (keep those as-is for region identity)

---

## Expected Result

The ADAPT dashboard should feel visually consistent with Make.com's SaaS aesthetic:
- Light, airy white page background
- Cards floating with subtle shadows (no heavy outlines)
- Adage brand teal `#02818A` as the single strong accent colour for interactive elements
- Soft tinted badge pills for status tags
- Crisp Inter typography with proper label/value hierarchy
- No dark backgrounds, no neon colours, no heavy borders
