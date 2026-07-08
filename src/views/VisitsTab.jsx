import { useState, useMemo, useEffect, useRef } from "react";
import { T } from "../constants/theme";
import { REGION_COLORS } from "../constants/colors";
import { fmt, getPersonName } from "../lib/format";

// ---- Local constants ----
const STATUS_CONFIG = {
  Planned:     { bg: "#10B981", text: "#fff" },
  Completed:   { bg: "#3B82F6", text: "#fff" },
  Rescheduled: { bg: "#F59E0B", text: "#fff" },
  Cancelled:   { bg: "#94A3B8", text: "#fff" },
};

const TYPE_ICONS = {
  "Email":      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>,
  "Phone Call": <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.42 2 2 0 0 1 3.6 1.24h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.71 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.29 6.29l.82-.82a2 2 0 0 1 2.11-.45c.91.35 1.85.58 2.81.71A2 2 0 0 1 22 16.92z"/></svg>,
  "Meeting":    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  "Exhibition": <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
};
const getEmoji = (t) => TYPE_ICONS[t] || <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

// ---- Date formatting ----
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fmtShort = (iso) => {
  if (!iso) return "—";
  const [y, m, day] = iso.split("T")[0].split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${DAYS[d.getDay()]}`;
};

const parseISODate = (iso) => {
  if (!iso) return null;
  const [y, m, day] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, day);
};

const toStartOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const PREVIOUS_RANGE_OPTIONS = [
  { value: "last-week", label: "Last Week", days: 7 },
  { value: "last-30-days", label: "Last 30 Days", days: 30 },
  { value: "last-month", label: "Last Month", days: 30 },
  { value: "last-90-days", label: "Last 90 Days", days: 90 },
];

function getEngagementDisplayDateMeta(engagement) {
  const status = engagement?.x_studio_engagement_status;
  if (status === "Completed" && engagement?.x_studio_completed_date) {
    return {
      date: engagement.x_studio_completed_date,
      detailLabel: "Completed Date",
      color: T.success,
    };
  }
  if (status === "Cancelled") {
    return {
      date: null,
      detailLabel: null,
      color: T.textMuted,
    };
  }
  if (status === "Rescheduled" && engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      detailLabel: "Rescheduled Date",
      color: "#F97316",
    };
  }
  if (engagement?.x_studio_proposed_date) {
    return {
      date: engagement.x_studio_proposed_date,
      detailLabel: "Planned Date",
      color: T.textPrimary,
    };
  }
  if (engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      detailLabel: "Rescheduled Date",
      color: "#F97316",
    };
  }
  return {
    date: null,
    detailLabel: null,
    color: T.textMuted,
  };
}

// ---- MultiSelect dropdown ----
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

  const btnLabel = selected.length === 0
    ? label
    : selected.length === 1
    ? selected[0]
    : `${label} (${selected.length})`;

  const isActive = selected.length > 0;
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
        padding: "6px 12px", borderRadius: 8,
        border: `1px solid ${isActive ? T.accent : T.border}`,
        background: isActive ? T.accentBg : T.bgCard,
        color: isActive ? T.accent : T.textSecondary,
        fontSize: 12, fontFamily: "inherit", fontWeight: isActive ? 600 : 400,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        whiteSpace: "nowrap",
      }}>
        <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {btnLabel}
        </span>
        <span style={{ fontSize: 10, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300,
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 180, maxHeight: 240,
          overflowY: "auto",
        }}>
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
            <div key={opt} onClick={() => toggle(opt)} style={{
              padding: "8px 12px", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              background: selected.includes(opt) ? T.accentBg : "transparent",
              color: selected.includes(opt) ? T.accent : T.textPrimary,
            }}>
              <div style={{
                width: 14, height: 14, flexShrink: 0, borderRadius: 3,
                border: `1.5px solid ${selected.includes(opt) ? T.accent : T.borderMd}`,
                background: selected.includes(opt) ? T.accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selected.includes(opt) && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
              </div>
              {opt}
            </div>
          ))}
          {visibleOptions.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No options</div>
          )}
        </div>
      )}
    </div>
  );
}



// ---- Main VisitsTab ----
export function VisitsTab({ leads, engagements, userMap }) {
  const [showPreviousVisits, setShowPreviousVisits] = useState(false);
  const [previousRange, setPreviousRange] = useState("last-30-days");
  const [sortOrder, setSortOrder] = useState("date-asc");

  // Dropdown filter state (arrays for multi-select)
  const [filterCompany,  setFilterCompany]  = useState([]);
  const [filterPerson,   setFilterPerson]   = useState([]);
  const [filterEngType,  setFilterEngType]  = useState([]);
  const [filterRegion,   setFilterRegion]   = useState([]);

  // Build leadMap once
  const leadMap = useMemo(() => {
    const m = {};
    leads.forEach(l => { m[l.id] = l; });
    return m;
  }, [leads]);

  const getPersonNames = (eng) => {
    const raw = Array.isArray(eng.x_studio_visit_by) ? eng.x_studio_visit_by : [];
    return raw.map(p => getPersonName(p, userMap)).filter(Boolean);
  };

  // Expand engagements into normalized rows for current and previous visit views
  const allRows = useMemo(() => {
    const today = toStartOfDay(new Date());
    const rows = [];
    engagements.forEach((eng) => {
      const lead = leadMap[eng.x_crm_lead_id?.[0]];
      if (!lead) return;

      const displayDateMeta = getEngagementDisplayDateMeta(eng);
      const effectiveDate = displayDateMeta.date;
      const status = eng.x_studio_engagement_status || "Unknown";
      const personNames = getPersonNames(eng);
      const region = lead.x_studio_responsible_region_1 || null;
      const regionColor = REGION_COLORS[region] || T.textMuted;
      const comparisonDate = parseISODate(effectiveDate);
      const isUpcomingVisit = status === "Planned" || status === "Rescheduled";
      const displayDateISO = effectiveDate;

      rows.push({
        key: String(eng.id),
        eng,
        lead,
        status,
        dateISO: displayDateISO,
        comparisonDateISO: effectiveDate,
        personNames,
        region,
        regionColor,
        isUpcomingVisit,
      });
    });
    return rows;
  }, [engagements, leadMap, userMap]);

  // Derive dropdown option lists from all rows
  const dropdownOptions = useMemo(() => {
    const companies = new Set();
    const persons   = new Set();
    const engTypes  = new Set();
    const regions   = new Set();
    allRows.forEach(({ eng, lead, personNames, region }) => {
      const co = lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1];
      if (co) companies.add(co);
      personNames.forEach(n => persons.add(n));
      if (eng.x_studio_engagement_type) engTypes.add(eng.x_studio_engagement_type);
      if (region) regions.add(region);
    });
    return {
      companies: [...companies].sort(),
      persons:   [...persons].sort(),
      engTypes:  [...engTypes].sort(),
      regions:   [...regions].sort(),
    };
  }, [allRows]);

  // Dropdown filters — OR within each dimension, AND across dimensions
  const matchesDropdowns = (row) => {
    const { eng, lead, personNames, region } = row;
    if (filterCompany.length > 0) {
      const co = lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1] || "";
      if (!filterCompany.includes(co)) return false;
    }
    if (filterPerson.length > 0) {
      if (!personNames.some(n => filterPerson.includes(n))) return false;
    }
    if (filterEngType.length > 0 && !filterEngType.includes(eng.x_studio_engagement_type)) return false;
    if (filterRegion.length > 0 && !filterRegion.includes(region)) return false;
    return true;
  };

  // Filtered + sorted rows
  const visibleRows = useMemo(() => {
    const today = toStartOfDay(new Date());
    const rangeDays = PREVIOUS_RANGE_OPTIONS.find((option) => option.value === previousRange)?.days ?? 30;
    const pastStart = new Date(today);
    pastStart.setDate(today.getDate() - rangeDays);

    let rows = allRows.filter((row) => {
      if (!matchesDropdowns(row)) return false;
      const rowDate = parseISODate(row.comparisonDateISO);
      if (showPreviousVisits) {
        if (!rowDate || rowDate >= today) return false;
        return rowDate >= pastStart;
      }
      return row.isUpcomingVisit;
    });

    rows.sort((a, b) => {
      if (sortOrder === "date-asc")   return (a.comparisonDateISO || a.dateISO || "").localeCompare(b.comparisonDateISO || b.dateISO || "");
      if (sortOrder === "date-desc")  return (b.comparisonDateISO || b.dateISO || "").localeCompare(a.comparisonDateISO || a.dateISO || "");
      if (sortOrder === "value-desc") {
        return (b.lead?.expected_revenue || 0) - (a.lead?.expected_revenue || 0);
      }
      return 0;
    });
    return rows;
  }, [allRows, filterCompany, filterPerson, filterEngType, filterRegion, sortOrder, showPreviousVisits, previousRange]); // eslint-disable-line

  // Quick-stats bar
  const typeStats = useMemo(() => {
    const counts = {};
    visibleRows.forEach(r => {
      const t = r.eng.x_studio_engagement_type || "Other";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [visibleRows]);

  const anyDropdownActive = filterCompany.length > 0 || filterPerson.length > 0 || filterEngType.length > 0 || filterRegion.length > 0;
  const COL_HEADERS = ["Company", "Date", "Order Value", "Region", "Engage. Type", "Assigned To", "Status", "Remarks"];
  const GRID = "1.1fr 132px 100px 112px 146px 160px 120px 1fr";

  return (
    <div>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .visit-odoo-link {
          font-size: 11px;
          color: #02818A;
          text-decoration: none;
          opacity: 0;
          transition: opacity 0.15s;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }
        .visit-row:hover .visit-odoo-link {
          opacity: 1;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => {
            setShowPreviousVisits((prev) => !prev);
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: `1px solid ${showPreviousVisits ? T.accent : T.border}`,
            background: showPreviousVisits ? T.accentBg : T.bgCard,
            color: showPreviousVisits ? T.accent : T.textSecondary,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          View Previous Visits
        </button>
        <MultiSelect label="Company" options={dropdownOptions.companies} selected={filterCompany} onChange={setFilterCompany} searchable searchPlaceholder="Search company..." />
        <MultiSelect label="Person" options={dropdownOptions.persons} selected={filterPerson} onChange={setFilterPerson} searchable searchPlaceholder="Search person..." />
        <MultiSelect label="Type" options={dropdownOptions.engTypes} selected={filterEngType} onChange={setFilterEngType} searchable searchPlaceholder="Search type..." />
        <MultiSelect label="Region" options={dropdownOptions.regions} selected={filterRegion} onChange={setFilterRegion} searchable searchPlaceholder="Search region..." />
        {anyDropdownActive && (
          <button
            onClick={() => { setFilterCompany([]); setFilterPerson([]); setFilterEngType([]); setFilterRegion([]); }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: "none",
              color: T.textMuted,
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        )}
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.bgCard,
          color: T.textPrimary,
          fontSize: 12,
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
        }}>
          <option value="date-asc">Date Ascn</option>
          <option value="date-desc">Date Desc</option>
          <option value="value-desc">Value ↓</option>
        </select>
      </div>

      {showPreviousVisits && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          {PREVIOUS_RANGE_OPTIONS.map((option) => {
            const active = previousRange === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPreviousRange(option.value);
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: `1px solid ${active ? T.accent : T.border}`,
                  background: active ? T.accentBg : T.bgCard,
                  color: active ? T.accent : T.textSecondary,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {/* -- Quick-stats type bar -- */}
      {Object.keys(typeStats).length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, padding: "8px 14px", background: T.bgCardAlt, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12 }}>
          {Object.entries(typeStats).sort((a,b) => b[1] - a[1]).map(([type, count]) => (
            <span key={type} style={{ color: T.textSecondary }}>
              <span>{getEmoji(type)}</span>
              <span style={{ marginLeft: 4 }}>{type}: </span>
              <span style={{ fontWeight: 700, color: T.textPrimary }}>{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* -- Table -- */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "60vh" }}>
          <div style={{ minWidth: 900 }}>
            {/* Sticky header */}
            <div style={{
              display: "grid", gridTemplateColumns: GRID,
              padding: "8px 16px", gap: 8,
              background: T.bgCardAlt, borderBottom: `1px solid ${T.border}`,
              position: "sticky", top: 0, zIndex: 2,
            }}>
              {COL_HEADERS.map(h => (
                <div key={h} style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>

            {/* Empty state */}
            {visibleRows.length === 0 && (
              <div style={{ padding: "40px 16px", textAlign: "center", color: T.textMuted, fontSize: 13 }}>
                {showPreviousVisits ? "No visits found in the selected historical range." : "No planned or rescheduled visits found."}
              </div>
            )}

            {/* Rows */}
            {visibleRows.map((row) => {
              const { key, eng, lead, status, dateISO, personNames, region, regionColor } = row;
              const cfg       = STATUS_CONFIG[status] || { bg: "#E2E6ED", text: "#4A5568" };
              const isAnomaly = eng.x_studio_completed_date && status === "Planned";

              return (
                <VisitRow
                  key={key}
                  eng={eng}
                  lead={lead}
                  dateISO={dateISO}
                  status={status}
                  cfg={cfg}
                  isAnomaly={isAnomaly}
                  personNames={personNames}
                  region={region}
                  regionColor={regionColor}
                  GRID={GRID}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Single visit row (own component for hover state) ---
function VisitRow({ eng, lead, dateISO, status, cfg, isAnomaly, personNames, region, regionColor, GRID }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="visit-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: GRID, gap: 8,
        padding: "10px 16px", alignItems: "center",
        borderBottom: `1px solid ${T.border}`,
        background: hovered ? T.bgCardAlt : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Company */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1] || "—"}
        </div>
        <a
          className="visit-odoo-link"
          href={`https://crm-adage-11.odoo.com/odoo/crm/${lead.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          View in Odoo ↗
        </a>
      </div>

      {/* Date */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, whiteSpace: "nowrap" }}>
          {dateISO ? fmtShort(dateISO) : "—"}
        </div>
      </div>

      {/* Order Value */}
      <div style={{ fontSize: 12, fontWeight: 700, color: lead?.expected_revenue > 0 ? T.success : T.textMuted }}>
        {lead?.expected_revenue > 0 ? fmt(lead.expected_revenue) : "—"}
      </div>

      {/* Region */}
      <div>
        {region ? (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: `${regionColor}18`, color: regionColor }}>
            {region}
          </span>
        ) : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
      </div>

      {/* Engagement Type */}
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
          {getEmoji(eng.x_studio_engagement_type)} {eng.x_studio_engagement_type || "—"}
        </span>
        {eng.x_studio_engagement_with && (
          <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            With: {eng.x_studio_engagement_with}
          </div>
        )}
      </div>

      {/* Assigned To */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        {personNames.length > 0 ? personNames.map((n, i) => (
          <span key={n} style={{ fontSize: 11, color: T.textSecondary }}>{n}{i < personNames.length - 1 ? "," : ""}</span>
        )) : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: cfg.bg, color: cfg.text, textDecoration: status === "Cancelled" ? "line-through" : "none" }}>
          {status}
        </span>
        {isAnomaly && (
          <span title="Visit recorded but status not updated" style={{ fontSize: 11, cursor: "help" }}>⚠</span>
        )}
      </div>

      {/* Remarks */}
      <div
        title={eng.x_studio_remarkscommments || ""}
        style={{
          fontSize: 11,
          color: eng.x_studio_remarkscommments ? T.textSecondary : T.textMuted,
          lineHeight: 1.4,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          wordBreak: "break-word",
        }}
      >
        {eng.x_studio_remarkscommments || "—"}
      </div>
    </div>
  );
}
