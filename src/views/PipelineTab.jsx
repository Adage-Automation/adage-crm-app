import { useState, useMemo, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { T } from "../constants/theme";
import { REGION_COLORS, PERSON_COLORS } from "../constants/colors";
import { fmt, getPersonNames, getPersonName } from "../lib/format";
import { ODOO_BASE_URL } from "../lib/odoo";
import { CURRENCY_OPTIONS, FALLBACK_RATES, fetchFxRates, convertAmount, fmtByCurrency } from "../lib/currency";
import HealthSpeedometer from "../components/HealthSpeedometer";
import HealthTag, {
  AggregateTooltipContent,
  getClosestHealthTier,
  hasAnyActivity,
  hasCompletedActivity,
  getHealthTagMeta,
  HEALTH_POSITIONS,
} from "../components/HealthTag";

// ─── Local constants ──────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtShort = (iso) => {
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}, ${DAYS_SHORT[dt.getDay()]}`;
};

const parseISODate = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toDateInput = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getQuarterRange = (date) => {
  const y = date.getFullYear();
  const qStartMonth = Math.floor(date.getMonth() / 3) * 3;
  const start = new Date(y, qStartMonth, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(y, qStartMonth + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getActiveHorizonLabel = (expectedClosingISO) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = parseISODate(expectedClosingISO);
  if (!d) return "Upcoming Prospects";
  d.setHours(0, 0, 0, 0);

  if (d < today) return "Upcoming Prospects";

  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;

  if (d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
    return "This Month";
  }

  if (d.getFullYear() === currentYear && d.getMonth() >= 6 && d.getMonth() <= 8) {
    return "This Quarter (Jul-Sep)";
  }

  if (d.getFullYear() === currentYear && d.getMonth() >= 9 && d.getMonth() <= 11) {
    return "Next Quarter (Oct-Dec)";
  }

  if (d.getFullYear() === nextYear) {
    return "Next Year";
  }

  return "Upcoming Prospects";
};

const getActiveBucketKey = (lead) => `ACTIVE • ${getActiveHorizonLabel(lead?.x_studio_expected_closing)}`;

const startOfYear = (y) => {
  const d = new Date(y, 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfYear = (y) => {
  const d = new Date(y, 11, 31);
  d.setHours(23, 59, 59, 999);
  return d;
};
const getPeriodRange = (key, today) => {
  const y = today.getFullYear();
  if (key === "All Time") return null;
  if (key === "This Month") return getMonthRange(today);
  if (key === "This Quarter") return getQuarterRange(today);
  if (key === "This Year") return { start: startOfYear(y), end: endOfYear(y) };
  return null;
};

const stripActivePrefix = (label) => String(label || "").replace(/^ACTIVE\s*•\s*/i, "");
const getUrgencyMeta = (closingDate) => {
  if (!closingDate) return { label: "—", type: "none", bg: "#d1d5db", text: "#9ca3af" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = parseISODate(closingDate);
  if (!parsed) return { label: "—", type: "none", bg: "#d1d5db", text: "#9ca3af" };
  parsed.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((parsed - today) / 86400000);
  if (diffDays < 0) return { label: "OVERDUE", type: "overdue", bg: "#ef4444", text: "#ffffff" };
  if (diffDays === 0) return { label: "TODAY", type: "today", bg: "#FF4500", text: "#ffffff" };
  if (diffDays === 1) return { label: "TOMORROW", type: "tomorrow", bg: "#E38B00", text: "#ffffff" };
  if (diffDays <= 7) return { label: "THIS WEEK", type: "week", bg: "#eab308", text: "#ffffff" };
  return { label: "UPCOMING", type: "upcoming", bg: "#22c55e", text: "#ffffff" };
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

const LABEL_GROUP_ORDER = [
  "Missed Opportunity without any action",
  "Missed Opportunity",
  "Missed Opportunity despite Sales attempts",
  "Pending Sales Action",
  "Close to Due Date",
  "Prospect On Track",
  "Prospect Resulted in RFQ",
  "Not yet scored",
  "ERROR: No Expected Closing Date",
];

const LABEL_GROUP_COLORS = {
  "Missed Opportunity without any action": "#DC2626",
  "Missed Opportunity": "#DC2626",
  "Missed Opportunity despite Sales attempts": "#F97316",
  "Pending Sales Action": "#CA8A04",
  "Close to Due Date": "#CA8A04",
  "Prospect On Track": "#16A34A",
  "Prospect Resulted in RFQ": "#166534",
  "Not yet scored": "#6B7280",
  "ERROR: No Expected Closing Date": "#6B7280",
};

function getLeadLabelMeta(lead, engagementsByLead) {
  const leadEngagements = engagementsByLead[lead.id] || [];
  const hasCompleted = hasCompletedActivity(leadEngagements);
  const hasAny = hasAnyActivity(leadEngagements);
  return getHealthTagMeta(lead.x_studio_prospect_health, hasCompleted, hasAny);
}

// ─── MultiSelect (same pattern as VisitsTab) ──────────────────────────────────
function MultiSelect({ label, options, selected, onChange, searchable = false, searchPlaceholder = "Search..." }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  const isActive = selected.length > 0;
  const btnLabel = !isActive ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`;
  const visibleOptions = searchable
    ? options.filter((opt) => String(opt).toLowerCase().includes(searchQuery.toLowerCase()))
    : options;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => {
        setOpen((o) => {
          const next = !o;
          if (!next) setSearchQuery("");
          return next;
        });
      }} style={{
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
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: searchable ? 340 : 180, maxWidth: "80vw", maxHeight: 240, overflowY: "auto" }}>
          {searchable && (
            <div style={{ padding: 8, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.bgInput,
                  color: T.textPrimary,
                  fontFamily: "inherit",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: T.bgCard,
                    color: T.textMuted,
                    fontFamily: "inherit",
                    fontSize: 12,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {visibleOptions.map(opt => (
            <div key={opt} onClick={() => toggle(opt)} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: selected.includes(opt) ? T.accentBg : "transparent", color: selected.includes(opt) ? T.accent : T.textPrimary }}>
              <div style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 3, border: `1.5px solid ${selected.includes(opt) ? T.accent : T.borderMd}`, background: selected.includes(opt) ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selected.includes(opt) && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
              </div>
              {opt}
            </div>
          ))}
          {visibleOptions.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No options</div>}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options, prefix = "", width = 150 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div ref={ref} style={{ position: "relative", width, minWidth: width, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "6px 28px 6px 12px",
          borderRadius: 999,
          border: `1px solid ${T.border}`,
          background: T.bgCard,
          color: T.accent,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          outline: "none",
          cursor: "pointer",
          textAlign: "left",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {prefix}{selected?.label ?? value}
      </button>
      <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: T.accent, pointerEvents: "none" }}>{open ? "▲" : "▼"}</span>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "100%", zIndex: 300,
            background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)", maxHeight: 260, overflowY: "auto",
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: "8px 14px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                background: opt.value === value ? T.accentBg : "transparent",
                color: opt.value === value ? T.accent : T.textPrimary,
                fontWeight: opt.value === value ? 700 : 500,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UrgencyBadge({ closingDate, leadStatus }) {
  if (leadStatus !== "ACTIVE") {
    return <span style={{ color: "#d1d5db", fontSize: 13, whiteSpace: "nowrap" }}>—</span>;
  }
  const meta = getUrgencyMeta(closingDate);
  if (meta.type === "none") {
    return <span style={{ color: "#d1d5db", fontSize: 13, whiteSpace: "nowrap" }}>—</span>;
  }
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.5px",
        padding: "2px 6px",
        borderRadius: 3,
        color: meta.text,
        background: meta.bg,
        marginTop: 3,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

function formatClosingCellDate(iso) {
  if (!iso) return "No date";
  const dt = parseISODate(iso);
  if (!dt) return "No date";
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

function formatSimpleDate(iso) {
  if (!iso) return "—";
  const dt = parseISODate(iso);
  if (!dt) return "—";
  return `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

function getEngagementDisplayDateMeta(engagement) {
  const status = engagement?.x_studio_engagement_status;
  if (status === "Completed" && engagement?.x_studio_completed_date) {
    return {
      date: engagement.x_studio_completed_date,
      label: "Completed",
      detailLabel: "Completed Date",
      color: T.success,
      bg: T.successBg,
    };
  }
  if (status === "Cancelled") {
    return {
      date: null,
      label: null,
      detailLabel: null,
      color: T.textMuted,
      bg: T.bgInput,
    };
  }
  if (status === "Rescheduled" && engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      // label: "Rescheduled",
      detailLabel: "Rescheduled Date",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.14)",
    };
  }
  if (engagement?.x_studio_planned_date) {
    return {
      date: engagement.x_studio_planned_date,
      label: "Planned Date",
      detailLabel: "Planned Date",
      color: "#64748B",
      bg: "rgba(100,116,139,0.12)",
    };
  }
  if (engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      label: "Rescheduled",
      detailLabel: "Rescheduled Date",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.14)",
    };
  }
  return {
    date: null,
    label: "Planned Date",
    detailLabel: "Planned Date",
    color: T.textMuted,
    bg: T.bgInput,
  };
}

function getPrimaryEngagement(engagements) {
  if (!Array.isArray(engagements) || engagements.length === 0) return null;
  const statusOrder = { Rescheduled: 0, Planned: 1, Completed: 2, Cancelled: 3 };
  return [...engagements].sort((a, b) => {
    const sa = statusOrder[a?.x_studio_engagement_status] ?? 99;
    const sb = statusOrder[b?.x_studio_engagement_status] ?? 99;
    if (sa !== sb) return sa - sb;

    const da = parseISODate(getEngagementDisplayDateMeta(a).date);
    const db = parseISODate(getEngagementDisplayDateMeta(b).date);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return (a?.id || 0) - (b?.id || 0);
  })[0];
}

function ActivityDetailModal({ engagement, lead, userMap, onClose }) {
  if (!engagement) return null;

  const status = engagement.x_studio_engagement_status || "Unknown";
  const assignedTo = getPersonNames(engagement.x_studio_action_by, userMap);
  const customer = lead?.partner_id?.[1] || engagement.x_crm_lead_id?.[1] || "—";
  const remarks = engagement.x_studio_remarkscomments || "—";
  const { date: detailDate, detailLabel, label: datePillLabel, color: datePillColor, bg: datePillBg } = getEngagementDisplayDateMeta(engagement);
  const statusColors = { Planned: T.accent, Completed: T.success, Cancelled: T.danger, Rescheduled: "#F59E0B" };
  const statusBgs = { Planned: T.accentBg, Completed: T.successBg, Cancelled: T.dangerBg, Rescheduled: T.warningBg };

  const Field = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 14, color: color || T.textPrimary, fontWeight: 500, lineHeight: 1.5, wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.24)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', 'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card fade-in"
        style={{ position: "relative", zIndex: 1001, width: 620, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", padding: "20px 22px", borderRadius: 14, background: T.bgCard, border: `1px solid ${T.border}`, boxShadow: "0 12px 28px rgba(15,23,42,0.12)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: T.textPrimary }}>Activity Detail</div>
            <span className="pill" style={{ background: statusBgs[status] || T.bgInput, color: statusColors[status] || T.textMuted, fontSize: 10, fontWeight: 700 }}>{status}</span>
          </div>
          <button onClick={onClose} style={{ background: T.bgInput, border: `1px solid ${T.border}`, fontSize: 16, cursor: "pointer", color: T.textMuted, lineHeight: 1, padding: "6px 10px", borderRadius: 8, fontFamily: "inherit" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "18px 24px", marginBottom: 16 }}>
          <Field label="Customer" value={customer} />
          <Field label="Opportunity" value={lead?.name || engagement.x_crm_lead_id?.[1]} />
          <Field label="Engagement Type" value={engagement.x_studio_engagement_type || "—"} />
          <Field label="Engagement With" value={engagement.x_studio_engagement_with || "—"} />
          <Field label="Assigned To" value={assignedTo} />
          <Field label="Expected Value" value={lead?.expected_revenue > 0 ? fmtByCurrency(lead.expected_revenue, lead.x_studio_currency || "INR") : "—"} color={lead?.expected_revenue > 0 ? T.success : T.textMuted} />
          <Field label="Region" value={lead?.x_studio_responsible_region_1 || "—"} color={REGION_COLORS[lead?.x_studio_responsible_region_1] || T.textPrimary} />
        </div>

        {detailLabel && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "18px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" }}>{detailLabel}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {datePillLabel === "Rescheduled" && (
                  <span className="pill" style={{ background: datePillBg, color: datePillColor }}>{datePillLabel}</span>
                )}
                <span style={{ fontSize: 14, color: datePillColor, fontWeight: 600 }}>{formatSimpleDate(detailDate)}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 6 }}>Remarks / Comments</div>
          <div style={{ fontSize: 14, color: remarks === "—" ? T.textMuted : T.textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{remarks}</div>
        </div>

        {lead?.id && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-start" }}>
            <a
              href={`${ODOO_BASE_URL}/odoo/crm/${lead.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
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
              }}
            >
              View in Odoo →
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Lead Card (used in both List and Kanban views) ───────────────────────────
export function LeadCard({ lead, onClose, uniform = false }) {
  const [hovered, setHovered] = useState(false);
  if (!lead) return null;
  const urg = URGENCY[getUrgency(lead.x_studio_expected_closing)];
  const closingDate = fmtShort(lead.x_studio_expected_closing);
  const regionColor = REGION_COLORS[lead.x_studio_responsible_region_1] || T.textMuted;
  const statusVal = lead.x_studio_lead_status;
  const pill = getPill(statusVal);

  const Field = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div
        title={uniform && value ? value : undefined}
        style={{ fontSize: 12, color: color || T.textPrimary, fontWeight: 500, lineHeight: 1.35, overflowWrap: "anywhere", wordBreak: "break-word", ...(uniform ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : null) }}
      >
        {value || "—"}
      </div>
    </div>
  );

  if (uniform) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered ? T.bgCardAlt : T.bgCard,
          border: `1px solid ${T.border}`,
          boxShadow: hovered ? T.shadowMd : T.shadowSm,
          borderRadius: 12,
          padding: "10px 12px",
          transition: "all 0.15s",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 188,
          height: "100%",
        }}
      >
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
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

        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 35 }}>
          {lead.name}
        </div>

        <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {lead.partner_id?.[1] || lead.partner_name || "—"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
          <Field label="Assigned Salesperson" value={lead.x_studio_assigned_salesperson?.[1]} />
          <Field label="Deal Value" value={lead.expected_revenue > 0 ? fmtByCurrency(lead.expected_revenue, lead.x_studio_currency || "INR") : null} color={T.success} />
          <Field label="Closing" value={closingDate || "No date"} color={closingDate ? urg.dateColor : T.textMuted} />
          <Field label="Sales Lead" value={lead.x_studio_sales_lead?.[1]} />
        </div>

        <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <a
            href={`${ODOO_BASE_URL}/odoo/crm/${lead.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: T.accentBg, color: T.accent, border: `1px solid ${T.accentBdr}`,
              textDecoration: "none", transition: "background 0.15s, box-shadow 0.15s",
              letterSpacing: "0.2px",
            }}
          >
            View in Odoo →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.bgCardAlt : T.bgCard,
        border: `1px solid ${T.border}`,
        boxShadow: hovered ? T.shadowMd : T.shadowSm,
        borderRadius: 12,
        padding: "10px 12px",
        transition: "all 0.15s",
        marginBottom: onClose ? 12 : 8,
        marginTop: onClose ? 8 : 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative"
      }}
    >
      {onClose && (
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "50%", cursor: "pointer", fontSize: 14, color: T.textMuted, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>×</button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
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

        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          {closingDate && (
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              background: urg.border === "transparent" ? "transparent" : urg.border,
              flexShrink: 0, marginTop: 4,
            }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, lineHeight: 1.4, wordBreak: "break-word", ...(uniform ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : null) }}>
            {lead.name}
          </div>
        </div>

        <Field label="Company" value={lead.partner_id?.[1] || lead.partner_name} />

        <div style={{ display: "grid", gridTemplateColumns: onClose ? "repeat(auto-fit, minmax(140px, 1fr))" : "1fr 1fr", gap: "6px 10px" }}>
          <Field label="Assigned Salesperson" value={lead.x_studio_assigned_salesperson?.[1]} />
          <Field label="Sales Lead" value={lead.x_studio_sales_lead?.[1]} />
          <Field label="Deal Value" value={lead.expected_revenue > 0 ? fmtByCurrency(lead.expected_revenue, lead.x_studio_currency || "INR") : null} color={T.success} />
          <Field label="Lead Status" value={lead.x_studio_lead_status} />
          <Field label="Closing" value={closingDate || "No date"} color={closingDate ? urg.dateColor : T.textMuted} />
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div style={{ height: 1, background: T.border, marginBottom: 8 }} />
        <a
          href={`${ODOO_BASE_URL}/odoo/crm/${lead.id}`}
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
function InteractiveDonut({ title, infoText = null, segments, total, centerLabel, onSegmentClick, activeKey, legendMaxHeight = null }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [hoveringInfo, setHoveringInfo] = useState(false);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!showInfo) return undefined;
    const handlePointerDown = (event) => {
      if (infoRef.current && !infoRef.current.contains(event.target)) setShowInfo(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowInfo(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showInfo]);

  const size = 120, cx = size / 2, cy = size / 2;
  const R_BASE = 44, R_HOVER = 48;
  const SW_BASE = 14, SW_HOVER = 11;
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
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>{title}</div>
        {infoText && (
          <div ref={infoRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              aria-label={`What does "${title}" mean?`}
              onMouseEnter={() => { setHoveringInfo(true); setShowInfo(true); }}
              onMouseLeave={() => setHoveringInfo(false)}
              onClick={() => setShowInfo((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                padding: 0,
                borderRadius: "50%",
                border: `1px solid ${showInfo || hoveringInfo ? T.accent : T.textMuted}`,
                background: "none",
                color: showInfo || hoveringInfo ? T.accent : T.textMuted,
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "color 0.15s ease, border-color 0.15s ease",
              }}
            >
              ?
            </button>
            {showInfo && (
              <div
                role="tooltip"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: 240,
                  maxWidth: "min(240px, calc(100vw - 40px))",
                  background: T.bgCard,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
                  padding: "10px 12px",
                  zIndex: 30,
                  fontSize: 11,
                  fontWeight: 400,
                  textTransform: "none",
                  letterSpacing: "normal",
                  color: T.textSecondary,
                  lineHeight: 1.45,
                }}
              >
                {infoText}
              </div>
            )}
          </div>
        )}
      </div>
      {segs.length === 0 ? (
        <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>No data</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
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
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center", padding: "0 6px" }}>
              {hovered ? (
                <>
                  <div style={{ fontSize: 9, fontWeight: 800, color: hovered.color, lineHeight: 1.2, maxWidth: 66 }}>{hovered.displayKey || hovered.key}</div>
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
          <div style={{ flex: 1, minWidth: 0, maxHeight: legendMaxHeight || undefined, overflowY: legendMaxHeight ? "auto" : "visible", paddingRight: legendMaxHeight ? 4 : 0 }}>
            {segs.map(seg => {
              const isActive = activeKey === seg.key;
              return (
                <div key={seg.key}
                  onClick={() => onSegmentClick && onSegmentClick(seg.key)}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7,
                    cursor: "pointer",
                    opacity: hoveredKey && hoveredKey !== seg.key ? 0.4 : 1,
                    transition: "opacity 0.15s",
                    borderLeft: `3px solid ${isActive ? seg.color : "transparent"}`,
                    background: isActive ? `${seg.color}12` : "transparent",
                    borderRadius: 4, paddingLeft: 5,
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span title={seg.displayKey || seg.key} style={{ fontSize: 11, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {seg.displayKey || seg.key}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{fmt(seg.rev)}</span>
                      <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{seg.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueDonut({ leads, onSegmentClick, activeKey, breakdownEnabled }) {
  const byStatus = {};
  leads.forEach(l => {
    const s = l.x_studio_lead_status ? String(l.x_studio_lead_status).trim() : null;
    if (!s) return;
    const key = s === "ACTIVE" && breakdownEnabled ? getActiveBucketKey(l) : s;
    const activeBucketColors = {
      "ACTIVE • This Month": "#EA580C",
      "ACTIVE • This Quarter (Jul-Sep)": "#D97706",
      "ACTIVE • Next Quarter (Oct-Dec)": "#02818A",
      "ACTIVE • Next Year": "#7C3AED",
      "ACTIVE • Upcoming Prospects": "#16A34A",
    };
    const color = s === "ACTIVE" && breakdownEnabled
      ? (activeBucketColors[key] || "#EA9400")
      : getPill(s).text;
    if (!byStatus[key]) byStatus[key] = { rev: 0, count: 0, color };
    byStatus[key].rev += l.expected_revenue || 0;
    byStatus[key].count += 1;
  });
  const entries = Object.entries(byStatus)
    .filter(([, d]) => d.rev > 0)
    .sort((a, b) => b[1].rev - a[1].rev);
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const segments = entries.map(([key, d]) => ({ key, displayKey: stripActivePrefix(key), ...d }));
  return <InteractiveDonut title="REVENUE BY LEAD STATUS" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} />;
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
    const k = l.x_studio_assigned_salesperson?.[1] || "Unassigned";
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
  return <InteractiveDonut title="Revenue by Assigned Salesperson" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} />;
}

function LabelDonut({ leads, engagementsByLead, onSegmentClick, activeKey }) {
  const byLabel = {};
  leads.forEach((lead) => {
    const meta = getLeadLabelMeta(lead, engagementsByLead);
    const key = meta.text || "Not yet scored";
    if (!byLabel[key]) {
      byLabel[key] = {
        rev: 0,
        count: 0,
        color: LABEL_GROUP_COLORS[key] || meta.textColor || T.textMuted,
      };
    }
    byLabel[key].rev += lead.expected_revenue || 0;
    byLabel[key].count += 1;
  });

  const entries = Object.entries(byLabel)
    .filter(([, d]) => d.rev > 0 || d.count > 0)
    .sort((a, b) => {
      const ia = LABEL_GROUP_ORDER.indexOf(a[0]);
      const ib = LABEL_GROUP_ORDER.indexOf(b[0]);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a[0].localeCompare(b[0]);
    });
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const segments = entries.map(([key, d]) => ({ key, ...d }));
  return <InteractiveDonut title="Revenue by Label" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} legendMaxHeight={136} />;
}

function CustomerDonut({ leads, onSegmentClick, activeKey }) {
  const byCustomer = {};
  leads.forEach((l) => {
    const k = l.partner_id?.[1] || l.partner_name || "No Customer";
    if (!byCustomer[k]) byCustomer[k] = { rev: 0, count: 0, color: null };
    byCustomer[k].rev += l.expected_revenue || 0;
    byCustomer[k].count += 1;
  });

  const entries = Object.entries(byCustomer).filter(([, d]) => d.rev > 0).sort((a, b) => b[1].rev - a[1].rev);
  const total = entries.reduce((s, [, d]) => s + d.rev, 0) || 1;
  const keys = entries.map(([k]) => k);
  const colorMap = {};
  keys.forEach((k, i) => { colorMap[k] = PERSON_COLORS[i % PERSON_COLORS.length]; });
  const segments = entries.map(([key, d]) => ({ key, ...d, color: colorMap[key] }));
  return <InteractiveDonut title="Revenue by Customer" segments={segments} total={total} centerLabel="Pipeline" onSegmentClick={onSegmentClick} activeKey={activeKey} legendMaxHeight={136} />;
}

// ─── Greenfield vs Brownfield pie chart ──────────────────────────────────────
const GB_PIE_COLORS = {
  "Greenfield": { bg: "rgba(16,185,129,0.12)", solid: "#059669" },
  "Brownfield": { bg: "rgba(120,80,40,0.12)", solid: "#8B5A2B" },
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
  return (
    <InteractiveDonut
      title="Greenfield vs Brownfield"
      infoText="Greenfield refers to projects or investments on undeveloped land, while brownfield involves redevelopment or expansion of existing sites."
      segments={segments}
      total={total}
      centerLabel="Total"
      onSegmentClick={onSegmentClick}
      activeKey={activeKey}
    />
  );
}

// Segment color per native currency, shown as stacked bar segments in MonthBar.
const CURRENCY_BAR_COLORS = { INR: T.warning, AED: T.success, USD: "#1E3A8A" };
const CURRENCY_STACK_ORDER = ["INR", "AED", "USD"];

// ─── MonthBar — owns its own hover state (fixes useState-in-map violation) ────
// Each bar is segmented by the native currency of the leads that make it up
// (orange = INR, green = AED, navy = USD), sized by each segment's share of
// the month's total (already converted to the selected display currency).
// Segments are individually clickable (like a donut slice) and show their
// own amount on hover in place of the month total.
function MonthBar({ monthKey, data, activeCurrency, isMonthActive, maxRev, onSegmentClick, currency }) {
  const [hoveredCur, setHoveredCur] = useState(null);
  const maxBarH = 78;
  const minBarH = 4;
  const safeMax = maxRev > 0 ? maxRev : 1;
  const scaled = Math.sqrt((data.total || 0) / safeMax) * (maxBarH - minBarH);
  const barH = Math.max(minBarH, scaled + minBarH);

  const segments = CURRENCY_STACK_ORDER
    .map((cur) => ({ cur, value: data.byCurrency[cur] || 0 }))
    .concat(Object.keys(data.byCurrency)
      .filter((cur) => !CURRENCY_STACK_ORDER.includes(cur))
      .map((cur) => ({ cur, value: data.byCurrency[cur] })))
    .filter((s) => s.value > 0);

  const hoveredSeg = hoveredCur ? segments.find((s) => s.cur === hoveredCur) : null;
  const topLabelColor = hoveredSeg ? (CURRENCY_BAR_COLORS[hoveredSeg.cur] || T.textSecondary) : (isMonthActive ? T.accent : T.textSecondary);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52, flex: 1 }}>
      <div style={{ fontSize: 10, color: topLabelColor, fontWeight: isMonthActive || hoveredSeg ? 800 : 700, whiteSpace: "nowrap" }}>
        {hoveredSeg ? `${hoveredSeg.cur} ${fmtByCurrency(hoveredSeg.value, currency)}` : fmtByCurrency(data.total, currency)}
      </div>
      <div style={{ width: "100%", height: maxBarH, display: "flex", alignItems: "flex-end", marginTop: 2 }}>
        <div style={{ width: "100%", height: barH, minHeight: 4, borderRadius: "4px 4px 0 0", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
          {segments.length === 0
            ? <div style={{ width: "100%", height: "100%", background: "#CBD5E1" }} />
            : segments.map(({ cur, value }) => {
                const isActive = activeCurrency === cur;
                const dimmed = hoveredCur && hoveredCur !== cur;
                return (
                  <div key={cur}
                    onClick={() => onSegmentClick(monthKey, cur)}
                    onMouseEnter={() => setHoveredCur(cur)}
                    onMouseLeave={() => setHoveredCur(null)}
                    title={`${cur}: ${fmtByCurrency(value, currency)}`}
                    style={{
                      width: "100%",
                      height: `${(value / data.total) * 100}%`,
                      background: CURRENCY_BAR_COLORS[cur] || "#CBD5E1",
                      opacity: dimmed ? 0.4 : 1,
                      boxShadow: isActive ? "inset 0 0 0 2px rgba(255,255,255,0.9)" : "none",
                      cursor: "pointer",
                      transition: "opacity 0.15s",
                    }}
                  />
                );
              })}
        </div>
      </div>
      <div style={{ fontSize: 10, color: isMonthActive ? T.accent : T.textSecondary, fontWeight: isMonthActive ? 700 : 400, whiteSpace: "nowrap" }}>{data.label}</div>
    </div>
  );
}

// ─── Projected Monthly Closings bar chart (clickable drill-down) ──────────────
// Each lead carries its own x_studio_currency (INR/AED/USD/...). Bars are
// segmented by that native currency (converted to the selected display
// currency for sizing) so the composition of each month is visible at a
// glance. Each segment is its own clickable drill-down (month + currency),
// same interaction model as the donut charts elsewhere on this tab.
function MonthlyClosings({ leads, selectedMonth, selectedCurrency, onSegmentClick }) {
  const [displayCurrency, setDisplayCurrency] = useState("INR");
  const [fx, setFx] = useState({ rates: FALLBACK_RATES, live: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetchFxRates().then((result) => { if (!cancelled) setFx({ ...result, loading: false }); });
    return () => { cancelled = true; };
  }, []);

  const monthMap = {};
  let usedConversion = false;
  leads.forEach(l => {
    if (!l.x_studio_expected_closing) return;
    const [y, m] = l.x_studio_expected_closing.split("T")[0].split("-").map(Number);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { label: `${MONTHS_SHORT[m - 1]} '${String(y).slice(2)}`, total: 0, byCurrency: {} };
    const amount = l.expected_revenue || 0;
    const nativeCurrency = (l.x_studio_currency || "INR").toUpperCase();
    const value = nativeCurrency === displayCurrency ? amount : convertAmount(amount, nativeCurrency, displayCurrency, fx.rates);
    if (nativeCurrency !== displayCurrency && amount) usedConversion = true;
    monthMap[key].total += value;
    monthMap[key].byCurrency[nativeCurrency] = (monthMap[key].byCurrency[nativeCurrency] || 0) + value;
  });
  const entries = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 12);
  const maxRev = Math.max(...entries.map(([, d]) => d.total), 1);
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>Projected Closing Revenue</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>Show in</span>
          <FilterSelect
            value={displayCurrency}
            onChange={setDisplayCurrency}
            options={CURRENCY_OPTIONS.map(c => ({ value: c, label: c }))}
            width={78}
          />
          {selectedMonth && (
            <button onClick={() => onSegmentClick(null, null)} style={{ fontSize: 11, color: T.accent, background: T.accentBg, border: `1px solid ${T.accentBdr}`, borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>✕ Clear</button>
          )}
        </div>
      </div>
      {entries.length === 0 ? (
        <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0" }}>No closing revenue in this period.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, overflowX: "auto" }}>
            {entries.map(([key, d]) => (
              <MonthBar
                key={key}
                monthKey={key}
                data={d}
                isMonthActive={selectedMonth === key}
                activeCurrency={selectedMonth === key ? selectedCurrency : null}
                maxRev={maxRev}
                onSegmentClick={onSegmentClick}
                currency={displayCurrency}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 10, color: T.textMuted, flexWrap: "wrap" }}>
            {CURRENCY_STACK_ORDER.map((cur) => (
              <span key={cur} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CURRENCY_BAR_COLORS[cur], display: "inline-block" }} />
                {cur}
              </span>
            ))}
          </div>
          {usedConversion && !fx.live && !fx.loading && (
            <div style={{ marginTop: 6, fontSize: 10, color: T.textMuted }}>
              Live FX rates unavailable — conversions use an approximate rate.
            </div>
          )}
          {selectedMonth && (
            <div style={{ marginTop: 8, fontSize: 11, color: T.accent, fontWeight: 600 }}>
              Showing leads closing in {monthMap[selectedMonth]?.label}{selectedCurrency ? ` (${selectedCurrency} only)` : ""} — scroll down to see them
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverallProspectHealthCard({ leads, engagementsByLead }) {
  const [showInfo, setShowInfo] = useState(false);
  const [hoveringInfo, setHoveringInfo] = useState(false);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!showInfo) return undefined;
    const handlePointerDown = (event) => {
      if (infoRef.current && !infoRef.current.contains(event.target)) {
        setShowInfo(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowInfo(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showInfo]);

  const scoredEntries = leads
    .map((lead) => {
      const position = HEALTH_POSITIONS[String(lead?.x_studio_prospect_health || "").trim()];
      return typeof position === "number" && !Number.isNaN(position) ? { lead, position } : null;
    })
    .filter(Boolean);

  const scoredPositions = scoredEntries.map((entry) => entry.position);

  const averagePosition = scoredPositions.length
    ? scoredPositions.reduce((sum, position) => sum + position, 0) / scoredPositions.length
    : null;

  const averageLabel = averagePosition == null ? null : getClosestHealthTier(averagePosition);

  return (
    <div className="card" style={{ padding: "14px 14px", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 12, position: "relative" }}>
        <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.55px", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
          Overall Prospect Health
        </div>
        <div
          ref={infoRef}
          onMouseEnter={() => {
            setHoveringInfo(true);
            setShowInfo(true);
          }}
          onMouseLeave={() => setHoveringInfo(false)}
          style={{ position: "relative", flexShrink: 0 }}
        >
          <button
            type="button"
            aria-label="How is Overall Prospect Health calculated?"
            onClick={() => setShowInfo((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 14,
              height: 14,
              padding: 0,
              margin: 0,
              borderRadius: "50%",
              border: `1px solid ${showInfo || hoveringInfo ? T.accent : T.textMuted}`,
              background: "none",
              fontSize: 9,
              fontWeight: 700,
              color: showInfo || hoveringInfo ? T.accent : T.textMuted,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 0.15s ease, border-color 0.15s ease",
            }}
          >
            ?
          </button>
          {showInfo && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 660,
                maxWidth: "min(660px, calc(100vw - 40px))",
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
                padding: "14px 18px",
                maxHeight: "min(750px, calc(100vh - 100px))",
                overflowY: "auto",
                zIndex: 30,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, color: T.textPrimary, marginBottom: 8, letterSpacing: "0.4px", textTransform: "uppercase" }}>
                How this is calculated
              </div>
              <AggregateTooltipContent />
            </div>
          )}
        </div>
      </div>

      {averagePosition == null ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 112, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <HealthSpeedometer value="" size={76} fallbackLabel="Not yet scored" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>No scored records</div>
              <div style={{ fontSize: 10, color: T.textMuted, maxWidth: 130, lineHeight: 1.4 }}>
                Update the filtered leads with prospect health to see the overall average.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flex: 1, minHeight: 112, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div>
              <HealthSpeedometer value={averageLabel} position={averagePosition} size={76} fallbackLabel={averageLabel} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div
                style={{ fontSize: 15, fontWeight: 800, color: T.textPrimary, lineHeight: 1.15, overflowWrap: "anywhere" }}
              >
                {averageLabel}
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.2 }}>Average across {scoredPositions.length} filtered record{scoredPositions.length === 1 ? "" : "s"}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.accent, lineHeight: 1 }}>
              {averagePosition.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, color: T.textMuted, marginTop: 4, lineHeight: 1.1, whiteSpace: "nowrap" }}>
              Score is out of 100
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────
const SORT_KEYS = { "Closing Date": "closing", "Expected Value": "value", "Project Type": "type" };
const SORT_ACCESSORS = {
  closing: (l) => l.x_studio_expected_closing || "",
  value: (l) => l.expected_revenue || 0,
  type: (l) => l.x_studio_project_background || "",
};
const LIST_HEADER_LABELS = ["Opportunity Name", "Bidders", "SBU Type", "Closing Date", "Status", "Expected Value", "Category", "Category Scaled Value", "Region", "Assigned Salesperson", "Project Type", "Activities"];
// Relative column weights (fr), so the table stretches/shrinks with the window; MIN_COL_PX is the floor.
const DEFAULT_LIST_COL_WIDTHS = [26, 14, 8, 8, 8, 9, 6, 9, 8, 10, 9, 16];
const LIST_COL_WIDTHS_STORAGE_KEY = "adage_crm_pipeline_list_col_weights_v2";
const MIN_COL_PX = 60;
const listGridTemplate = (weights) => weights.map((w) => `minmax(${MIN_COL_PX}px, ${w}fr)`).join(" ");

// Cat A = full expected value, Cat B = half; anything else has no scaled value.
const getScaledRevenue = (lead) => {
  const category = String(lead.x_studio_category || "").toUpperCase();
  const revenue = lead.expected_revenue || 0;
  return /\bB$/.test(category) ? revenue / 2 : /\bA$/.test(category) ? revenue : 0;
};

function ListRow({ lead, activity, userMap, bidderMap = {}, onActivityClick, healthHasCompleted, healthHasAnyActivity }) {
  const [hovered, setHovered] = useState(false);
  const regionColor = REGION_COLORS[lead.x_studio_responsible_region_1] || T.textMuted;
  const salesperson = lead.x_studio_assigned_salesperson?.[1] || "—";
  const company = lead.partner_id?.[1] || lead.partner_name || lead.x_studio_end_user?.[1] || "—";
  const bidderNames = (Array.isArray(lead.x_studio_bidders) ? lead.x_studio_bidders : [])
    .map((p) => getPersonName(p, bidderMap))
    .filter(Boolean);
  const closingLabel = formatClosingCellDate(lead.x_studio_expected_closing);
  const projectType = lead.x_studio_project_background || "—";
  const scaledRevenue = getScaledRevenue(lead);
  const activityAssigned = activity ? getPersonNames(activity.x_studio_action_by, userMap) : "—";
  const openInOdoo = () => window.open(`${ODOO_BASE_URL}/odoo/crm/${lead.id}`, "_blank", "noopener,noreferrer");

  return (
    <div
      className="pipeline-list-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={openInOdoo}
      style={{ background: hovered ? "#f0fdfd" : "#ffffff", cursor: "pointer" }}
    >
      <div className="col-opportunity">
        <div className="opp-title">
          {lead.name}
        </div>
        <div className="opp-company">
          {company}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, minWidth: 0 }}>
          <HealthTag
            health={lead.x_studio_prospect_health}
            hasCompleted={healthHasCompleted}
            hasAnyActivity={healthHasAnyActivity}
            expectedClosingISO={lead.x_studio_expected_closing}
            compact
          />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {bidderNames.length > 0
          ? bidderNames.map((name) => (
              <span
                key={name}
                title={name}
                style={{
                  fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 999,
                  background: "#F1F5F9", color: "#475569",
                  maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {name}
              </span>
            ))
          : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
      </div>

      <div style={{ fontSize: 11.5, color: "#374151" }}>{lead.x_studio_sbu || "—"}</div>

      <div style={{ fontSize: 11.5, color: "#374151" }}>{closingLabel}</div>

      <div>
        <UrgencyBadge closingDate={lead.x_studio_expected_closing} leadStatus={lead.x_studio_lead_status} />
      </div>

      <div className="col-value">
          {lead.expected_revenue > 0 ? fmtByCurrency(lead.expected_revenue, lead.x_studio_currency || "INR") : "—"}
      </div>

      <div style={{ fontSize: 11.5, color: "#374151" }}>{lead.x_studio_category || "—"}</div>

      <div className="col-value">
        {scaledRevenue > 0 ? fmtByCurrency(scaledRevenue, lead.x_studio_currency || "INR") : "—"}
      </div>

      <div>
        {lead.x_studio_responsible_region_1
          ? <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 999, background: `${regionColor}18`, color: regionColor }}>
              {lead.x_studio_responsible_region_1}
            </span>
          : <span style={{ fontSize: 10, color: "#9ca3af" }}>—</span>}
      </div>

      <div className="col-salesperson">
        {salesperson}
      </div>

      <div>
        {projectType !== "—"
          ? <span style={{ fontSize: 9.5, fontWeight: 600, padding: "1px 6px", borderRadius: 100, background: getProjectTypePill(projectType).bg, color: getProjectTypePill(projectType).color }}>{projectType}</span>
          : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        {activity ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onActivityClick(activity); }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 1,
              width: "100%",
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: hovered ? T.accentBg : T.bgCard,
              color: T.textPrimary,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#7C3AED", lineHeight: 1.25 }}>
              {activity.x_studio_engagement_type || "Activity"}
            </span>
            <span style={{ fontSize: 10.5, color: T.textSecondary, lineHeight: 1.25 }}>
              {activityAssigned}
            </span>
            {activity.x_studio_engagement_with && (
              <span style={{ fontSize: 9.5, color: T.textMuted, lineHeight: 1.2 }}>
                With: {activity.x_studio_engagement_with}
              </span>
            )}
          </button>
        ) : (
          <span className="activity-count-empty">—</span>
        )}
      </div>
    </div>
  );
}



// ─── Main PipelineTab ─────────────────────────────────────────────────────────
export function PipelineTab({ leads, engagements = [], userMap = {}, bidderMap = {} }) {
  const defaultPeriod = "This Year";
  const [viewMode, setViewMode] = useState("list");
  const [groupBy, setGroupBy] = useState("status");
  const [sort, setSort] = useState(null); // { key: "closing" | "value", dir: "asc" | "desc" }
  const toggleSort = (key) => setSort((s) => (s?.key === key && s.dir === "asc" ? { key, dir: "desc" } : { key, dir: "asc" }));
  const [filterRegion, setFilterRegion] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [filterPerson, setFilterPerson] = useState([]);
  const [filterSbu, setFilterSbu] = useState([]);
  const [filterBidder, setFilterBidder] = useState([]);
  const [filterEndUser, setFilterEndUser] = useState([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef(null);
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(LIST_COL_WIDTHS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_LIST_COL_WIDTHS.length) return parsed;
      }
    } catch { /* ignore malformed/blocked storage */ }
    return DEFAULT_LIST_COL_WIDTHS;
  });
  const listGridRef = useRef(null);

  const startColumnResize = (e, index) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidths = colWidths;
    const startWidth = startWidths[index];
    // weight units per pixel, so dragging tracks the cursor at the current window width
    const header = e.currentTarget.closest(".pipeline-list-header");
    const weightPerPx = startWidths.reduce((a, b) => a + b, 0) / Math.max(1, (header?.clientWidth || 1200) - 32);
    let currentWidths = startWidths;
    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(MIN_COL_PX * weightPerPx, startWidth + delta * weightPerPx);
      currentWidths = startWidths.map((w, i) => (i === index ? newWidth : w));
      if (listGridRef.current) {
        listGridRef.current.style.setProperty("--list-grid-cols", listGridTemplate(currentWidths));
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setColWidths(currentWidths);
      try { localStorage.setItem(LIST_COL_WIDTHS_STORAGE_KEY, JSON.stringify(currentWidths)); } catch { /* ignore blocked storage */ }
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const range = getPeriodRange(defaultPeriod, today);
    return range ? toDateInput(range.start) : "";
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const range = getPeriodRange(defaultPeriod, today);
    return range ? toDateInput(range.end) : "";
  });
  const [periodFilter, setPeriodFilter] = useState(defaultPeriod);
  const [selectedMonth, setSelectedMonth] = useState(null); // "YYYY-MM" drill-down from bar chart
  const [selectedMonthCurrency, setSelectedMonthCurrency] = useState(null); // optional currency segment within selectedMonth
  const [donutFilter, setDonutFilter] = useState(null); // { kind: "lead_status" | "region" | "person" | "customer" | "label", key: string }
  const [filterProjectType, setFilterProjectType] = useState(null); // drill from GB donut
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Dropdown options
  const regionOptions = useMemo(() => [...new Set(leads.map(l => l.x_studio_responsible_region_1).filter(Boolean))].sort(), [leads]);
  const sbuOptions = useMemo(() => [...new Set(leads.map(l => l.x_studio_sbu).filter(Boolean))].sort(), [leads]);
  const personOptions = useMemo(() => [...new Set(leads.map(l => l.x_studio_assigned_salesperson?.[1]).filter(Boolean))].sort(), [leads]);
  const bidderOptions = useMemo(
    () => [...new Set(leads.flatMap((l) => (Array.isArray(l.x_studio_bidders) ? l.x_studio_bidders : []).map((p) => getPersonName(p, bidderMap))).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [leads, bidderMap]
  );
  const endUserOptions = useMemo(
    () => [...new Set(leads.map((l) => l.x_studio_end_user?.[1]).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [leads]
  );
  const statusOptions = useMemo(() => {
    const unique = [...new Set(leads.map(l => l.x_studio_lead_status).filter(Boolean))];
    const ordered = ["ACTIVE", "CONVERTED TO RFQ", "REGRET", "LOST", "DEAD"];
    const rest = unique.filter((s) => !ordered.includes(s)).sort();
    return ["All Statuses", ...ordered.filter((s) => unique.includes(s)), ...rest].map((value) => ({
      value,
      label: value === "All Statuses" ? "All" : value,
    }));
  }, [leads]);
  const periodOptions = useMemo(() => ([
    { value: "All Time", label: "All Time" },
    { value: "This Month", label: "This Month" },
    { value: "This Quarter", label: "This Quarter" },
    { value: "This Year", label: "This Year" },
    { value: "Custom Range", label: "Custom Range" },
  ]), []);
  const groupByOptions = useMemo(() => ([
    { value: "sbu", label: "SBU Type" },
    { value: "status", label: "Lead Status" },
    { value: "region", label: "Region" },
    { value: "person", label: "Person" },
    { value: "label", label: "Label" },
    { value: "bidder", label: "Bidders" },
    { value: "enduser", label: "End User" },
  ]), []);

  useEffect(() => { setDonutFilter(null); }, [groupBy]);
  useEffect(() => {
    if (!showFilterPanel) return undefined;
    const handlePointerDown = (e) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) setShowFilterPanel(false);
    };
    const handleEscape = (e) => { if (e.key === "Escape") setShowFilterPanel(false); };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showFilterPanel]);
  useEffect(() => {
    if (periodFilter === "Custom Range") return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const range = getPeriodRange(periodFilter, today);
    if (!range) {
      setDateFrom("");
      setDateTo("");
      return;
    }
    setDateFrom(toDateInput(range.start));
    setDateTo(toDateInput(range.end));
  }, [periodFilter]);
  const leadMap = useMemo(() => {
    const map = {};
    leads.forEach((lead) => { map[lead.id] = lead; });
    return map;
  }, [leads]);
  const engagementsByLead = useMemo(() => {
    const map = {};
    (engagements || []).forEach((engagement) => {
      const leadId = engagement?.x_crm_lead_id?.[0];
      if (!leadId) return;
      if (!map[leadId]) map[leadId] = [];
      map[leadId].push(engagement);
    });
    return map;
  }, [engagements]);
  const primaryActivityByLead = useMemo(() => {
    const map = {};
    Object.entries(engagementsByLead).forEach(([leadId, leadEngagements]) => {
      map[leadId] = getPrimaryEngagement(leadEngagements);
    });
    return map;
  }, [engagementsByLead]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (filterRegion.length > 0 && !filterRegion.includes(l.x_studio_responsible_region_1)) return false;
      if (filterSbu.length > 0 && !filterSbu.includes(l.x_studio_sbu)) return false;
      if (statusFilter !== "All Statuses" && l.x_studio_lead_status !== statusFilter) return false;
      if (filterPerson.length > 0 && !filterPerson.includes(l.x_studio_assigned_salesperson?.[1])) return false;
      if (filterBidder.length > 0) {
        const leadBidderNames = (Array.isArray(l.x_studio_bidders) ? l.x_studio_bidders : []).map((p) => getPersonName(p, bidderMap));
        if (!leadBidderNames.some((name) => filterBidder.includes(name))) return false;
      }
      if (filterEndUser.length > 0 && !filterEndUser.includes(l.x_studio_end_user?.[1])) return false;
      if (dateFrom || dateTo) {
        const d = parseISODate(l.x_studio_expected_closing);
        if (!d) return false;
        let from = dateFrom ? new Date(dateFrom) : null;
        let to = dateTo ? new Date(dateTo) : null;
        if (from) from.setHours(0, 0, 0, 0);
        if (to) to.setHours(23, 59, 59, 999);
        if (from && to && from > to) { const tmp = from; from = to; to = tmp; }
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (donutFilter?.kind === "lead_status") {
        const status = l.x_studio_lead_status ? String(l.x_studio_lead_status).trim() : null;
        if (!status) return false;
        if (String(donutFilter.key || "").startsWith("ACTIVE • ")) {
          if (status !== "ACTIVE") return false;
          if (getActiveBucketKey(l) !== donutFilter.key) return false;
        } else {
          if (status !== donutFilter.key) return false;
        }
      }
      if (donutFilter?.kind === "region") {
        const val = l.x_studio_responsible_region_1 ? String(l.x_studio_responsible_region_1).trim() : "No Region";
        if (val !== donutFilter.key) return false;
      }
      if (donutFilter?.kind === "person") {
        const val = l.x_studio_assigned_salesperson?.[1] || "Unassigned";
        if (val !== donutFilter.key) return false;
      }
      if (donutFilter?.kind === "label") {
        const val = getLeadLabelMeta(l, engagementsByLead).text || "Not yet scored";
        if (val !== donutFilter.key) return false;
      }
      if (donutFilter?.kind === "customer") {
        const val = l.partner_id?.[1] || l.partner_name || "No Customer";
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
        if (selectedMonthCurrency && (l.x_studio_currency || "INR").toUpperCase() !== selectedMonthCurrency) return false;
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
  }, [leads, filterRegion, filterSbu, statusFilter, filterPerson, filterBidder, filterEndUser, bidderMap, donutFilter, filterProjectType, selectedMonth, selectedMonthCurrency, searchQuery, dateFrom, dateTo]);

  // Group + sort
  const groups = useMemo(() => {
    const map = {};
    filteredLeads.forEach(l => {
      let key;
      if (groupBy === "region") key = l.x_studio_responsible_region_1 || "No Region";
      else if (groupBy === "person") key = l.x_studio_assigned_salesperson?.[1] || "Unassigned";
      else if (groupBy === "label") key = getLeadLabelMeta(l, engagementsByLead).text || "Not yet scored";
      else if (groupBy === "bidder") key = (Array.isArray(l.x_studio_bidders) && l.x_studio_bidders.length ? getPersonName(l.x_studio_bidders[0], bidderMap) : "") || "No Bidder";
      else if (groupBy === "enduser") key = l.x_studio_end_user?.[1] || "No End User";
      else if (groupBy === "sbu") key = l.x_studio_sbu || "No SBU";
      else if (groupBy === "status") key = l.x_studio_lead_status || "No Status";
      else key = l.x_studio_lead_status || "No Status";
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    // Sort each group
    Object.values(map).forEach(arr => {
      if (sort) {
        const f = SORT_ACCESSORS[sort.key];
        const dir = sort.dir === "asc" ? 1 : -1;
        const blank = (l) => !f(l);
        arr.sort((a, b) => blank(a) - blank(b) || (f(a) < f(b) ? -dir : f(a) > f(b) ? dir : 0)); // blanks always last
        return;
      }
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
    else if (groupBy === "status") keys.sort((a, b) => {
      const ia = STATUS_ORDER.indexOf(a);
      const ib = STATUS_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
    });
    else if (groupBy === "label") keys.sort((a, b) => {
      const ia = LABEL_GROUP_ORDER.indexOf(a);
      const ib = LABEL_GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
    });
    else keys.sort();
    return keys.map((key, i) => ({ key, leads: map[key], idx: i }));
  }, [filteredLeads, groupBy, engagementsByLead, bidderMap, sort]);

  const groupColor = (key, idx) => {
    if (groupBy === "region") return REGION_COLORS[key] || T.accent;
    if (groupBy === "person") return PERSON_COLORS[idx % PERSON_COLORS.length];
    if (groupBy === "label") return LABEL_GROUP_COLORS[key] || T.accent;
    if (groupBy === "bidder") return PERSON_COLORS[idx % PERSON_COLORS.length];
    if (groupBy === "enduser") return PERSON_COLORS[idx % PERSON_COLORS.length];
    if (groupBy === "sbu") return PERSON_COLORS[idx % PERSON_COLORS.length];
    if (groupBy === "status") return getPill(key).text;
    return getPill(key).text;
  };

  const handleSetViewMode = (mode) => { setViewMode(mode); };
  const activeFilterCategoryCount = [filterRegion, filterSbu, filterPerson, filterBidder, filterEndUser].filter((arr) => arr.length > 0).length;
  const anyFilter = filterRegion.length > 0
    || filterSbu.length > 0
    || filterPerson.length > 0
    || filterBidder.length > 0
    || filterEndUser.length > 0
    || searchQuery !== ""
    || periodFilter !== defaultPeriod
    || statusFilter !== "ACTIVE";

  const breakdownEnabled = statusFilter === "ACTIVE";

  const chartsRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const [{ default: ExcelJS }, { default: html2canvas }] = await Promise.all([import("exceljs"), import("html2canvas")]);
      const wb = new ExcelJS.Workbook();

      // Sheet 1: exactly the rows shown in the list view, in the same group order.
      const ws = wb.addWorksheet("Pipeline");
      const cols = [
        ["Odoo Link", 14], ["Group", 24], ["Opportunity Label", 38], ["Opportunity Name", 44], ["Bidders", 34], ["End User", 34],
        ["SBU Type", 16], ["Closing Date", 14], ["Status", 12], ["Expected Value", 16], ["Currency", 10], ["Category", 10],
        ["Category Scaled Value", 18], ["Region", 14], ["Assigned Salesperson", 24], ["Project Type", 18], ["Activity", 30],
      ];
      ws.columns = cols.map(([header, width]) => ({ header, width }));
      groups.forEach(({ key, leads: groupLeads }) => groupLeads.forEach((l) => {
        const activity = primaryActivityByLead[l.id];
        const row = ws.addRow([
          { text: "Open in Odoo", hyperlink: `${ODOO_BASE_URL}/odoo/crm/${l.id}` },
          key,
          getLeadLabelMeta(l, engagementsByLead).text || "Not yet scored",
          l.name,
          (Array.isArray(l.x_studio_bidders) ? l.x_studio_bidders : []).map((p) => getPersonName(p, bidderMap)).filter(Boolean).join(", "),
          l.partner_id?.[1] || l.partner_name || l.x_studio_end_user?.[1] || "",
          l.x_studio_sbu || "",
          l.x_studio_expected_closing ? String(l.x_studio_expected_closing).split("T")[0] : "",
          l.x_studio_lead_status === "ACTIVE" ? getUrgencyMeta(l.x_studio_expected_closing).label.replace("—", "") : "",
          l.expected_revenue || 0,
          l.x_studio_currency || "INR",
          l.x_studio_category || "",
          getScaledRevenue(l),
          l.x_studio_responsible_region_1 || "",
          l.x_studio_assigned_salesperson?.[1] || "",
          l.x_studio_project_background || "",
          activity ? `${activity.x_studio_engagement_type || "Activity"} - ${getPersonNames(activity.x_studio_action_by, userMap)}` : "",
        ]);
        row.getCell(1).font = { color: { argb: "FF0563C1" }, underline: true };
      }));
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: "A1", to: { row: 1, column: cols.length } };
      ["J", "M"].forEach((c) => { ws.getColumn(c).numFmt = "#,##0"; });

      // Sheet 2: dashboard snapshot (charts row) plus the filters and group totals behind it.
      const ds = wb.addWorksheet("Dashboard");
      ds.getColumn(1).width = 34;
      ds.getColumn(2).width = 14;
      ds.getColumn(3).width = 20;
      ds.addRow(["Pipeline Dashboard"]).font = { bold: true, size: 14 };
      ds.addRow(["Status", statusFilter]);
      ds.addRow(["Period", periodFilter === "Custom Range" || dateFrom || dateTo ? `${periodFilter} (${dateFrom || "…"} to ${dateTo || "…"})` : periodFilter]);
      ds.addRow(["Group by", groupByOptions.find((o) => o.value === groupBy)?.label || groupBy]);
      ds.addRow(["Leads", filteredLeads.length]);
      ds.addRow([]);
      const head = ds.addRow(["Group", "Leads", "Total Expected Value"]);
      head.font = { bold: true };
      groups.forEach(({ key, leads: groupLeads }) => ds.addRow([key, groupLeads.length, groupLeads.reduce((s, l) => s + (l.expected_revenue || 0), 0)]));
      ds.getColumn(3).numFmt = "#,##0";
      if (chartsRef.current) {
        try {
          const canvas = await html2canvas(chartsRef.current, { backgroundColor: "#ffffff", scale: 2 });
          const imageId = wb.addImage({ base64: canvas.toDataURL("image/png"), extension: "png" });
          ds.addImage(imageId, { tl: { col: 4, row: 1 }, ext: { width: canvas.width / 2, height: canvas.height / 2 } });
        } catch { /* snapshot is best-effort; the tables still export */ }
      }

      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .pipeline-list-header {
          display: grid;
          grid-template-columns: var(--list-grid-cols);
          padding: 5px 16px;
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .pipeline-list-header-cell {
          position: relative;
          display: flex;
          align-items: center;
          min-width: 0;
          padding-left: 8px;
          padding-right: 8px;
        }
        .pipeline-list-header-cell span {
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .pipeline-list-header span {
          font-size: 9.5px;
          font-weight: 700;
          color: #9ca3af;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }
        .col-resize-handle {
          position: absolute;
          top: 0;
          right: -8px;
          width: 16px;
          height: 100%;
          cursor: col-resize;
          z-index: 5;
        }
        .col-resize-handle::after {
          content: "";
          position: absolute;
          top: 15%;
          bottom: 15%;
          left: 50%;
          transform: translateX(-50%);
          width: 3px;
          border-radius: 3px;
          background: #02818A;
          opacity: 0.55;
        }
        .col-resize-handle:hover::after,
        .col-resize-handle:active::after {
          top: 8%;
          bottom: 8%;
          width: 4px;
          opacity: 1;
        }
        .col-resize-handle:hover,
        .col-resize-handle:active {
          background: rgba(2, 129, 138, 0.12);
        }
        .col-resize-hint {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          color: #9ca3af;
          font-size: 9px;
          font-weight: 700;
          font-family: inherit;
          cursor: help;
          z-index: 6;
          flex-shrink: 0;
        }
        .col-resize-hint:hover {
          border-color: #02818A;
          color: #02818A;
        }
        .pipeline-list-row {
          display: grid;
          grid-template-columns: var(--list-grid-cols);
          padding: 4px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: white;
          align-items: center;
          transition: background 0.15s;
          min-height: 34px;
        }
        .pipeline-list-row > div {
          text-align: left;
          border-right: 1px solid #f1f5f9;
          padding-right: 8px;
          padding-left: 8px;
          min-width: 0;
        }
        .pipeline-list-row > div:first-child {
          padding-left: 0;
        }
        .pipeline-list-row > div:last-child {
          border-right: none;
          padding-right: 0;
        }
        .col-opportunity {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding-right: 12px;
          min-width: 0;
        }
        .opp-title {
          font-size: 12.5px;
          font-weight: 600;
          color: #1e293b;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .opp-company {
          font-size: 10.5px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-value {
          font-size: 12.5px;
          font-weight: 700;
          color: #02818A;
          text-align: left;
        }
        .col-salesperson {
          font-size: 11.5px;
          color: #374151;
          font-weight: 500;
          line-height: 1.4;
          white-space: normal;
          word-break: break-word;
        }
        .activity-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #e0f2fe;
          color: #0284c7;
          font-size: 11px;
          font-weight: 700;
        }
        .activity-count-empty {
          color: #d1d5db;
          font-size: 13px;
        }
        .gf-bf-legend {
          display: flex;
          justify-content: center;
          gap: 28px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .gf-bf-legend-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .gf-bf-legend-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }
        .gf-bf-legend-value {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
        }
        .gf-bf-legend-count {
          font-size: 10px;
          color: #9ca3af;
        }
      `}</style>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", marginBottom: 10, padding: "10px 16px", borderRadius: 12, background: "#ffffff", border: `1px solid ${T.border}` }}>
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} prefix="Status: " width={148} />
        <FilterSelect value={periodFilter} onChange={setPeriodFilter} options={periodOptions} prefix="Period: " width={174} />
        <div ref={filterPanelRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowFilterPanel((v) => !v)}
            style={{
              padding: "6px 14px", borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: T.bgCard,
              color: T.accent,
              fontSize: 12, fontFamily: "inherit", fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}
          >
            <span>Filter By{activeFilterCategoryCount > 0 ? ` (${activeFilterCategoryCount})` : ""}</span>
            <span style={{ fontSize: 10 }}>{showFilterPanel ? "▲" : "▼"}</span>
          </button>
          {showFilterPanel && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 250,
                background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10,
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)", padding: 12,
                display: "flex", flexDirection: "column", gap: 8, minWidth: 200,
              }}
            >
              <MultiSelect label="SBU Type" options={sbuOptions} selected={filterSbu} onChange={setFilterSbu} />
              <MultiSelect label="Region" options={regionOptions} selected={filterRegion} onChange={setFilterRegion} />
              <MultiSelect label="Person" options={personOptions} selected={filterPerson} onChange={setFilterPerson} />
              <MultiSelect
                label="Bidders"
                options={bidderOptions}
                selected={filterBidder}
                onChange={setFilterBidder}
                searchable
                searchPlaceholder="Search bidder..."
              />
              <MultiSelect
                label="End User"
                options={endUserOptions}
                selected={filterEndUser}
                onChange={setFilterEndUser}
                searchable
                searchPlaceholder="Search end user..."
              />
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />
        <FilterSelect value={groupBy} onChange={setGroupBy} options={groupByOptions} prefix="Group by: " width={190} />
        <div style={{ flex: 1 }} />
        <button
          onClick={handleExport}
          disabled={exporting}
          title="Export the current list and dashboard to Excel"
          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.accent}`, background: T.bgCard, color: T.accent, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: exporting ? "wait" : "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
        >
          {exporting ? "Exporting…" : "⬇ Export Excel"}
        </button>
        <input
          type="text"
          placeholder="Search leads..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.bgInput,
            color: T.textPrimary,
            fontFamily: "inherit",
            fontSize: 12,
            width: 180,
            outline: "none"
          }}
        />
        <div style={{ display: "flex", borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden", flexShrink: 0 }}>
          <button onClick={() => handleSetViewMode("list")} style={{ background: viewMode === "list" ? T.accent : T.bgCard, color: viewMode === "list" ? "#fff" : T.textSecondary, border: "none", borderRight: `1px solid ${T.border}`, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 15 }} title="List view">≡</button>
          <button onClick={() => handleSetViewMode("kanban")} style={{ background: viewMode === "kanban" ? T.accent : T.bgCard, color: viewMode === "kanban" ? "#fff" : T.textSecondary, border: "none", padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }} title="Kanban view">⊞</button>
        </div>
        {anyFilter && (
          <button
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const range = getPeriodRange(defaultPeriod, today);
              setFilterRegion([]);
              setFilterSbu([]);
              setFilterPerson([]);
              setFilterBidder([]);
              setFilterEndUser([]);
              setStatusFilter("ACTIVE");
              setPeriodFilter(defaultPeriod);
              setDateFrom(range ? toDateInput(range.start) : "");
              setDateTo(range ? toDateInput(range.end) : "");
              setSearchQuery("");
              setDonutFilter(null);
              setFilterProjectType(null);
              setSelectedMonth(null);
            }}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: "none", color: T.textMuted, fontSize: 12, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}
          >
            ✕
          </button>
        )}
      </div>

      {periodFilter === "Custom Range" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 16px" }}>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgInput, color: T.textPrimary, fontFamily: "inherit", fontSize: 12, outline: "none" }}
          />
          <span style={{ fontSize: 12, color: T.textMuted }}>—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgInput, color: T.textPrimary, fontFamily: "inherit", fontSize: 12, outline: "none" }}
          />
        </div>
      )}

      {/* ── Charts row ── */}
      <div ref={chartsRef} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 0.92fr) minmax(0, 1.6fr)", gap: 10, marginBottom: donutFilter || filterProjectType ? 6 : 10 }}>
        {groupBy === "status" ? (
          <RevenueDonut
            leads={filteredLeads}
            activeKey={donutFilter?.kind === "lead_status" ? donutFilter.key : null}
            breakdownEnabled={breakdownEnabled}
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
        ) : groupBy === "person" ? (
          <PersonDonut
            leads={filteredLeads}
            activeKey={donutFilter?.kind === "person" ? donutFilter.key : null}
            onSegmentClick={(key) => {
              setDonutFilter(prev => (prev?.kind === "person" && prev.key === key) ? null : ({ kind: "person", key }));
              handleSetViewMode("list");
            }}
          />
        ) : groupBy === "label" ? (
          <LabelDonut
            leads={filteredLeads}
            engagementsByLead={engagementsByLead}
            activeKey={donutFilter?.kind === "label" ? donutFilter.key : null}
            onSegmentClick={(key) => {
              setDonutFilter(prev => (prev?.kind === "label" && prev.key === key) ? null : ({ kind: "label", key }));
              handleSetViewMode("list");
            }}
          />
        ) : (
          <CustomerDonut
            leads={filteredLeads}
            activeKey={donutFilter?.kind === "customer" ? donutFilter.key : null}
            onSegmentClick={(key) => {
              setDonutFilter(prev => (prev?.kind === "customer" && prev.key === key) ? null : ({ kind: "customer", key }));
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
        <OverallProspectHealthCard leads={filteredLeads} engagementsByLead={engagementsByLead} />
        <MonthlyClosings
          leads={filteredLeads}
          selectedMonth={selectedMonth}
          selectedCurrency={selectedMonthCurrency}
          onSegmentClick={(m, cur) => {
            const same = selectedMonth === m && selectedMonthCurrency === cur;
            setSelectedMonth(same ? null : m);
            setSelectedMonthCurrency(same ? null : cur);
            if (!same && m) handleSetViewMode("list");
          }}
        />
      </div>

      {/* ── Active drill-down indicators ── */}
      {(donutFilter || filterProjectType || selectedMonth) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted }}>Filtered by:</span>
          {donutFilter?.kind === "lead_status" && (() => {
            const pillKey = String(donutFilter.key || "").startsWith("ACTIVE • ") ? "ACTIVE" : donutFilter.key;
            const p = getPill(pillKey);
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: p.bg, color: p.text, border: `1px solid ${p.text}40` }}>
                Status: {stripActivePrefix(donutFilter.key)}
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
              Assigned Salesperson: {donutFilter.key}
              <button onClick={() => setDonutFilter(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
            </span>
          )}
          {donutFilter?.kind === "label" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${(LABEL_GROUP_COLORS[donutFilter.key] || T.accent)}18`, color: LABEL_GROUP_COLORS[donutFilter.key] || T.accent, border: `1px solid ${(LABEL_GROUP_COLORS[donutFilter.key] || T.accent)}40` }}>
              Label: {donutFilter.key}
              <button onClick={() => setDonutFilter(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
            </span>
          )}
          {donutFilter?.kind === "customer" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}40` }}>
              Customer: {donutFilter.key}
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
                Closing: {label}{selectedMonthCurrency ? ` (${selectedMonthCurrency})` : ""}
                <button onClick={() => { setSelectedMonth(null); setSelectedMonthCurrency(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
              </span>
            );
          })()}
        </div>
      )}

      {/* ── Grouped content ── */}
      <div ref={listGridRef} style={{ "--list-grid-cols": listGridTemplate(colWidths) }}>
      {groups.map(({ key, leads: groupLeads, idx }) => {
        const groupRev = groupLeads.reduce((s, l) => s + (l.expected_revenue || 0), 0);
        const isExpanded = !!expandedGroups[key];
        return (
          <div key={key} style={{ marginBottom: 14 }}>
            <div
              onClick={() => setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px",
                background: "#f8fafc",
                border: `1px solid ${T.border}`,
                borderLeft: "4px solid #02818A",
                borderRadius: isExpanded ? "10px 10px 0 0" : 10,
                marginBottom: 0,
                cursor: "pointer",
              }}>
              <span style={{ fontSize: 11, color: "#02818A", width: 14, textAlign: "center", flexShrink: 0 }}>
                {isExpanded ? "▾" : "▸"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#02818A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{key}</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{groupLeads.length} leads</span>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{fmt(groupRev)}</span>
            </div>

            {viewMode === "list" && isExpanded && (
              <div style={{ border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflowX: "auto", overflowY: "visible" }}>
                <div className="pipeline-list-header">
                  {LIST_HEADER_LABELS.map((label, colIdx) => (
                    <div
                      key={label}
                      className="pipeline-list-header-cell"
                      onClick={SORT_KEYS[label] ? () => toggleSort(SORT_KEYS[label]) : undefined}
                      style={SORT_KEYS[label] ? { cursor: "pointer", userSelect: "none" } : undefined}
                    >
                      <span>{label}{SORT_KEYS[label] && (sort?.key === SORT_KEYS[label] ? (sort.dir === "asc" ? " ▲" : " ▼") : " ⇅")}</span>
                      {label === "Category Scaled Value" && (
                        <span
                          title={"Cat A: same as Expected Value\nCat B: half (50%) of Expected Value\nLeads with no category: shown as —"}
                          style={{ flexShrink: 0, marginLeft: 4, width: 13, height: 13, borderRadius: "50%", border: "1px solid #9ca3af", color: "#9ca3af", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help", letterSpacing: 0, textTransform: "none" }}
                        >
                          ?
                        </span>
                      )}
                      <div
                        className="col-resize-handle"
                        onMouseDown={(e) => startColumnResize(e, colIdx)}
                        title="Drag to resize this column"
                      />
                    </div>
                  ))}
                  <span
                    className="col-resize-hint"
                    title="Columns are resizable — drag the thin divider between any two column headers. Your widths are saved automatically."
                  >
                    ?
                  </span>
                </div>
                {groupLeads.map(lead => (
                  <ListRow
                    key={lead.id}
                    lead={lead}
                    activity={primaryActivityByLead[lead.id]}
                    userMap={userMap}
                    bidderMap={bidderMap}
                    onActivityClick={setSelectedActivity}
                    healthHasCompleted={hasCompletedActivity(engagementsByLead[lead.id] || [])}
                    healthHasAnyActivity={hasAnyActivity(engagementsByLead[lead.id] || [])}
                  />
                ))}
              </div>
            )}

            {viewMode === "kanban" && isExpanded && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginTop: 10 }}>
                {groupLeads.map(lead => (
                  <div key={lead.id} style={{ display: "flex", flexDirection: "column" }}>
                    <LeadCard lead={lead} uniform />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {groups.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.textMuted, fontSize: 13 }}>No leads match the current filters.</div>
      )}

      {selectedActivity && (
        <ActivityDetailModal
          engagement={selectedActivity}
          lead={leadMap[selectedActivity.x_crm_lead_id?.[0]]}
          userMap={userMap}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}
