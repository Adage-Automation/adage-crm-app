import { useState, useMemo, useRef, useEffect } from "react";
import { T } from "../constants/theme";
import { REGION_COLORS, PERSON_COLORS } from "../constants/colors";
import { fmt } from "../lib/format";

// ─── Local constants ──────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtShort = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}, ${DAYS_SHORT[dt.getDay()]}`;
};

const URGENCY = {
  overdue: { border: "#EF4444", dateColor: "#EF4444" },
  urgent: { border: "#FF9933", dateColor: "#FF9933" },
  soon: { border: "#e9f50bff", dateColor: "#e9f50bff" },
  none: { border: "transparent", dateColor: T.textPrimary },
};
const getUrgency = (iso) => {
  if (!iso) return "none";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date - today) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 2) return "urgent";
  if (diff <= 7) return "soon";
  return "none";
};

// ─── Make.com-style status pill colours ──────────────────────────────────────
const STATUS_PILL = {
  "CONVERTED TO RFQ": { bg: "#E6F4F5", text: "#065F46" },
  "ACTIVE": { bg: "#ffe2afff", text: "#ea9400ff" },
  "LOST": { bg: "#FEE2E2", text: "#991B1B" },
  "DEAD": { bg: "#FEE2E2", text: "#991B1B" },
  "REGRET": { bg: "#FEE2E2", text: "#991B1B" },
};
const getPill = (val) => STATUS_PILL[val] || { bg: "#F3F4F6", text: "#374151" };

// ─── MultiSelect (same pattern as VisitsTab) ──────────────────────────────────
function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  const isActive = selected.length > 0;
  const btnLabel = !isActive ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: "5px 14px", borderRadius: 100,
        border: `1px solid ${isActive ? T.accent : T.border}`,
        background: isActive ? T.accentBg : T.bgCard,
        color: isActive ? T.accent : T.textSecondary,
        fontSize: 12, fontFamily: "inherit", fontWeight: 500,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
      }}>
        <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>{btnLabel}</span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 180, maxHeight: 240, overflowY: "auto" }}>
          {options.map(opt => (
            <div key={opt} onClick={() => toggle(opt)} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: selected.includes(opt) ? T.accentBg : "transparent", color: selected.includes(opt) ? T.accent : T.textPrimary }}>
              <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `1.5px solid ${selected.includes(opt) ? T.accent : T.borderMd}`, background: selected.includes(opt) ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selected.includes(opt) && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
              </div>
              {opt}
            </div>
          ))}
          {options.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No options</div>}
        </div>
      )}
    </div>
  );
}

// ─── Lead Card (used in both List and Kanban views) ───────────────────────────
export function LeadCard({ lead, onClose }) {
  const [hovered, setHovered] = useState(false);
  if (!lead) return null;
  const urg = URGENCY[getUrgency(lead.x_studio_expected_closing)];
  const closingDate = fmtShort(lead.x_studio_expected_closing);
  const regionColor = REGION_COLORS[lead.x_studio_responsible_region_1] || T.textMuted;
  const statusVal = lead.x_studio_lead_status;
  const pill = getPill(statusVal);

  const Field = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: color || T.textPrimary, fontWeight: 500, lineHeight: 1.35 }}>{value || "—"}</div>
    </div>
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgCardAlt : T.bgCard,
        border: `1px solid ${T.border}`,
        boxShadow: hovered ? T.shadowMd : T.shadowSm,
        borderRadius: 12,
        padding: "12px 14px",
        transition: "all 0.15s",
        marginBottom: onClose ? 12 : 8,
        marginTop: onClose ? 8 : 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        position: "relative"
      }}
    >
      {onClose && (
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "50%", cursor: "pointer", fontSize: 14, color: T.textMuted, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>×</button>
      )}

      {/* Row 1: Status + project type + region tags */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", paddingRight: onClose ? 24 : 0 }}>
        {statusVal && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: pill.bg, color: pill.text }}>
            {statusVal}
          </span>
        )}
        {lead.x_studio_project_background && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: getProjectTypePill(lead.x_studio_project_background).bg, color: getProjectTypePill(lead.x_studio_project_background).color }}>
            {lead.x_studio_project_background}
          </span>
        )}
        {lead.x_studio_responsible_region_1 && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: `${regionColor}18`, color: regionColor }}>
            {lead.x_studio_responsible_region_1}
          </span>
        )}
      </div>

      {/* Row 2: Lead name with urgency dot */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        {closingDate && (
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
            background: urg.border === "transparent" ? "transparent" : urg.border,
            flexShrink: 0, marginTop: 4,
          }} />
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, lineHeight: 1.4, wordBreak: "break-word" }}>
          {lead.name}
        </div>
      </div>

      {/* Row 3: Company */}
      <Field label="Company" value={lead.partner_id?.[1] || lead.partner_name} />

      {/* Row 4: Grid */}
      <div style={{ display: "grid", gridTemplateColumns: onClose ? "repeat(auto-fit, minmax(140px, 1fr))" : "1fr 1fr", gap: "8px 12px" }}>
        <Field label="Salesperson" value={lead.x_studio_assigned_salesperson?.[1]} />
        <Field label="Sales Lead" value={lead.x_studio_sales_lead?.[1]} />
        <Field label="Deal Value" value={lead.expected_revenue > 0 ? fmt(lead.expected_revenue) : null} color={T.success} />
        <Field label="Stage" value={lead.stage_id?.[1]} />
        <Field label="Closing" value={closingDate || "No date"} color={closingDate ? urg.dateColor : T.textMuted} />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Divider */}
      <div style={{ height: 1, background: T.border }} />

      {/* View in Odoo button */}
      <a
        href={`https://crm-adage-9.odoo.com/odoo/crm/${lead.id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBdr}`,
          textDecoration: "none", transition: "background 0.15s, box-shadow 0.15s",
          letterSpacing: "0.2px",
        }}
      >
        View in Odoo →
      </a>
    </div>
  );
}

// ─── Revenue by Lead Status donut chart ──────────────────────────────────────
// ─── Project type pill colors ─────────────────────────────────────────────────
const PROJECT_TYPE_COLORS = {
  "Greenfield": { bg: "rgba(16,185,129,0.12)", color: "#059669" },   // green tint
  "Brownfield": { bg: "rgba(120,80,40,0.12)", color: "#7C4F28" },   // brown tint
};
const getProjectTypePill = (type) =>
  PROJECT_TYPE_COLORS[type] || { bg: "rgba(124,58,237,0.10)", color: "#7C3AED" };

// STATUS_COLORS replaced by getPill() / STATUS_PILL at the top of file.

// ─── Reusable interactive donut ──────────────────────────────────────────────
function InteractiveDonut({ title, segments, total, centerLabel, onSegmentClick, activeKey }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const size = 140, cx = size / 2, cy = size / 2;
  const R_BASE = 52, R_HOVER = 56;
  const SW_BASE = 18, SW_HOVER = 14;
  const circ_base = 2 * Math.PI * R_BASE;
  const circ_hover = 2 * Math.PI * R_HOVER;

  let cumDashBase = 0, cumDashHover = 0;
  const segs = segments.map(seg => {
    const dashBase = (seg.rev / total) * circ_base;
    const dashHover = (seg.rev / total) * circ_hover;
    const s = { ...seg, dashBase, dashHover, offsetBase: cumDashBase, offsetHover: cumDashHover };
    cumDashBase += dashBase;
    cumDashHover += dashHover;
    return s;
  });

  const hovered = hoveredKey ? segs.find(s => s.key === hoveredKey) : null;

  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>{title}</div>
      {segs.length === 0 ? (
        <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "24px 0" }}>No data</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
              {/* Background track */}
              <circle cx={cx} cy={cy} r={R_BASE} fill="none" stroke={T.bgInput} strokeWidth={SW_BASE} />
              {segs.map((seg, i) => {
                const isHov = hoveredKey === seg.key;
                const isActive = activeKey === seg.key;
                const expand = isHov || isActive;
                const r = expand ? R_HOVER : R_BASE;
                const sw = expand ? SW_HOVER : SW_BASE;
                const circ = expand ? circ_hover : circ_base;
                const dash = (seg.rev / total) * circ;
                const offset = expand ? seg.offsetHover : seg.offsetBase;
                return (
                  <g key={i}>
                    {/* Visual circle — animates, no mouse events */}
                    <circle cx={cx} cy={cy}
                      r={r} fill="none"
                      stroke={seg.color} strokeWidth={sw}
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="butt"
                      opacity={hoveredKey && !isHov ? 0.35 : 1}
                      pointerEvents="none"
                      filter={isActive ? `drop-shadow(0 0 5px ${seg.color}90)` : undefined}
                      style={{ transition: "r 0.15s ease, stroke-width 0.15s ease, opacity 0.15s ease" }}
                    />
                    {/* Hit area — always at hover radius, transparent, owns all events */}
                    <circle cx={cx} cy={cy}
                      r={R_HOVER} fill="none"
                      stroke="transparent"
                      strokeWidth={SW_HOVER + 8}
                      strokeDasharray={`${seg.dashHover} ${circ_hover - seg.dashHover}`}
                      strokeDashoffset={-seg.offsetHover}
                      strokeLinecap="butt"
                      cursor="pointer"
                      onMouseEnter={() => setHoveredKey(seg.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => onSegmentClick && onSegmentClick(seg.key)}
                    />
                  </g>
                );
              })}
            </svg>
            {/* Center label overlay — pointer-events none so it never blocks SVG events */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", padding: "0 8px" }}>
              {hovered ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: hovered.color, lineHeight: 1.2, maxWidth: 60 }}>{hovered.key}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.textPrimary, marginTop: 2 }}>{fmt(hovered.rev)}</div>
                  <div style={{ fontSize: 9, color: T.textMuted }}>{hovered.count} leads</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.textPrimary }}>{fmt(total)}</div>
                  <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{centerLabel}</div>
                </>
              )}
            </div>
          </div>
          {/* Legend */}
          <div style={{ flex: 1 }}>
            {segs.map(seg => {
              const isActive = activeKey === seg.key;
              return (
                <div key={seg.key}
                  onClick={() => onSegmentClick && onSegmentClick(seg.key)}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 7,
                    cursor: "pointer",
                    opacity: hoveredKey && hoveredKey !== seg.key ? 0.4 : 1,
                    transition: "opacity 0.15s",
                    borderLeft: `3px solid ${isActive ? seg.color : "transparent"}`,
                    background: isActive ? `${seg.color}12` : "transparent",
                    borderRadius: 4, paddingLeft: 5,
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.textSecondary, flex: 1 }}>{seg.key}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{fmt(seg.rev)}</span>
                  <span style={{ fontSize: 10, color: T.textMuted }}>{seg.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueDonut({ leads, onSegmentClick, activeKey }) {
  const byStatus = {};
  leads.forEach(l => {
    const s = l.x_studio_lead_status ? String(l.x_studio_lead_status).trim() : null;
    if (!s) return;
    if (!byStatus[s]) byStatus[s] = { rev: 0, count: 0, color: getPill(s).text };
    byStatus[s].rev += l.expected_revenue || 0;
    byStatus[s].count += 1;
  });
  const entries = Object.entries(byStatus).filter(([, d]) => d.rev > 0).sort((a, b) => b[1].rev - a[1].rev);
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const segments = entries.map(([key, d]) => ({ key, ...d }));
  return <InteractiveDonut title="Revenue by Lead Status" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} />;
}

function RegionDonut({ leads, onSegmentClick, activeKey }) {
  const byRegion = {};
  leads.forEach(l => {
    const k = l.x_studio_responsible_region_1 ? String(l.x_studio_responsible_region_1).trim() : "No Region";
    if (!byRegion[k]) byRegion[k] = { rev: 0, count: 0, color: REGION_COLORS[k] || T.accent };
    byRegion[k].rev += l.expected_revenue || 0;
    byRegion[k].count += 1;
  });
  const entries = Object.entries(byRegion).filter(([, d]) => d.rev > 0).sort((a, b) => b[1].rev - a[1].rev);
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const segments = entries.map(([key, d]) => ({ key, ...d }));
  return <InteractiveDonut title="Revenue by Responsible Region" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} />;
}

function PersonDonut({ leads, onSegmentClick, activeKey }) {
  const byPerson = {};
  leads.forEach(l => {
    const k = l.x_studio_assigned_salesperson?.[1] || l.user_id?.[1] || "Unassigned";
    if (!byPerson[k]) byPerson[k] = { rev: 0, count: 0, color: null };
    byPerson[k].rev += l.expected_revenue || 0;
    byPerson[k].count += 1;
  });

  const entries = Object.entries(byPerson).filter(([, d]) => d.rev > 0).sort((a, b) => b[1].rev - a[1].rev);
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const keys = entries.map(([k]) => k);
  const colorMap = {};
  keys.forEach((k, i) => { colorMap[k] = PERSON_COLORS[i % PERSON_COLORS.length]; });
  const segments = entries.map(([key, d]) => ({ key, ...d, color: colorMap[key] }));
  return <InteractiveDonut title="Revenue by Assigned Person" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} />;
}

// ─── Greenfield vs Brownfield pie chart ──────────────────────────────────────
const GB_PIE_COLORS = {
  "Greenfield": { bg: "rgba(16,185,129,0.12)", solid: "#059669" },
  "Brownfield": { bg: "rgba(120,80,40,0.12)", solid: "#7C4F28" },
};

function GreenfieldDonut({ leads, onSegmentClick, activeKey }) {
  const counts = {};
  leads.forEach(l => {
    const k = l.x_studio_project_background && l.x_studio_project_background !== false
      ? String(l.x_studio_project_background).trim() : null;
    if (!k) return;
    if (!counts[k]) counts[k] = { rev: 0, count: 0, color: GB_PIE_COLORS[k]?.solid || T.accent };
    counts[k].rev += l.expected_revenue || 0;
    counts[k].count += 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1].rev - a[1].rev);
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const segments = entries.map(([key, d]) => ({ key, ...d }));
  return <InteractiveDonut title="Greenfield vs Brownfield" segments={segments} total={total} centerLabel="Total" onSegmentClick={onSegmentClick} activeKey={activeKey} />;
}

// ─── MonthBar — owns its own hover state (fixes useState-in-map violation) ────
function MonthBar({ monthKey, data, isSelected, maxRev, onBarClick }) {
  const [hovered, setHovered] = useState(false);
  const barH = Math.max(Math.round((data.rev / maxRev) * 90), 4);
  return (
    <div onClick={() => onBarClick(isSelected ? null : monthKey)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 44, flex: 1, cursor: "pointer" }}>
      <div style={{ fontSize: 9, color: isSelected ? T.accent : T.textMuted, fontWeight: isSelected ? 700 : 600, whiteSpace: "nowrap" }}>{fmt(data.rev)}</div>
      <div style={{ width: "100%", height: barH, minHeight: 4, borderRadius: "4px 4px 0 0", background: isSelected ? T.accent : hovered ? T.accentBdr : "#CBD5E1", transition: "background 0.15s, transform 0.15s", transform: hovered ? "scaleY(1.04)" : "scaleY(1)", transformOrigin: "bottom", outline: isSelected ? `2px solid ${T.accent}` : "none", outlineOffset: 1 }} />
      <div style={{ fontSize: 10, color: isSelected ? T.accent : T.textSecondary, fontWeight: isSelected ? 700 : 400, whiteSpace: "nowrap" }}>{data.label}</div>
    </div>
  );
}

// ─── Projected Monthly Closings bar chart (clickable drill-down) ──────────────
function MonthlyClosings({ leads, selectedMonth, onBarClick }) {
  const monthMap = {};
  leads.forEach(l => {
    if (!l.x_studio_expected_closing) return;
    const [y, m] = l.x_studio_expected_closing.split("T")[0].split("-").map(Number);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { label: `${MONTHS_SHORT[m - 1]} '${String(y).slice(2)}`, rev: 0 };
    monthMap[key].rev += l.expected_revenue || 0;
  });
  const entries = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 12);
  const maxRev = Math.max(...entries.map(([, d]) => d.rev), 1);
  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>Projected Monthly Closings</div>
        {selectedMonth && (
          <button onClick={() => onBarClick(null)} style={{ fontSize: 11, color: T.accent, background: T.accentBg, border: `1px solid ${T.accentBdr}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>✕ Clear</button>
        )}
      </div>
      {entries.length < 2 ? (
        <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "24px 0" }}>Not enough date data to show trend.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, overflowX: "auto" }}>
            {entries.map(([key, d]) => (
              <MonthBar key={key} monthKey={key} data={d} isSelected={selectedMonth === key} maxRev={maxRev} onBarClick={onBarClick} />
            ))}
          </div>
          {selectedMonth && (
            <div style={{ marginTop: 8, fontSize: 11, color: T.accent, fontWeight: 600 }}>
              Showing leads closing in {monthMap[selectedMonth]?.label} — scroll down to see them
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────
const LIST_GRID = "1.6fr 120px 110px 120px 100px 120px";
const LIST_HEADERS = ["Lead / Company", "Project Type", "Region", "Sales Lead", "Closing Date", "Value"];

function ListRow({ lead, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);
  const urg = URGENCY[getUrgency(lead.x_studio_expected_closing)];
  const closingDate = fmtShort(lead.x_studio_expected_closing);
  const regionColor = REGION_COLORS[lead.x_studio_responsible_region_1] || T.textMuted;
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: LIST_GRID, gap: 8, padding: "10px 14px", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: isSelected ? T.accentBg : hovered ? T.bgCardAlt : "transparent", cursor: "pointer", transition: "background 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
        {closingDate && (
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: urg.border === "transparent" ? "transparent" : urg.border,
          }} />
        )}
        <div style={{ overflow: "hidden" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.name}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>{lead.partner_id?.[1] || lead.partner_name || "—"}</div>
        </div>
      </div>
      <div>
        {lead.x_studio_project_background
          ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: getProjectTypePill(lead.x_studio_project_background).bg, color: getProjectTypePill(lead.x_studio_project_background).color }}>{lead.x_studio_project_background}</span>
          : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
      </div>
      <div>
        {lead.x_studio_responsible_region_1
          ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: `${regionColor}18`, color: regionColor }}>{lead.x_studio_responsible_region_1}</span>
          : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
      </div>
      <div style={{ fontSize: 12, color: lead.x_studio_sales_lead?.[1] ? T.textSecondary : T.textMuted }}>
        {lead.x_studio_sales_lead?.[1] || "—"}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: closingDate ? urg.dateColor : T.textMuted }}>
        {closingDate || "No date"}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: lead.expected_revenue > 0 ? T.success : T.textMuted }}>
        {lead.expected_revenue > 0 ? fmt(lead.expected_revenue) : "—"}
      </div>
    </div>
  );
}



// ─── Main PipelineTab ─────────────────────────────────────────────────────────
export function PipelineTab({ leads, stages }) {
  const [viewMode, setViewMode] = useState("list");
  const [activeOnly, setActiveOnly] = useState(true);
  const [groupBy, setGroupBy] = useState("stage");
  const [filterRegion, setFilterRegion] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterPerson, setFilterPerson] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null); // "YYYY-MM" drill-down from bar chart
  const [donutFilter, setDonutFilter] = useState(null); // { kind: "lead_status" | "region" | "person", key: string }
  const [filterProjectType, setFilterProjectType] = useState(null); // drill from GB donut
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown options
  const regionOptions = useMemo(() => [...new Set(leads.map(l => l.x_studio_responsible_region_1).filter(Boolean))].sort(), [leads]);
  const statusOptions = useMemo(() => [...new Set(leads.map(l => l.x_studio_lead_status).filter(Boolean))].sort(), [leads]);
  const personOptions = useMemo(() => [...new Set(leads.map(l => (l.x_studio_assigned_salesperson?.[1] || l.user_id?.[1])).filter(Boolean))].sort(), [leads]);

  useEffect(() => { setDonutFilter(null); }, [groupBy]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (activeOnly && String(l.x_studio_lead_status || "") !== "ACTIVE") return false;
      if (filterRegion.length > 0 && !filterRegion.includes(l.x_studio_responsible_region_1)) return false;
      if (filterStatus.length > 0 && !filterStatus.includes(l.x_studio_lead_status)) return false;
      if (filterPerson.length > 0 && !filterPerson.includes(l.x_studio_assigned_salesperson?.[1] || l.user_id?.[1])) return false;
      if (donutFilter?.kind === "lead_status") {
        const val = l.x_studio_lead_status ? String(l.x_studio_lead_status).trim() : null;
        if (val !== donutFilter.key) return false;
      }
      if (donutFilter?.kind === "region") {
        const val = l.x_studio_responsible_region_1 ? String(l.x_studio_responsible_region_1).trim() : "No Region";
        if (val !== donutFilter.key) return false;
      }
      if (donutFilter?.kind === "person") {
        const val = l.x_studio_assigned_salesperson?.[1] || l.user_id?.[1] || "Unassigned";
        if (val !== donutFilter.key) return false;
      }
      if (filterProjectType) {
        const val = l.x_studio_project_background && l.x_studio_project_background !== false
          ? String(l.x_studio_project_background).trim() : null;
        if (val !== filterProjectType) return false;
      }
      if (selectedMonth) {
        const closing = l.x_studio_expected_closing;
        if (!closing) return false;
        const monthKey = closing.split("T")[0].slice(0, 7); // "YYYY-MM"
        if (monthKey !== selectedMonth) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const company = String(l.partner_id?.[1] || l.partner_name || "").toLowerCase();
        const salesperson = String(l.x_studio_assigned_salesperson?.[1] || "").toLowerCase();
        const salesLead = String(l.x_studio_sales_lead?.[1] || "").toLowerCase();
        const name = String(l.name || "").toLowerCase();
        if (!company.includes(q) && !salesperson.includes(q) && !salesLead.includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
  }, [leads, activeOnly, filterRegion, filterStatus, filterPerson, donutFilter, filterProjectType, selectedMonth, searchQuery]);

  // Group + sort
  const groups = useMemo(() => {
    const map = {};
    filteredLeads.forEach(l => {
      let key;
      if (groupBy === "region") key = l.x_studio_responsible_region_1 || "No Region";
      else if (groupBy === "person") key = l.x_studio_assigned_salesperson?.[1] || "Unassigned";
      else if (groupBy === "stage") key = l.stage_id?.[1] || "No Stage";
      else key = l.x_studio_lead_status || "No Status";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    // Sort each group
    Object.values(map).forEach(arr => {
      arr.sort((a, b) => {
        const ad = a.x_studio_expected_closing;
        const bd = b.x_studio_expected_closing;
        if (ad && bd) return ad.localeCompare(bd);
        if (ad) return -1;
        if (bd) return 1;
        return (b.expected_revenue || 0) - (a.expected_revenue || 0);
      });
    });
    // Order group keys
    let keys = Object.keys(map);
    const STATUS_ORDER = ["ACTIVE", "CONVERTED TO RFQ", "REGRET", "No Status"];
    if (groupBy === "region") keys.sort((a, b) => { const ra = REGION_COLORS[a] ? 0 : 1; const rb = REGION_COLORS[b] ? 0 : 1; return ra - rb || a.localeCompare(b); });
    else if (groupBy === "stage") keys.sort((a, b) => { const ia = stages.findIndex(s => s.name === a); const ib = stages.findIndex(s => s.name === b); return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib); });
    else keys.sort();
    return keys.map((key, i) => ({ key, leads: map[key], idx: i }));
  }, [filteredLeads, groupBy, stages]);

  const groupColor = (key, idx) => {
    if (groupBy === "region") return REGION_COLORS[key] || T.textMuted;
    if (groupBy === "person") return PERSON_COLORS[idx % PERSON_COLORS.length];
    if (groupBy === "stage") return PERSON_COLORS[idx % PERSON_COLORS.length];
    return getPill(key).text;
  };

  const toggleCollapse = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));
  const handleSetViewMode = (mode) => { setViewMode(mode); setSelectedLeadId(null); };
  const anyFilter = filterRegion.length > 0 || filterStatus.length > 0 || filterPerson.length > 0 || searchQuery !== "";

  const segBtn = (active) => ({
    padding: "5px 14px", border: "none", cursor: "pointer", fontFamily: "inherit",
    fontSize: 12, fontWeight: 600, transition: "all 0.15s",
    background: active ? T.accent : T.bgCard,
    color: active ? "#fff" : T.textSecondary,
  });

  return (
    <div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, justifyContent: "space-between" }}>

        {/* Left: Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
          {/* Active Only toggle */}
          <button onClick={() => setActiveOnly(a => !a)} style={{
            padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, fontFamily: "inherit",
            border: `1px solid ${activeOnly ? T.accent : T.border}`,
            background: activeOnly ? T.accentBg : T.bgCard,
            color: activeOnly ? T.accent : T.textSecondary, cursor: "pointer",
          }}>Active Only</button>

          {/* Group by segmented */}
          <div style={{ display: "flex", borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            {[["stage", "By Stage"], ["region", "By Region"], ["person", "By Person"]].map(([val, lbl], i) => (
              <button key={val} onClick={() => setGroupBy(val)} style={{
                ...segBtn(groupBy === val),
                borderRight: i < 2 ? `1px solid ${T.border}` : "none",
                borderRadius: i === 0 ? "7px 0 0 7px" : i === 2 ? "0 7px 7px 0" : 0,
              }}>{lbl}</button>
            ))}
          </div>

          {/* Dropdown filters */}
          <MultiSelect label="Region" options={regionOptions} selected={filterRegion} onChange={setFilterRegion} />
          <MultiSelect label="Status" options={statusOptions} selected={filterStatus} onChange={setFilterStatus} />
          <MultiSelect label="Person" options={personOptions} selected={filterPerson} onChange={setFilterPerson} />
          {anyFilter && (
            <button onClick={() => { setFilterRegion([]); setFilterStatus([]); setFilterPerson([]); setSearchQuery(""); }}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.textMuted, fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>✕</button>
          )}
        </div>

        {/* Right: Search & List / Kanban toggle */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, flex: 1 }}>
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.bgInput,
              color: T.textPrimary,
              fontFamily: "inherit",
              fontSize: 13,
              width: "100%",
              maxWidth: 220,
              outline: "none"
            }}
          />
          <div style={{ display: "flex", borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <button onClick={() => handleSetViewMode("list")} style={{ ...segBtn(viewMode === "list"), padding: "6px 12px", borderRadius: "7px 0 0 7px", borderRight: `1px solid ${T.border}`, fontSize: 15 }} title="List view">≡</button>
            <button onClick={() => handleSetViewMode("kanban")} style={{ ...segBtn(viewMode === "kanban"), padding: "6px 12px", borderRadius: "0 7px 7px 0", fontSize: 13 }} title="Kanban view">⊞</button>
          </div>
        </div>
      </div>

      {/* ── Urgency legend ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, flexWrap: "wrap" }}>
        {[["#EF4444", "Overdue"], ["#ffb744ff", "Due in ≤2 days"], ["#f5f10bff", "Due this week"]].map(([c, l]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, color: T.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
            {l}
          </span>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: donutFilter || filterProjectType ? 6 : 14 }}>
        {groupBy === "stage" ? (
          <RevenueDonut
            leads={filteredLeads}
            activeKey={donutFilter?.kind === "lead_status" ? donutFilter.key : null}
            onSegmentClick={(key) => {
              setDonutFilter(prev => (prev?.kind === "lead_status" && prev.key === key) ? null : ({ kind: "lead_status", key }));
              handleSetViewMode("list");
            }}
          />
        ) : groupBy === "region" ? (
          <RegionDonut
            leads={filteredLeads}
            activeKey={donutFilter?.kind === "region" ? donutFilter.key : null}
            onSegmentClick={(key) => {
              setDonutFilter(prev => (prev?.kind === "region" && prev.key === key) ? null : ({ kind: "region", key }));
              handleSetViewMode("list");
            }}
          />
        ) : (
          <PersonDonut
            leads={filteredLeads}
            activeKey={donutFilter?.kind === "person" ? donutFilter.key : null}
            onSegmentClick={(key) => {
              setDonutFilter(prev => (prev?.kind === "person" && prev.key === key) ? null : ({ kind: "person", key }));
              handleSetViewMode("list");
            }}
          />
        )}
        <GreenfieldDonut
          leads={filteredLeads}
          activeKey={filterProjectType}
          onSegmentClick={(key) => {
            setFilterProjectType(prev => prev === key ? null : key);
            handleSetViewMode("list");
          }}
        />
        <MonthlyClosings
          leads={filteredLeads}
          selectedMonth={selectedMonth}
          onBarClick={(m) => { setSelectedMonth(m); if (m) handleSetViewMode("list"); }}
        />
      </div>

      {/* ── Active drill-down indicators ── */}
      {(donutFilter || filterProjectType || selectedMonth) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>Filtered by:</span>
          {donutFilter?.kind === "lead_status" && (() => {
            const p = getPill(donutFilter.key);
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: p.bg, color: p.text, border: `1px solid ${p.text}40` }}>
                Status: {donutFilter.key}
                <button onClick={() => setDonutFilter(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
              </span>
            );
          })()}
          {donutFilter?.kind === "region" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${(REGION_COLORS[donutFilter.key] || T.accent)}18`, color: REGION_COLORS[donutFilter.key] || T.accent, border: `1px solid ${(REGION_COLORS[donutFilter.key] || T.accent)}40` }}>
              Region: {donutFilter.key}
              <button onClick={() => setDonutFilter(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
            </span>
          )}
          {donutFilter?.kind === "person" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}40` }}>
              Person: {donutFilter.key}
              <button onClick={() => setDonutFilter(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
            </span>
          )}
          {filterProjectType && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: getProjectTypePill(filterProjectType).bg, color: getProjectTypePill(filterProjectType).color, border: `1px solid ${getProjectTypePill(filterProjectType).color}40` }}>
              Type: {filterProjectType}
              <button onClick={() => setFilterProjectType(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
            </span>
          )}
          {selectedMonth && (() => {
            const [sy, sm] = selectedMonth.split("-").map(Number);
            const label = `${MONTHS_SHORT[sm - 1]} '${String(sy).slice(2)}`;
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}40` }}>
                Closing: {label}
                <button onClick={() => setSelectedMonth(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
              </span>
            );
          })()}
        </div>
      )}

      {/* ── Grouped content ── */}
      {groups.map(({ key, leads: groupLeads, idx }) => {
        const gColor = groupColor(key, idx);
        const groupRev = groupLeads.reduce((s, l) => s + (l.expected_revenue || 0), 0);
        const isCollapsed = !!collapsed[key];
        return (
          <div key={key} style={{ marginBottom: 14 }}>
            {/* Group header — white bg, teal left accent line (Make.com style) */}
            <div onClick={() => viewMode === "list" && toggleCollapse(key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", paddingLeft: 12,
                background: "#FFFFFF",
                border: `1px solid ${T.border}`,
                borderLeft: "3px solid #02818A",
                borderRadius: isCollapsed || viewMode === "kanban" ? 6 : "6px 6px 0 0",
                marginBottom: 0,
                cursor: viewMode === "list" ? "pointer" : "default",
                userSelect: "none",
              }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: gColor, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: gColor, flex: 1 }}>{key}</span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 100, background: `${gColor}18`, color: gColor }}>{groupLeads.length}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.success }}>{fmt(groupRev)}</span>
              {viewMode === "list" && (
                <span style={{ fontSize: 13, color: T.textMuted, padding: "0 4px", pointerEvents: "none" }}>
                  {isCollapsed ? "▼" : "▲"}
                </span>
              )}
            </div>

            {!isCollapsed && viewMode === "list" && (
              <div style={{ border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
                {/* Sticky column headers */}
                <div style={{ display: "grid", gridTemplateColumns: LIST_GRID, gap: 8, padding: "7px 14px", background: T.bgCardAlt, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 2 }}>
                  {LIST_HEADERS.map(h => (
                    <div key={h} style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                {groupLeads.map(lead => (
                  <div key={lead.id}>
                    <ListRow lead={lead} isSelected={selectedLeadId === lead.id} onClick={() => setSelectedLeadId(selectedLeadId === lead.id ? null : lead.id)} />
                    {selectedLeadId === lead.id && (
                      <div style={{ padding: "0 14px 10px" }}>
                        <LeadCard lead={lead} onClose={() => setSelectedLeadId(null)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {viewMode === "kanban" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginTop: 10 }}>
                {groupLeads.map(lead => (
                  <div key={lead.id} style={{ display: "flex", flexDirection: "column" }}>
                    <LeadCard lead={lead} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.textMuted, fontSize: 13 }}>No leads match the current filters.</div>
      )}
    </div>
  );
}
