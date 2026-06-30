import { useState, useMemo, useEffect, useRef } from "react";
import { T } from "../constants/theme";
import { REGION_COLORS, PERSON_COLORS } from "../constants/colors";
import { fmt, fmtDate, getPersonName } from "../lib/format";
import { LeadCard } from "./PipelineTab";

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
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${DAYS[d.getDay()]}`;
};

// ---- Urgency logic ----
const URGENCY = {
  overdue: { border: "#EF4444", dateColor: "#EF4444" },
  urgent:  { border: "#FF9933", dateColor: "#FF9933" },
  soon:    { border: "#F59E0B", dateColor: "#F59E0B" },
  none:    { border: "transparent", dateColor: T.textPrimary },
};

const getUrgency = (isoDate, status) => {
  if (!isoDate || status === "Completed" || status === "Cancelled") return "none";
  // Parse date parts directly to avoid UTC vs local-timezone offset issues
  const [y, m, day] = isoDate.split("T")[0].split("-").map(Number);
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(y, m - 1, day);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0)  return "overdue";
  if (diff <= 2) return "urgent";
  if (diff <= 7) return "soon";
  return "none";
};

// ---- MultiSelect dropdown ----
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

  const btnLabel = selected.length === 0
    ? label
    : selected.length === 1
    ? selected[0]
    : `${label} (${selected.length})`;

  const isActive = selected.length > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
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
        <span style={{ fontSize: 10, flexShrink: 0 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300,
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 180, maxHeight: 240,
          overflowY: "auto",
        }}>
          {options.map(opt => (
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
          {options.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted }}>No options</div>
          )}
        </div>
      )}
    </div>
  );
}



// ---- Main VisitsTab ----
export function VisitsTab({ leads, engagements, userMap }) {
  const [activeFilter, setActiveFilter] = useState("Planned");
  const [sortOrder, setSortOrder]       = useState("date-asc");
  const [selectedKey, setSelectedKey]   = useState(null);

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

  // Expand engagements into rows — one row per engagement using effective date
  const allRows = useMemo(() => {
    const rows = [];
    engagements.forEach(eng => {
      const isRescheduled = eng.x_studio_engagement_status === "Rescheduled";
      const effectiveDate = isRescheduled && eng.x_studio_rescheduled_date
        ? eng.x_studio_rescheduled_date
        : eng.x_studio_proposed_date;
      if (effectiveDate) {
        const dateType = isRescheduled && eng.x_studio_rescheduled_date ? "Rescheduled" : "Proposed";
        rows.push({ key: `${eng.id}-main`, eng, dateISO: effectiveDate, dateType });
      }
    });
    return rows;
  }, [engagements]);

  // Helper: resolve person names for an engagement
  const getPersonNames = (eng) => {
    const raw = Array.isArray(eng.x_studio_visit_by) ? eng.x_studio_visit_by : [];
    return raw.map(p => getPersonName(p, userMap)).filter(Boolean);
  };

  const isUnassigned = (eng) => {
    const raw = Array.isArray(eng.x_studio_visit_by) ? eng.x_studio_visit_by : [];
    return raw.length === 0;
  };

  // Derive dropdown option lists from all rows
  const dropdownOptions = useMemo(() => {
    const companies = new Set();
    const persons   = new Set();
    const engTypes  = new Set();
    const regions   = new Set();
    allRows.forEach(({ eng }) => {
      const lead = leadMap[eng.x_crm_lead_id?.[0]];
      const co = lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1];
      if (co) companies.add(co);
      getPersonNames(eng).forEach(n => persons.add(n));
      if (eng.x_studio_engagement_type) engTypes.add(eng.x_studio_engagement_type);
      if (lead?.x_studio_responsible_region_1) regions.add(lead.x_studio_responsible_region_1);
    });
    return {
      companies: [...companies].sort(),
      persons:   [...persons].sort(),
      engTypes:  [...engTypes].sort(),
      regions:   [...regions].sort(),
    };
  }, [allRows, leadMap]); // eslint-disable-line

  // Tab filter
  const matchesTab = (row, tab) => {
    const { eng } = row;
    if (tab === "All")         return true;
    if (tab === "Planned")     return eng.x_studio_engagement_status === "Planned";
    if (tab === "Rescheduled") return eng.x_studio_engagement_status === "Rescheduled";
    if (tab === "Unassigned")  return isUnassigned(eng);
    return true;
  };

  // Dropdown filters — OR within each dimension, AND across dimensions
  const matchesDropdowns = (row) => {
    const { eng } = row;
    const lead = leadMap[eng.x_crm_lead_id?.[0]];
    if (filterCompany.length > 0) {
      const co = lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1] || "";
      if (!filterCompany.includes(co)) return false;
    }
    if (filterPerson.length > 0) {
      const names = getPersonNames(eng);
      if (!names.some(n => filterPerson.includes(n))) return false;
    }
    if (filterEngType.length > 0 && !filterEngType.includes(eng.x_studio_engagement_type)) return false;
    if (filterRegion.length > 0 && !filterRegion.includes(lead?.x_studio_responsible_region_1)) return false;
    return true;
  };

  // Count badges per tab (respects dropdown filters)
  const tabCounts = useMemo(() => {
    const tabs = ["All", "Planned", "Unassigned", "Rescheduled"];
    const counts = {};
    tabs.forEach(tab => {
      counts[tab] = allRows.filter(r => matchesTab(r, tab) && matchesDropdowns(r)).length;
    });
    return counts;
  }, [allRows, filterCompany, filterPerson, filterEngType, filterRegion]); // eslint-disable-line

  // Filtered + sorted rows
  const visibleRows = useMemo(() => {
    let rows = allRows.filter(r => matchesTab(r, activeFilter) && matchesDropdowns(r));
    rows.sort((a, b) => {
      if (sortOrder === "date-asc")   return (a.dateISO || "").localeCompare(b.dateISO || "");
      if (sortOrder === "date-desc")  return (b.dateISO || "").localeCompare(a.dateISO || "");
      if (sortOrder === "value-desc") {
        const la = leadMap[a.eng.x_crm_lead_id?.[0]];
        const lb = leadMap[b.eng.x_crm_lead_id?.[0]];
        return (lb?.expected_revenue || 0) - (la?.expected_revenue || 0);
      }
      return 0;
    });
    return rows;
  }, [allRows, activeFilter, filterCompany, filterPerson, filterEngType, filterRegion, sortOrder, leadMap]); // eslint-disable-line

  // Quick-stats bar
  const typeStats = useMemo(() => {
    const counts = {};
    visibleRows.forEach(r => {
      const t = r.eng.x_studio_engagement_type || "Other";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [visibleRows]);

  // Selected engagement — derives from selectedKey
  const selectedEngagement = useMemo(() => {
    if (!selectedKey) return null;
    const [id] = selectedKey.split("-");
    return engagements.find(e => String(e.id) === id) || null;
  }, [selectedKey, engagements]);

  // Tab change handler — clears selected record
  const handleTabChange = (tabId) => {
    setActiveFilter(tabId);
    setSelectedKey(null);
  };

  const anyDropdownActive = filterCompany.length > 0 || filterPerson.length > 0 || filterEngType.length > 0 || filterRegion.length > 0;

  const FILTER_TABS = [
    { id: "All",         label: "All" },
    { id: "Planned",     label: "Planned" },
    { id: "Unassigned",  label: "Unassigned" },
    { id: "Rescheduled", label: "Rescheduled" },
  ];

  const COL_HEADERS = ["Date", "Date Type", "Engage. Type", "Company", "Order Value", "Assigned To", "Region", "Status"];
  const GRID = "110px 90px 140px 1.4fr 90px 160px 100px 110px";

  return (
    <div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* -- Single row: Filter tabs (left) + MultiSelect dropdowns + sort (right) -- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        {/* Tab pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTER_TABS.map(tab => {
            const active = activeFilter === tab.id;
            return (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                border: `1px solid ${active ? T.accent : T.border}`,
                background: active ? T.accentBg : T.bgCard,
                color: active ? T.accent : T.textSecondary,
                cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
              }}>
                {tab.label}
                <span style={{
                  fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center",
                  background: active ? T.accent : T.bgInput, color: active ? "#fff" : T.textMuted,
                  borderRadius: 100, padding: "1px 5px",
                }}>{tabCounts[tab.id] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Right side: MultiSelect dropdowns + clear + sort */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <MultiSelect label="Company"     options={dropdownOptions.companies} selected={filterCompany}  onChange={setFilterCompany} />
          <MultiSelect label="Person"      options={dropdownOptions.persons}   selected={filterPerson}   onChange={setFilterPerson} />
          <MultiSelect label="Type"        options={dropdownOptions.engTypes}  selected={filterEngType}  onChange={setFilterEngType} />
          <MultiSelect label="Region"      options={dropdownOptions.regions}   selected={filterRegion}   onChange={setFilterRegion} />
          {anyDropdownActive && (
            <button
              onClick={() => { setFilterCompany([]); setFilterPerson([]); setFilterEngType([]); setFilterRegion([]); }}
              style={{
                padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`,
                background: "none", color: T.textMuted, fontSize: 12, fontFamily: "inherit",
                cursor: "pointer",
              }}
            >✕</button>
          )}
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{
            padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.bgCard, color: T.textPrimary, fontSize: 12, fontFamily: "inherit",
            cursor: "pointer", outline: "none",
          }}>
            <option value="date-asc">Date ↑</option>
            <option value="date-desc">Date ↓</option>
            <option value="value-desc">Value ↓</option>
          </select>
        </div>
      </div>

      {/* -- Urgency legend -- */}
      <div style={{ fontSize: 11, marginBottom: 10, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: "#EF4444", label: "Overdue" },
          { color: "#FF9933", label: "Due in \u22642 days" },
          { color: "#F59E0B", label: "Due this week" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ color: T.textSecondary }}>{label}</span>
          </span>
        ))}
      </div>

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
                {activeFilter === "Unassigned" ? "✓ All visits have been assigned."
                  : activeFilter === "Planned"  ? "No planned visits found."
                  : "No results match your filters."}
              </div>
            )}

            {/* Rows */}
            {visibleRows.map((row) => {
              const { key, eng, dateISO, dateType } = row;
              const lead      = leadMap[eng.x_crm_lead_id?.[0]];
              const status    = eng.x_studio_engagement_status || "Unknown";
              const cfg       = STATUS_CONFIG[status] || { bg: "#E2E6ED", text: "#4A5568" };
              const urgency   = URGENCY[getUrgency(dateISO, status)];
              const isAnomaly = eng.x_studio_visit_date && status === "Planned";
              const personNames = getPersonNames(eng);
              const unassigned  = personNames.length === 0;
              const isSelected  = selectedKey === key;
              const region      = lead?.x_studio_responsible_region_1 || null;
              const regionColor = REGION_COLORS[region] || T.textMuted;

              return (
                <VisitRow
                  key={key}
                  eng={eng}
                  lead={lead}
                  dateISO={dateISO}
                  dateType={dateType}
                  status={status}
                  cfg={cfg}
                  urgency={urgency}
                  isAnomaly={isAnomaly}
                  personNames={personNames}
                  unassigned={unassigned}
                  region={region}
                  regionColor={regionColor}
                  isSelected={isSelected}
                  GRID={GRID}
                  onRowClick={() => setSelectedKey(isSelected ? null : key)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* --- Detail Panel --- */}
      {selectedEngagement && leadMap[selectedEngagement.x_crm_lead_id?.[0]] && (
        <div style={{ marginBottom: 12, marginTop: 12 }}>
          <LeadCard 
            lead={leadMap[selectedEngagement.x_crm_lead_id?.[0]]} 
            onClose={() => setSelectedKey(null)} 
          />
        </div>
      )}
    </div>
  );
}

// --- Single visit row (own component for hover state) ---
function VisitRow({ eng, lead, dateISO, dateType, status, cfg, urgency, isAnomaly, personNames, unassigned, region, regionColor, isSelected, GRID, onRowClick }) {
  const [hovered, setHovered] = useState(false);

  const isFollowUp = dateType === "Follow-Up";
  const isRescheduledType = dateType === "Rescheduled";
  const dateTypePill = isRescheduledType
    ? { bg: "rgba(249,115,22,0.10)", color: "#F97316", label: "Rescheduled" }
    : { bg: "rgba(100,116,139,0.10)", color: "#64748B", label: "Proposed" };

  return (
    <div
      onClick={onRowClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: GRID, gap: 8,
        padding: "9px 16px", alignItems: "center",
        borderBottom: `1px solid ${T.border}`,
        borderLeft: `4px solid ${urgency.border}`,
        background: isSelected ? T.accentBg : hovered ? T.bgCardAlt : "transparent",
        cursor: "pointer", transition: "background 0.15s",
        outline: isSelected ? `1px solid ${T.accentBdr}` : "none",
        outlineOffset: -1,
      }}
    >
      {/* Date */}
      <div style={{ fontSize: 12, fontWeight: 600, color: urgency.dateColor, whiteSpace: "nowrap" }}>
        {dateISO ? fmtShort(dateISO) : "—"}
      </div>

      {/* Date Type pill */}
      <div>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: dateTypePill.bg, color: dateTypePill.color }}>
          {dateTypePill.label}
        </span>
      </div>

      {/* Engagement Type */}
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
          {getEmoji(eng.x_studio_engagement_type)} {eng.x_studio_engagement_type || "—"}
        </span>
      </div>

      {/* Company */}
      <div style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1] || "—"}
      </div>

      {/* Order Value */}
      <div style={{ fontSize: 12, fontWeight: 700, color: lead?.expected_revenue > 0 ? T.success : T.textMuted }}>
        {lead?.expected_revenue > 0 ? fmt(lead.expected_revenue) : "—"}
      </div>

      {/* Assigned To */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        {unassigned ? (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 100, background: "#F59E0B", color: "#fff" }}>• Unassigned</span>
        ) : (
          personNames.map((n, i) => (
            <span key={n} style={{ fontSize: 11, color: T.textSecondary }}>{n}{i < personNames.length - 1 ? "," : ""}</span>
          ))
        )}
      </div>

      {/* Region */}
      <div>
        {region ? (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: `${regionColor}18`, color: regionColor }}>
            {region}
          </span>
        ) : <span style={{ fontSize: 11, color: T.textMuted }}>—</span>}
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
    </div>
  );
}
