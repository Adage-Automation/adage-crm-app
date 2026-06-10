# Kiro Prompt: SwimlaneView — Proposed/Follow-Up Bridge Line + Icon Legend

## Context

In `SwimlaneView.jsx`, when an engagement has both `x_studio_proposed_date` and
`x_studio_next_follow_up_date`, the grid renders two pills in the same
salesperson row — a solid pill on the proposed date column and a dashed pill on
the follow-up date column. These need to be visually connected by a thin
horizontal line (not a shaded region or filled rectangle — just a line).

The current implementation draws a filled shaded rectangle as the bridge, which
overlaps unrelated pills that fall in columns between the two linked pills.
Replace the filled bridge entirely with a simple line, and fix the overlap issue.

---

## Change 1 — Replace Filled Bridge with a Simple Line

### Remove the existing bridge implementation

Delete all current bridge/shaded-region rendering code — the `position: absolute`
filled rectangle, the `bridgeSlots` Set, the collision `marginTop` logic, and
any opacity background divs added for the bridge. Remove it all cleanly.

### New implementation — thin connector line only

After building `byDay` for each row, do a pass to find linked pairs:
- Same `engagement.id`, one item with `isFollowUp === false` (proposed) and one
  with `isFollowUp === true` (follow-up)
- Both dates must fall within the current visible `days` array

For each linked pair, render a single `position: absolute` horizontal line
inside the row's day-cell wrapper:

```
left      = ROW_LABEL_W + proposedDayIdx * COL_W + (COL_W / 2)
width     = (followUpDayIdx - proposedDayIdx) * COL_W
top       = 50%
transform = translateY(-50%)
height    = 2px
```

Style:
- `background`: `STATUS_CONFIG[status].bg` — solid, full opacity, same color
  as the pill
- `borderRadius: 1px`
- `zIndex: 0` — renders behind pills
- `pointerEvents: none`

The line starts from the horizontal center of the proposed pill's column and
ends at the horizontal center of the follow-up pill's column. It sits at the
vertical midpoint of the row. Pills render above it via `zIndex: 1`.

### No collision handling needed

Because the bridge is now just a 2px line at vertical center, it does not
visually block or overlap any pill. Do not add `marginTop`, sub-rows, or any
stacking logic for other pills. Pills in columns between the two linked pills
render normally — the thin line passes behind them.

### Row wrapper requirement

The day-cell strip div for each row needs `position: relative` so the
`position: absolute` line is contained within the row. If it already has this,
no change needed.

---

## Change 2 — Engagement Type Icon Legend

Add a legend bar directly below the existing summary bar ("4 activities
● 3 Planned…") with `marginTop: 6px`.

```jsx
<div style={{
  display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
  padding: "10px 16px", background: T.bgCard,
  border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12,
  marginTop: 6,
}}>
  <span style={{
    fontSize: 10, fontWeight: 700, color: T.textMuted,
    letterSpacing: "0.8px", textTransform: "uppercase", flexShrink: 0,
  }}>
    Activity Types
  </span>
  {[
    { emoji: "✉️",  label: "Email" },
    { emoji: "📞", label: "Phone Call" },
    { emoji: "🤝", label: "Meeting" },
    { emoji: "🏛️", label: "Exhibition" },
    { emoji: "📌", label: "Other" },
  ].map(({ emoji, label }) => (
    <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, color: T.textSecondary }}>
      <span style={{ fontSize: 14 }}>{emoji}</span>
      <span>{label}</span>
    </span>
  ))}
</div>
```

---

## Acceptance Criteria

- [ ] Bridge is a thin 2px horizontal line — no filled rectangle, no shading,
      no background region of any kind
- [ ] Line color matches the engagement's status color, full opacity
- [ ] Line runs from the center of the proposed pill's column to the center of
      the follow-up pill's column
- [ ] Pills in columns between the linked pair render at their normal vertical
      position — no marginTop, no sub-row, no displacement
- [ ] All pills render above the line (zIndex: 1 on pills, zIndex: 0 on line)
- [ ] No bridge drawn when follow-up date is outside the visible range
- [ ] Icon legend bar appears below the summary bar, matching its card style
- [ ] No regressions in List view, Detail panel, filters, or navigation