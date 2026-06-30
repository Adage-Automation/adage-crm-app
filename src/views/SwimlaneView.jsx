import { useState, useEffect, useCallback, useRef } from "react";
import { fetchOdoo } from "../lib/odoo";
import { LeadCard } from "./PipelineTab";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  bgPage: "#F0F2F5", bgHeader: "#FFFFFF", bgCard: "#FFFFFF",
  bgCardAlt: "#F8F9FB", bgInput: "#F0F2F5",
  border: "#E2E6ED", borderMd: "#D0D5DD",
  textPrimary: "#1A1F36", textSecondary: "#4A5568",
  textMuted: "#8A94A6", textLabel: "#6B7280",
  accent: "#6366F1", accentBg: "rgba(99,102,241,0.08)", accentBdr: "rgba(99,102,241,0.25)",
  success: "#10B981", successBg: "rgba(16,185,129,0.08)",
  warning: "#F59E0B", warningBg: "rgba(245,158,11,0.10)",
  danger: "#EF4444", dangerBg: "rgba(239,68,68,0.08)",
  scrollThumb: "#D0D5DD",
};

const STATUS_CONFIG = {
  Planned:     { bg: "#10B981", text: "#fff", border: "#059669" },  // green
  Completed:   { bg: "#3B82F6", text: "#fff", border: "#2563EB" },  // blue
  Rescheduled: { bg: "#F59E0B", text: "#fff", border: "#D97706" },  // yellow
  Cancelled:   { bg: "#94A3B8", text: "#fff", border: "#64748B" },  // gray
  Unknown:     { bg: "#E2E6ED", text: "#4A5568", border: "#D0D5DD" },
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const fmt = (n) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000   ? `₹${(n / 1000).toFixed(0)}K`
  : `₹${n}`;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ─── Employee helpers ─────────────────────────────────────────────────────────
const resolveEmpId = (p) => {
  if (!p && p !== 0) return null;
  if (typeof p === "object" && !Array.isArray(p) && p.id) return p.id;
  if (Array.isArray(p) && p.length > 0) return p[0];
  const n = +p; return (!isNaN(n) && n > 0) ? n : null;
};
const resolveEmpName = (p, empMap) => {
  if (!p && p !== 0) return null;
  if (typeof p === "object" && !Array.isArray(p) && p.id) return empMap[p.id] || p.name || null;
  if (Array.isArray(p) && p.length > 0) return empMap[p[0]] || p[1] || null;
  const n = +p; if (!isNaN(n) && n > 0) return empMap[n] || null;
  return String(p) || null;
};

// ─── Week helpers ─────────────────────────────────────────────────────────────
// Returns the Monday of the week containing `date`
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const addMonths = (date, n) => new Date(date.getFullYear(), date.getMonth() + n, 1);

// ─── Tooltip — simple hover popup near cursor
function Tooltip({ content, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onMouseMove={(e) => setPos({ x: e.clientX + 12, y: e.clientY + 12 })}
      style={{ position: "relative", display: "inline-block" }}
    >
      {children}
      {open && (
        <div style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 1200,
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          padding: "8px 10px",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          whiteSpace: "pre-wrap",
          fontSize: 12,
          color: T.textPrimary,
          maxWidth: 380,
        }}>{content}</div>
      )}
    </span>
  );
}

// ─── MultiSelect dropdown ─────────────────────────────────────────────────────
function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  const label = selected.length === 0 ? placeholder
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
        background: T.bgCard, color: T.textPrimary, fontSize: 12, fontFamily: "inherit",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        minWidth: 150, justifyContent: "space-between",
      }}>
        <span style={{ color: selected.length ? T.textPrimary : T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{label}</span>
        <span style={{ fontSize: 10, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 200, maxHeight: 240, overflowY: "auto",
        }}>
          {options.map(opt => (
            <div key={opt} onClick={() => toggle(opt)} style={{
              padding: "8px 12px", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              background: selected.includes(opt) ? T.accentBg : "transparent",
              color: selected.includes(opt) ? T.accent : T.textPrimary,
            }}>
              <div style={{
                width: 14, height: 14, border: `1.5px solid ${selected.includes(opt) ? T.accent : T.borderMd}`,
                borderRadius: 3, background: selected.includes(opt) ? T.accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
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

// ─── Engagement type → emoji ──────────────────────────────────────────────────
const TYPE_EMOJI = {
  "Email":       "✉️",
  "Phone Call":  "📞",
  "Meeting":     "🤝",
  "Exhibition":  "🏛️",
};
const getTypeEmoji = (type) => TYPE_EMOJI[type] || "📌";

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ engagement, lead, isFollowUp, empMap, isSelected, onClick }) {
  const status = engagement.x_studio_engagement_status || "Unknown";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Unknown;
  const customerName = lead?.partner_id?.[1] || engagement.x_crm_lead_id?.[1] || "—";
  const isAnomaly = !isFollowUp && engagement.x_studio_visit_date && status === "Planned";
  const isCancelled = status === "Cancelled";
  const emoji = getTypeEmoji(engagement.x_studio_engagement_type);
  const { date: displayDate, label: displayDateLabel } = getDisplayDateMeta(engagement);

  const tooltipLines = [
    `Customer: ${customerName}`,
    `Type: ${engagement.x_studio_engagement_type || "—"}`,
    lead?.expected_revenue > 0 ? `Deal: ${fmt(lead.expected_revenue)}` : null,
    `Status: ${status}`,
    `${displayDateLabel}: ${fmtDate(displayDate)}`,
    engagement.x_studio_visit_date ? `Actual: ${fmtDate(engagement.x_studio_visit_date)}` : null,
    engagement.x_studio_next_follow_up_date ? `Follow-up: ${fmtDate(engagement.x_studio_next_follow_up_date)}` : null,
    engagement.x_studio_remarkscommments ? `Remarks: ${engagement.x_studio_remarkscommments}` : null,
    isAnomaly ? "⚠ Visit done but status not updated" : null,
  ].filter(Boolean).join("\n");

  // Shared pill box style — fixed width cell, emoji centered, no text bleed
  const baseStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 5,
    padding: "3px 2px",
    fontSize: 14,
    lineHeight: 1,
    overflow: "hidden",
    cursor: "pointer",
    marginBottom: 2,
    outline: isSelected ? `2px solid ${T.textPrimary}` : "none",
    outlineOffset: 1,
    transition: "outline 0.1s",
    userSelect: "none",
  };

  if (isFollowUp) {
    return (
      <Tooltip content={tooltipLines}>
        <div onClick={onClick} style={{
          ...baseStyle,
          background: `${cfg.bg}18`,
          border: `1.5px dashed ${cfg.border}`,
          opacity: 0.75,
        }}>
          {emoji}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltipLines}>
      <div onClick={onClick} style={{
        ...baseStyle,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        textDecoration: isCancelled ? "line-through" : "none",
        position: "relative",
      }}>
        {emoji}
        {isAnomaly && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            fontSize: 9, lineHeight: 1, pointerEvents: "none",
          }}>⚠</span>
        )}
      </div>
    </Tooltip>
  );
}



// ─── SummaryBadge ─────────────────────────────────────────────────────────────
function SummaryBadge({ label, count, color }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, color: T.textSecondary }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontWeight: 600, color }}>{count}</span>
      <span>{label}</span>
    </span>
  );
}

const navBtnStyle = {
  background: T.bgCardAlt, border: `1px solid ${T.border}`,
  color: T.textSecondary, borderRadius: 8, padding: "6px 12px",
  cursor: "pointer", fontSize: 14, fontFamily: "inherit", transition: "all 0.2s",
};

// ─── Person color palette (consistent with swimlane pill colors) ─────────────
const PERSON_COLORS = ["#4F8EF7","#F7924F","#059669","#7C3AED","#DB2777","#D97706","#DC2626","#0891B2","#0D9488","#7C3AED"];

// ─── List date formatter: "28 May, Thu" ──────────────────────────────────────
const fmtListDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = d.getDate();
  const mon = MONTH_NAMES[d.getMonth()].slice(0, 3);
  const dow = DAY_SHORT[d.getDay()];
  return `${day} ${mon}, ${dow}`;
};

const getDisplayDateMeta = (engagement) => {
  const status = engagement?.x_studio_engagement_status;

  if (status === "Rescheduled" && engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      label: "Rescheduled",
      color: "#F97316",
    };
  }

  if (engagement?.x_studio_proposed_date) {
    return {
      date: engagement.x_studio_proposed_date,
      label: "Proposed",
      color: T.textPrimary,
    };
  }

  if (engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      label: "Rescheduled",
      color: "#F97316",
    };
  }

  return {
    date: null,
    label: "Proposed",
    color: T.textMuted,
  };
};

// ─── ListView component ───────────────────────────────────────────────────────
function ListView({ engagements, leadMap, empMap, daySet, allPeople, selectedPeople, selectedStatuses, selectedPill, onRowClick }) {
  // Filter: displayed date must be in daySet + salesperson filter + status filter
  const filtered = engagements.filter(e => {
    const { date } = getDisplayDateMeta(e);
    if (!date || !daySet.has(date)) return false;
    if (selectedStatuses && selectedStatuses.length > 0 && !selectedStatuses.includes(e.x_studio_engagement_status)) return false;
    if (selectedPeople.length > 0) {
      const persons = Array.isArray(e.x_studio_visit_by) ? e.x_studio_visit_by : [];
      const names = persons.map(p => resolveEmpName(p, empMap)).filter(Boolean);
      if (!names.some(n => selectedPeople.includes(n))) return false;
    }
    return true;
  });

  // Sort by displayed date ascending
  const sorted = [...filtered].sort((a, b) => {
    const aDate = getDisplayDateMeta(a).date || "";
    const bDate = getDisplayDateMeta(b).date || "";
    return aDate.localeCompare(bDate);
  });

  // Group by "Month Year"
  const groups = {};
  const groupOrder = [];
  sorted.forEach(e => {
    const displayDate = getDisplayDateMeta(e).date;
    if (!displayDate) return;
    const d = new Date(displayDate);
    const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups[key]) { groups[key] = []; groupOrder.push(key); }
    groups[key].push(e);
  });

  // Build stable person→color map across all visible people
  const personColorMap = {};
  allPeople.forEach((name, i) => { personColorMap[name] = PERSON_COLORS[i % PERSON_COLORS.length]; });

  const COL_HEADERS = ["CUSTOMER","ORDER VALUE","PERSON","TYPE","STATUS","DATE TYPE","DATE","REMARKS"];

  if (sorted.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted, fontSize: 13, border: `1px solid ${T.border}`, borderRadius: 12, background: T.bgCard, marginBottom: 12 }}>
        No activity data for this period.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {groupOrder.map(monthKey => (
        <div key={monthKey} style={{ marginBottom: 24 }}>
          {/* Month heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: T.textPrimary }}>{monthKey}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 100,
              background: T.accentBg, color: T.accent,
            }}>{groups[monthKey].length}</span>
          </div>

            {/* Table */}
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Header row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 90px 130px 80px 110px 110px 110px 1fr",
              background: T.bgCardAlt, borderBottom: `1px solid ${T.border}`,
              padding: "7px 14px", gap: 8,
            }}>
              {COL_HEADERS.map(h => (
                <div key={h} style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>

            {/* Data rows */}
            {groups[monthKey].map((e, ri) => {
              const lead = leadMap[e.x_crm_lead_id?.[0]];
              const status = e.x_studio_engagement_status || "Unknown";
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Unknown;
              const isAnomaly = e.x_studio_visit_date && status === "Planned";
              const persons = Array.isArray(e.x_studio_visit_by) ? e.x_studio_visit_by : [];
              const personNames = persons.map(p => resolveEmpName(p, empMap)).filter(Boolean);
              const isSelected = selectedPill && selectedPill.engId === e.id;

              return (
                <ListRow
                  key={e.id}
                  e={e}
                  lead={lead}
                  status={status}
                  cfg={cfg}
                  isAnomaly={isAnomaly}
                  personNames={personNames}
                  personColorMap={personColorMap}
                  isSelected={isSelected}
                  isLast={ri === groups[monthKey].length - 1}
                  onClick={() => onRowClick(e)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListRow({ e, lead, status, cfg, isAnomaly, personNames, personColorMap, isSelected, isLast, onClick }) {
  const [hovered, setHovered] = useState(false);
  const { date: displayDate, label: displayDateLabel, color: displayDateColor } = getDisplayDateMeta(e);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 90px 130px 80px 110px 110px 110px 1fr",
        gap: 8, padding: "9px 14px", alignItems: "start",
        borderBottom: isLast ? "none" : `1px solid ${T.border}`,
        background: isSelected ? T.accentBg : hovered ? T.bgCardAlt : "transparent",
        cursor: "pointer", transition: "background 0.15s",
        outline: isSelected ? `2px solid ${T.accentBdr}` : "none",
        outlineOffset: -2,
      }}
    >
      {/* Customer */}
      <div style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lead?.partner_id?.[1] || e.x_crm_lead_id?.[1] || "—"}
      </div>

      {/* Order Value */}
      <div style={{ fontSize: 12, fontWeight: 700, color: lead?.expected_revenue > 0 ? T.success : T.textMuted }}>
        {lead?.expected_revenue > 0 ? fmt(lead.expected_revenue) : "—"}
      </div>

      {/* Person(s) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {personNames.length > 0
          ? personNames.map(n => (
              <span key={n} style={{ fontSize: 11, fontWeight: 600, color: personColorMap[n] || T.accent }}>
                {n}
              </span>
            ))
          : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>
        }
      </div>

      {/* Type pill with emoji */}
      <div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 100,
          background: "rgba(124,58,237,0.10)", color: "#7C3AED",
        }}>
          {getTypeEmoji(e.x_studio_engagement_type)} {e.x_studio_engagement_type || "—"}
        </span>
      </div>

      {/* Status pill with anomaly flag */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
          background: cfg.bg, color: cfg.text,
          textDecoration: status === "Cancelled" ? "line-through" : "none",
        }}>
          {status}
        </span>
        {isAnomaly && <span title="Visit done but status not updated" style={{ fontSize: 11 }}>⚠</span>}
      </div>

      {/* Date type */}
      <div style={{ fontSize: 12, color: displayDateColor, fontWeight: 600 }}>
        {displayDateLabel}
      </div>

      {/* Effective date */}
      <div style={{ fontSize: 12, color: displayDateColor, fontWeight: 500 }}>
        {fmtListDate(displayDate)}
      </div>

      {/* Remarks */}
      <div style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {e.x_studio_remarkscommments || "—"}
      </div>
    </div>
  );
}

// ─── Clickable day column header ─────────────────────────────────────────────
function DayHeader({ d, weekend, tod, viewMode, canDrill, onDrill, COL_W }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={canDrill ? onDrill : undefined}
      onMouseEnter={canDrill ? () => setHovered(true) : undefined}
      onMouseLeave={canDrill ? () => setHovered(false) : undefined}
      title={canDrill ? `View ${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}` : undefined}
      style={{
        width: COL_W, minWidth: COL_W, maxWidth: COL_W, flexShrink: 0,
        textAlign: "center", padding: viewMode === "month" ? "6px 2px" : "5px 4px",
        fontSize: viewMode === "month" ? 11 : 12,
        fontWeight: tod ? 800 : 500,
        color: tod ? T.accent : weekend ? T.textMuted : T.textSecondary,
        background: tod ? T.accentBg : hovered ? T.accentBg : weekend ? T.bgCardAlt : "transparent",
        borderRight: `1px solid ${T.border}`,
        borderBottom: tod ? `2px solid ${T.accent}` : "none",
        lineHeight: 1.4,
        cursor: canDrill ? "pointer" : "default",
        transition: "background 0.15s",
        userSelect: "none",
      }}
    >
      {viewMode === "month" ? d.getDate() : (
        <>
          <div>{DAY_SHORT[d.getDay()]}</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{d.getDate()}</div>
        </>
      )}
    </div>
  );
}

// ─── Main SwimlaneView ────────────────────────────────────────────────────────
export default function SwimlaneView() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // viewMode: "month" | "week" | "day"  — default: week
  const [viewMode, setViewMode] = useState("week");

  // anchor: for month = first day of month; for week = Monday of week; for day = the day
  const [anchor, setAnchor] = useState(() => getWeekStart(today));

  const [engagements, setEngagements]   = useState([]);
  const [leadMap, setLeadMap]           = useState({});
  const [empMap, setEmpMap]             = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState(["Planned", "Rescheduled"]);
  const [selectedPill, setSelectedPill] = useState(null); // { engId, isFollowUp }
  const [layoutMode, setLayoutMode] = useState("grid"); // "grid" | "list"

  // ── Compute visible date range from anchor + viewMode ─────────────────────
  const { rangeStart, rangeEnd, days, headerLabel } = (() => {
    if (viewMode === "month") {
      const y = anchor.getFullYear(), m = anchor.getMonth();
      const dim = new Date(y, m + 1, 0).getDate();
      const start = new Date(y, m, 1);
      const end   = new Date(y, m, dim);
      const ds = Array.from({ length: dim }, (_, i) => new Date(y, m, i + 1));
      return { rangeStart: start, rangeEnd: end, days: ds, headerLabel: `${MONTH_NAMES[m]} ${y}` };
    }
    if (viewMode === "week") {
      const start = new Date(anchor);
      const end   = addDays(start, 6);
      const ds = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const sLabel = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0,3)}`;
      const eLabel = `${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0,3)} ${end.getFullYear()}`;
      return { rangeStart: start, rangeEnd: end, days: ds, headerLabel: `${sLabel} – ${eLabel}` };
    }
    // day
    const d = new Date(anchor);
    return {
      rangeStart: d, rangeEnd: d, days: [d],
      headerLabel: `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`,
    };
  })();

  const rangeStartISO = isoDate(rangeStart);
  const rangeEndISO   = isoDate(rangeEnd);

  // ── Data fetch ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orDomain = [
        "|",
        "&", ["x_studio_proposed_date", ">=", rangeStartISO], ["x_studio_proposed_date", "<=", rangeEndISO],
        "&", ["x_studio_rescheduled_date", ">=", rangeStartISO], ["x_studio_rescheduled_date", "<=", rangeEndISO],
      ];
      const rawEngagements = await fetchOdoo("x_crm_lead_line_6bc5b", "search_read", [orDomain], {
        fields: [
          "x_studio_proposed_date", "x_studio_rescheduled_date",
          "x_studio_engagement_type", "x_studio_engagement_status",
          "x_studio_visit_by", "x_crm_lead_id", "x_studio_remarkscommments",
        ],
        limit: 1000,
      });
      const engList = rawEngagements || [];

      const empIds = new Set();
      engList.forEach(e => {
        (Array.isArray(e.x_studio_visit_by) ? e.x_studio_visit_by : []).forEach(p => {
          const id = resolveEmpId(p); if (id) empIds.add(id);
        });
      });
      const leadIds = [...new Set(engList.map(e => e.x_crm_lead_id?.[0]).filter(Boolean))];

      const [rawLeads, rawEmps] = await Promise.all([
        leadIds.length > 0
          ? fetchOdoo("crm.lead", "search_read", [[["id","in",leadIds]]], { fields: ["id","partner_id","expected_revenue"], limit: 500 })
          : Promise.resolve([]),
        empIds.size > 0
          ? fetchOdoo("hr.employee", "search_read", [[["id","in",Array.from(empIds)]]], { fields: ["id","name"], limit: 500 })
          : Promise.resolve([]),
      ]);

      const lMap = {}; (rawLeads||[]).forEach(l => { lMap[l.id] = l; });
      const eMap = {}; (rawEmps||[]).forEach(e => { eMap[e.id] = e.name; });

      setLeadMap(lMap);
      setEmpMap(eMap);
      setEngagements(engList);
      setSelectedPill(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [rangeStartISO, rangeEndISO]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = (dir) => { // dir: -1 or +1
    if (viewMode === "month") setAnchor(a => addMonths(a, dir));
    else if (viewMode === "week") setAnchor(a => addDays(a, dir * 7));
    else setAnchor(a => addDays(a, dir));
  };
  const goToday = () => {
    if (viewMode === "month") setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (viewMode === "week") setAnchor(getWeekStart(today));
    else setAnchor(new Date(today));
  };
  const switchMode = (mode) => {
    setViewMode(mode);
    if (mode === "month") setAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (mode === "week") setAnchor(getWeekStart(today));
    else setAnchor(new Date(today));
  };

  // ── Is current period? ────────────────────────────────────────────────────
  const isCurrentPeriod = (() => {
    if (viewMode === "month")
      return anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
    if (viewMode === "week") {
      const ws = getWeekStart(today);
      return anchor.getTime() === ws.getTime();
    }
    return anchor.toDateString() === today.toDateString();
  })();

  // ── Client-side grouping ──────────────────────────────────────────────────
  // Map isoDate string → Date object for fast lookup
  const daySet = new Set(days.map(d => isoDate(d)));

  const rowMap = {};
  engagements
    .filter(eng => selectedStatuses.length === 0 || selectedStatuses.includes(eng.x_studio_engagement_status))
    .forEach(eng => {
    const persons = Array.isArray(eng.x_studio_visit_by) ? eng.x_studio_visit_by : [];
    const empEntries = persons.length > 0
      ? persons.map(p => ({ id: resolveEmpId(p), name: resolveEmpName(p, empMap) })).filter(e => e.id)
      : [{ id: 0, name: "Unassigned" }];

    empEntries.forEach(({ id, name }) => {
      const key = name || `Employee #${id}`;
      if (!rowMap[key]) rowMap[key] = { empId: id, items: [] };

      const effectiveDate = getDisplayDateMeta(eng).date;

      if (effectiveDate && daySet.has(effectiveDate)) {
        const day = new Date(effectiveDate);
        rowMap[key].items.push({ engagement: eng, isFollowUp: false, dayISO: effectiveDate, dayObj: day });
      }
    });
  });

  const allPeople = Object.keys(rowMap).sort();
  const visibleRows = allPeople.filter(n => selectedPeople.length === 0 || selectedPeople.includes(n));

  // ── Summary counts (based on displayed date in range) ────────────────────
  const summary = { total: 0, Planned: 0, Completed: 0, Rescheduled: 0, Cancelled: 0, anomaly: 0 };
  engagements.forEach(e => {
    const displayDate = getDisplayDateMeta(e).date;
    if (!displayDate || !daySet.has(displayDate)) return;
    summary.total++;
    const s = e.x_studio_engagement_status;
    if (s in summary) summary[s]++;
    if (e.x_studio_visit_date && s === "Planned") summary.anomaly++;
  });

  // ── Selected pill engagement lookup ──────────────────────────────────────
  const selectedEngagement = selectedPill
    ? engagements.find(e => e.id === selectedPill.engId) || null
    : null;

  // ── Column layout constants ───────────────────────────────────────────────
  // For month view, pack tighter; for week/day, use wider columns
  const COL_W = viewMode === "month" ? 52 : viewMode === "week" ? 110 : 260;
  const ROW_LABEL_W = 160;

  const isWeekend = (d) => { const wd = d.getDay(); return wd === 0 || wd === 6; };
  const isToday   = (d) => d.toDateString() === today.toDateString();

  // ── Drill into day on header click ───────────────────────────────────────
  const drillToDay = (d) => {
    setViewMode("day");
    setAnchor(new Date(d));
  };

  // ── Pill click handler ────────────────────────────────────────────────────
  const handlePillClick = (eng, isFollowUp) => {
    const key = `${eng.id}-${isFollowUp}`;
    const currentKey = selectedPill ? `${selectedPill.engId}-${selectedPill.isFollowUp}` : null;
    setSelectedPill(key === currentKey ? null : { engId: eng.id, isFollowUp });
  };

  // Toggle a status filter on/off (used by the top summary badges)
  const toggleStatus = (status) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>

        {/* Left: nav + period label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(-1)} style={navBtnStyle}>‹</button>
          <div style={{ fontWeight: 800, fontSize: 16, color: T.textPrimary, minWidth: 180, textAlign: "center" }}>
            {headerLabel}
          </div>
          <button onClick={() => navigate(1)} style={navBtnStyle}>›</button>
          {!isCurrentPeriod && (
            <button onClick={goToday} style={{ ...navBtnStyle, fontSize: 12, fontWeight: 600, padding: "6px 14px" }}>Today</button>
          )}
        </div>

        {/* Right: view toggle + filter + refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Grid/List layout toggle */}
          <div style={{ display: "flex", background: T.bgInput, borderRadius: 8, padding: 3, gap: 2 }}>
            {[["grid","Grid"],["list","List"]].map(([mode, label]) => (
              <button key={mode} onClick={() => setLayoutMode(mode)} style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                background: layoutMode === mode ? T.bgCard : "transparent",
                color: layoutMode === mode ? T.accent : T.textMuted,
                boxShadow: layoutMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>

          {/* Month/Week/Day segmented toggle */}
          <div style={{ display: "flex", background: T.bgInput, borderRadius: 8, padding: 3, gap: 2 }}>
            {[["month","Month"],["week","Week"],["day","Day"]].map(([mode, label]) => (
              <button key={mode} onClick={() => switchMode(mode)} style={{
                padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                background: viewMode === mode ? T.bgCard : "transparent",
                color: viewMode === mode ? T.accent : T.textMuted,
                boxShadow: viewMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>

          <MultiSelect options={allPeople} selected={selectedPeople} onChange={setSelectedPeople} placeholder="All people" />
          <MultiSelect
            options={["Planned", "Rescheduled", "Completed", "Cancelled"]}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            placeholder="All statuses"
          />
          {selectedPeople.length > 0 && (
            <button onClick={() => setSelectedPeople([])} style={{ ...navBtnStyle, fontSize: 11, color: T.textMuted }}>Clear people</button>
          )}
          <button onClick={loadData} style={{ ...navBtnStyle, color: T.accent, borderColor: T.accentBdr, background: T.accentBg, fontWeight: 600, fontSize: 12 }}>
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* ── Summary bar (shared) — placed under header; badges act as toggle tabs ── */}
      {!loading && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <span style={{ fontWeight: 700, color: T.textPrimary }}>{summary.total} activities</span>
          </div>
          {[["Planned", STATUS_CONFIG.Planned.bg],["Completed", STATUS_CONFIG.Completed.bg],["Rescheduled", STATUS_CONFIG.Rescheduled.bg],["Cancelled", STATUS_CONFIG.Cancelled.bg]].map(([label, color]) => (
            <div key={label} onClick={() => toggleStatus(label)} style={{ cursor: "pointer", padding: "8px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: selectedStatuses.includes(label) ? T.bgCard : "transparent", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: T.textSecondary }}>{summary[label]}</span>
              <span style={{ color: T.textMuted }}>{label}</span>
            </div>
          ))}
          {summary.anomaly > 0 && (
            <div style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgCard }}>
              <span style={{ color: "#D97706", fontWeight: 600 }}>⚠ {summary.anomaly} status not updated</span>
            </div>
          )}
        </div>
      )}

      {/* ── Loading / Error ── */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: "60px 0" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", animation: "pulse 2s infinite" }} />
          <div style={{ color: T.textMuted, fontSize: 13 }}>Loading activity data…</div>
        </div>
      )}
      {error && (
        <div style={{ background: T.dangerBg, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 16, color: "#B91C1C", fontSize: 13 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Grid (swimlane) view ── */}
          {layoutMode === "grid" && (
          <>
          {/* ── Swimlane grid ── */}
          <div style={{
            overflowX: "auto", overflowY: "auto", maxHeight: "56vh",
            border: `1px solid ${T.border}`, borderRadius: 12,
            background: T.bgCard, marginBottom: 12,
          }}>
            {/* Fixed-width inner — prevents grid from shrinking */}
            <div style={{ minWidth: ROW_LABEL_W + COL_W * days.length, width: "max-content" }}>

              {/* ── Column headers ── */}
              <div style={{
                display: "flex", position: "sticky", top: 0, zIndex: 10,
                background: T.bgCardAlt, borderBottom: `1px solid ${T.border}`,
              }}>
                {/* Sticky name header */}
                <div style={{
                  width: ROW_LABEL_W, minWidth: ROW_LABEL_W, maxWidth: ROW_LABEL_W,
                  flexShrink: 0, padding: "8px 14px", fontSize: 10,
                  color: T.textMuted, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase",
                  borderRight: `1px solid ${T.border}`,
                  position: "sticky", left: 0, background: T.bgCardAlt, zIndex: 11,
                }}>SALESPERSON</div>

                {days.map((d, i) => {
                  const weekend = isWeekend(d);
                  const tod     = isToday(d);
                  const canDrill = viewMode !== "day";
                  return (
                    <DayHeader
                      key={i}
                      d={d}
                      weekend={weekend}
                      tod={tod}
                      viewMode={viewMode}
                      canDrill={canDrill}
                      onDrill={() => drillToDay(d)}
                      COL_W={COL_W}
                    />
                  );
                })}
              </div>

              {/* ── Rows ── */}
              {visibleRows.length === 0 && (
                <div style={{ padding: "40px 0", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                  No activity data for this period.
                </div>
              )}

              {visibleRows.map((empName, rowIdx) => {
                const row = rowMap[empName];
                // Group by isoDate string — strict containment
                const byDay = {};
                row.items.forEach(item => {
                  if (!byDay[item.dayISO]) byDay[item.dayISO] = [];
                  byDay[item.dayISO].push(item);
                });

                // No bridges — each engagement shows exactly one pill
                const bridges = [];

                return (
                  <div key={empName} style={{
                    display: "flex",
                    borderBottom: rowIdx < visibleRows.length - 1 ? `1px solid ${T.border}` : "none",
                  }}>
                    {/* Sticky row label */}
                    <div style={{
                      width: ROW_LABEL_W, minWidth: ROW_LABEL_W, maxWidth: ROW_LABEL_W,
                      flexShrink: 0, padding: "8px 12px",
                      display: "flex", alignItems: "flex-start", gap: 8,
                      borderRight: `1px solid ${T.border}`,
                      position: "sticky", left: 0, background: T.bgCard, zIndex: 5,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: T.accentBg, border: `1.5px solid ${T.accentBdr}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: T.accent, fontWeight: 800,
                      }}>
                        {empName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, lineHeight: 1.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {empName}
                      </span>
                    </div>

                    {/* Day-cell strip */}
                    <div style={{ position: "relative", display: "flex", flex: 1 }}>
                      {/* ── Day cells ── */}
                      {days.map((d, ci) => {
                        const dISO = isoDate(d);
                        const tod  = isToday(d);
                        const wknd = isWeekend(d);
                        const pills = byDay[dISO] || [];
                        return (
                          <div key={ci} style={{
                            width: COL_W, minWidth: COL_W, maxWidth: COL_W,
                            flexShrink: 0, flexGrow: 0,
                            padding: "4px 3px",
                            overflow: "hidden",
                            background: tod ? "rgba(99,102,241,0.04)" : wknd ? "rgba(0,0,0,0.015)" : "transparent",
                            borderRight: `1px solid ${T.border}`,
                            minHeight: 48,
                            display: "flex", flexDirection: "column",
                            boxSizing: "border-box",
                            position: "relative", zIndex: 1,
                          }}>
                            {pills.map((item, pi) => (
                              <div key={`${item.engagement.id}-${pi}`} style={{ position: "relative", zIndex: 1 }}>
                                <Pill
                                  engagement={item.engagement}
                                  lead={leadMap[item.engagement.x_crm_lead_id?.[0]]}
                                  isFollowUp={false}
                                  empMap={empMap}
                                  isSelected={selectedPill && selectedPill.engId === item.engagement.id && selectedPill.isFollowUp === item.isFollowUp}
                                  onClick={() => handlePillClick(item.engagement, item.isFollowUp)}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </>
          )} {/* end grid */}

          {/* ── List view ── */}
          {layoutMode === "list" && (
            <ListView
              engagements={engagements}
              leadMap={leadMap}
              empMap={empMap}
              daySet={daySet}
              allPeople={allPeople}
              selectedPeople={selectedPeople}
              selectedStatuses={selectedStatuses}
              selectedPill={selectedPill}
              onRowClick={(eng) => handlePillClick(eng, false)}
            />
          )}

          {/* removed duplicate summary + activity legend — badges now at top */}

          {/* ── Detail panel (shared) ── */}
          {selectedEngagement && leadMap[selectedEngagement.x_crm_lead_id?.[0]] && (
            <div style={{ marginBottom: 12, marginTop: 12 }}>
              <LeadCard 
                lead={leadMap[selectedEngagement.x_crm_lead_id?.[0]]} 
                onClose={() => setSelectedPill(null)} 
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
