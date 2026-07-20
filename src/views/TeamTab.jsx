import { useState, useMemo } from "react";
import { T } from "../constants/theme";
import { REGION_COLORS, PERSON_COLORS } from "../constants/colors";
import { fmt, fmtDate, getPersonName, getPersonNames } from "../lib/format";
import { ODOO_BASE_URL } from "../lib/odoo";
import HealthTag, { hasAnyActivity, hasCompletedActivity } from "../components/HealthTag";

// ---- Local constants (mirrored from VisitsTab) ----
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

const URGENCY = {
  overdue: { border: "#EF4444", dateColor: "#EF4444" },
  urgent:  { border: "#FF9933", dateColor: "#FF9933" },
  soon:    { border: "#F59E0B", dateColor: "#F59E0B" },
  none:    { border: "transparent", dateColor: T.textPrimary },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fmtShort = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}, ${DAYS[dt.getDay()]}`;
};

const getUrgency = (isoDate, status) => {
  if (!isoDate || status === "Completed" || status === "Cancelled") return "none";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = isoDate.split("T")[0].split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date - today) / 86400000);
  if (diff < 0)  return "overdue";
  if (diff <= 2) return "urgent";
  if (diff <= 7) return "soon";
  return "none";
};

// ---- "This week" helpers ----
const getWeekRange = () => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  return { mon, sun };
};

const inWeek = (iso, mon, sun) => {
  if (!iso) return false;
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date >= mon && date <= sun;
};

const getDisplayDateMeta = (engagement) => {
  const status = engagement?.x_studio_engagement_status;

  if (status === "Completed" && engagement?.x_studio_completed_date) {
    return {
      date: engagement.x_studio_completed_date,
      label: "Completed",
      detailLabel: "Completed Date",
      pillBg: T.successBg,
      pillColor: T.success,
    };
  }

  if (status === "Cancelled") {
    return {
      date: null,
      label: null,
      detailLabel: null,
      pillBg: T.bgInput,
      pillColor: T.textMuted,
    };
  }

  if (status === "Rescheduled" && engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      label: "Rescheduled",
      detailLabel: "Rescheduled Date",
      pillBg: "rgba(249,115,22,0.10)",
      pillColor: "#F97316",
    };
  }

  if (engagement?.x_studio_planned_date) {
    return {
      date: engagement.x_studio_planned_date,
      label: "Planned Date",
      detailLabel: "Planned Date",
      pillBg: "rgba(100,116,139,0.10)",
      pillColor: "#64748B",
    };
  }

  if (engagement?.x_studio_rescheduled_date) {
    return {
      date: engagement.x_studio_rescheduled_date,
      label: "Rescheduled",
      detailLabel: "Rescheduled Date",
      pillBg: "rgba(249,115,22,0.10)",
      pillColor: "#F97316",
    };
  }

  return {
    date: null,
    label: "Planned Date",
    detailLabel: "Planned Date",
    pillBg: "rgba(100,116,139,0.10)",
    pillColor: "#64748B",
  };
};

function EngagementDetailCard({ engagement, lead, userMap }) {
  if (!engagement) return null;

  const status = engagement.x_studio_engagement_status || "Unknown";
  const statusCfg = STATUS_CONFIG[status] || { bg: "#E2E6ED", text: "#4A5568" };
  const odooLeadId = lead?.id || engagement?.x_crm_lead_id?.[0];
  const company = lead?.partner_id?.[1] || engagement.x_crm_lead_id?.[1] || "—";
  const assignedTo = getPersonNames(engagement.x_studio_action_by, userMap);
  const orderValue = lead?.expected_revenue > 0 ? fmt(lead.expected_revenue) : "—";
  const remarks = engagement.x_studio_remarkscomments || "—";
  const { date: detailDate, detailLabel } = getDisplayDateMeta(engagement);

  const Field = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: color || T.textPrimary, fontWeight: 500, lineHeight: 1.45, wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        background: T.bgCard,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        animation: "fadeIn 0.25s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Activity Detail</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: statusCfg.bg, color: statusCfg.text }}>
          {status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "18px 28px" }}>
        <Field label="Customer" value={company} />
        <Field label="Deal Value" value={orderValue} color={orderValue !== "—" ? T.success : T.textMuted} />
        <Field label="Engagement Type" value={engagement.x_studio_engagement_type || "—"} />
        <Field label="Engagement With" value={engagement.x_studio_engagement_with || "—"} />
        <Field label="Assigned To" value={assignedTo} />
        {detailLabel && <Field label={detailLabel} value={fmtDate(detailDate)} />}
      </div>

      <div>
        <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 6 }}>
          Remarks / Comments
        </div>
        <div style={{ fontSize: 14, color: remarks === "—" ? T.textMuted : T.textPrimary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {remarks}
        </div>
      </div>

      {odooLeadId && (
        <div>
          <a
            href={`${ODOO_BASE_URL}/odoo/crm/${odooLeadId}`}
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
  );
}



// --- Drill-down pivot card ---
function PivotCard({ leads, personRegion, personKeys, allRegions, engagements, userMap, drill, setDrill }) {

  const leadMap = useMemo(() => {
    const m = {}; leads.forEach(l => { m[l.id] = l; }); return m;
  }, [leads]);

  // Resolve engagements for a given person
  const engsByPerson = useMemo(() => {
    const map = {};
    engagements.forEach(eng => {
      const persons = Array.isArray(eng.x_studio_action_by) ? eng.x_studio_action_by : [];
      const names = persons.map(p => getPersonName(p, userMap)).filter(Boolean);
      if (names.length === 0) {
        if (!map["Unassigned"]) map["Unassigned"] = [];
        map["Unassigned"].push(eng);
      } else {
        names.forEach(n => {
          if (!map[n]) map[n] = [];
          map[n].push(eng);
        });
      }
    });
    return map;
  }, [engagements, userMap]);

  const selectedPerson = drill.personName;
  const selectedEng = drill.engagementId
    ? engagements.find(e => e.id === drill.engagementId) : null;

  // --- Level 2: single engagement ---
  if (drill.level === 2 && selectedEng) {
    const lead = leadMap[selectedEng.x_crm_lead_id?.[0]];
    const company = lead?.partner_id?.[1] || selectedEng.x_crm_lead_id?.[1] || "—";
    return (
      <div className="card" style={{ padding: "20px 22px" }}>
        <Breadcrumb segments={[
          { label: "All People", onClick: () => setDrill({ level: 0, personName: null, engagementId: null }) },
          { label: selectedPerson, onClick: () => setDrill({ level: 1, personName: selectedPerson, engagementId: null }) },
          { label: company },
        ]} />
        <div style={{ marginTop: 12 }}>
          <EngagementDetailCard engagement={selectedEng} lead={lead} userMap={userMap} />
        </div>
      </div>
    );
  }

  // --- Levels 0 + 1: single unified render — headline & headers NEVER unmount ---
  const isDrilldown = drill.level === 1 && !!selectedPerson;

  // Pre-compute drilldown data (safe to compute even when not in drilldown)
  const drillPersonIdx  = selectedPerson ? personKeys.indexOf(selectedPerson) : -1;
  const drillColor      = PERSON_COLORS[drillPersonIdx >= 0 ? drillPersonIdx % PERSON_COLORS.length : 0];
  const drillTotal      = selectedPerson ? Object.values(personRegion[selectedPerson] || {}).reduce((s, v) => s + v, 0) : 0;
  const drillEngs       = selectedPerson ? (engsByPerson[selectedPerson] || []) : [];
  const drillByRegion   = {};
  drillEngs.forEach(eng => {
    const lead   = leadMap[eng.x_crm_lead_id?.[0]];
    const region = lead?.x_studio_responsible_region_1 || "Unassigned Region";
    if (!drillByRegion[region]) drillByRegion[region] = [];
    drillByRegion[region].push(eng);
  });

  return (
    <div className="card" style={{ padding: "20px 22px" }}>

      {/* ── 1. Section headline — ALWAYS VISIBLE ── */}
      <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600, marginBottom: isDrilldown ? 10 : 16 }}>
        Planned visits — per person × per region
      </div>

      {/* ── 4. Breadcrumb — only when drilled in, sits BELOW headline ── */}
      {isDrilldown && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 }}>
          <button
            onClick={() => setDrill({ level: 0, personName: null, engagementId: null })}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.accent, fontFamily: "inherit", padding: 0, fontWeight: 500 }}
          >All People</button>
          <span style={{ color: T.textMuted }}>›</span>
          <span style={{ color: T.textPrimary, fontWeight: 600 }}>{selectedPerson}</span>
        </div>
      )}

      {personKeys.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>

            {/* ── 2. Column headers — ALWAYS VISIBLE ── */}
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", fontWeight: 600 }}>SALES ENGINEER</th>
                {allRegions.map(r => (
                  <th key={r} style={{ textAlign: "center", padding: "8px 10px", fontSize: 11, color: REGION_COLORS[r] || T.textMuted, letterSpacing: "0.8px", fontWeight: 600 }}>{r}</th>
                ))}
                <th style={{ textAlign: "center", padding: "8px 12px", fontSize: 11, color: T.accent, letterSpacing: "0.8px", fontWeight: 600 }}>TOTAL</th>
              </tr>
            </thead>

            {/* ── 3. Rows — all people (level 0) OR single highlighted row (level 1) ── */}
            <tbody>
              {isDrilldown ? (
                /* Single highlighted row for the selected person */
                <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.accentBg }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: T.textPrimary }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${drillColor}18`, border: `1.5px solid ${drillColor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: drillColor, fontWeight: 800, flexShrink: 0 }}>
                        {selectedPerson.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{selectedPerson}</span>
                    </div>
                  </td>
                  {allRegions.map(r => (
                    <td key={r} style={{ textAlign: "center", padding: "10px" }}>
                      {(personRegion[selectedPerson] || {})[r]
                        ? <span style={{ background: `${REGION_COLORS[r] || T.accent}15`, color: REGION_COLORS[r] || T.accent, borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: 13 }}>{(personRegion[selectedPerson] || {})[r]}</span>
                        : <span style={{ color: T.border }}>—</span>}
                    </td>
                  ))}
                  <td style={{ textAlign: "center", padding: "10px", fontSize: 14, fontWeight: 800, color: T.accent }}>{drillTotal}</td>
                </tr>
              ) : (
                /* All people rows */
                personKeys.map((name, i) => {
                  const total = Object.values(personRegion[name]).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={name}
                      style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.15s", cursor: "pointer" }}
                      onClick={() => setDrill({ level: 1, personName: name, engagementId: null })}
                      onMouseEnter={e => e.currentTarget.style.background = T.accentBg}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: T.textPrimary }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${PERSON_COLORS[i % PERSON_COLORS.length]}18`, border: `1.5px solid ${PERSON_COLORS[i % PERSON_COLORS.length]}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: PERSON_COLORS[i % PERSON_COLORS.length], fontWeight: 800, flexShrink: 0 }}>
                            {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span style={{ fontWeight: 500 }}>{name}</span>
                          <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>→</span>
                        </div>
                      </td>
                      {allRegions.map(r => (
                        <td key={r} style={{ textAlign: "center", padding: "10px" }}>
                          {personRegion[name][r]
                            ? <span style={{ background: `${REGION_COLORS[r] || T.accent}15`, color: REGION_COLORS[r] || T.accent, borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: 13 }}>{personRegion[name][r]}</span>
                            : <span style={{ color: T.border }}>—</span>}
                        </td>
                      ))}
                      <td style={{ textAlign: "center", padding: "10px", fontSize: 14, fontWeight: 800, color: T.accent }}>{total}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: "32px 0" }}>
          No visit assignments in Engagement Tracker yet. Assign sales engineers to visits to see data here.
        </div>
      )}

      {/* ── 5. Engagement detail list — only in drilldown ── */}
      {isDrilldown && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16, maxHeight: 400, overflowY: "auto" }}>
          {Object.entries(drillByRegion).map(([region, engs]) => (
            <div key={region}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 4, height: 16, borderRadius: 2, background: REGION_COLORS[region] || T.textMuted, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: REGION_COLORS[region] || T.textSecondary, letterSpacing: "0.4px" }}>{region}</span>
                <span style={{ fontSize: 10, color: T.textMuted }}>{engs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 12 }}>
                {engs.map(eng => {
                  const lead   = leadMap[eng.x_crm_lead_id?.[0]];
                  const status = eng.x_studio_engagement_status || "Unknown";
                  const cfg    = STATUS_CONFIG[status] || { bg: "#E2E6ED", text: "#4A5568" };
                  const { date: effDate } = getDisplayDateMeta(eng);
                  const urg    = URGENCY[getUrgency(effDate, status)];
                  return (
                    <div key={eng.id}
                      onClick={() => setDrill({ level: 2, personName: selectedPerson, engagementId: eng.id })}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, borderLeft: `4px solid ${urg.border}`, background: T.bgCard, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = T.bgCardAlt}
                      onMouseLeave={e => e.currentTarget.style.background = T.bgCard}>
                      <span style={{ fontSize: 13 }}>{getEmoji(eng.x_studio_engagement_type)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            marginBottom: 2,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.3px",
                            color: cfg.bg,
                            textTransform: "uppercase",
                          }}
                        >
                          {status}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1] || "—"}
                        </div>
                        {eng.x_studio_engagement_with && (
                          <div style={{ fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            With: {eng.x_studio_engagement_with}
                          </div>
                        )}
                        {effDate && <div style={{ fontSize: 11, color: urg.dateColor }}>{fmtShort(effDate)}</div>}
                      </div>
                      <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>→</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {drillEngs.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: T.textMuted, fontSize: 13 }}>No engagements found for this person.</div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Breadcrumb ---
function Breadcrumb({ segments }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 13 }}>
      {segments.map((seg, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: T.textMuted }}>›</span>}
          {seg.onClick
            ? <button onClick={seg.onClick} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.accent, fontFamily: "inherit", padding: 0, fontWeight: 500 }}>{seg.label}</button>
            : <span style={{ color: T.textPrimary, fontWeight: 600 }}>{seg.label}</span>}
        </span>
      ))}
    </div>
  );
}

// --- This Week's Planned Activities card ---
function WeeklyActivityCard({ engagements, leads, userMap, personKeys, completedByLead, anyByLead }) {
  const [selectedKey, setSelectedKey] = useState(null);

  const leadMap = useMemo(() => {
    const m = {}; leads.forEach(l => { m[l.id] = l; }); return m;
  }, [leads]);

  const { mon, sun } = useMemo(() => getWeekRange(), []);

  // Filter: proposed OR follow-up falls in this week, status not Completed/Cancelled
  const weekEngs = useMemo(() => {
    return engagements.filter(eng => {
      const status = eng.x_studio_engagement_status;
      if (status === "Completed" || status === "Cancelled") return false;
      const dateToUse = eng.x_studio_rescheduled_date || eng.x_studio_planned_date;
      return inWeek(dateToUse, mon, sun);
    });
  }, [engagements, mon, sun]);

  // Urgency priority order
  const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, none: 3 };
  const effectiveDate = (eng) => {
    return eng.x_studio_rescheduled_date || eng.x_studio_planned_date;
  };

  // Group by person (many2many expansion)
  const groups = useMemo(() => {
    const map = {};
    weekEngs.forEach(eng => {
      const persons = Array.isArray(eng.x_studio_action_by) ? eng.x_studio_action_by : [];
      const names = persons.map(p => getPersonName(p, userMap)).filter(Boolean);
      const keys = names.length > 0 ? names : ["Unassigned"];
      keys.forEach(name => {
        if (!map[name]) map[name] = [];
        map[name].push(eng);
      });
    });

    // Sort each group by urgency then date
    Object.values(map).forEach(engs => {
      engs.sort((a, b) => {
        const ua = urgencyOrder[getUrgency(effectiveDate(a), a.x_studio_engagement_status)] ?? 3;
        const ub = urgencyOrder[getUrgency(effectiveDate(b), b.x_studio_engagement_status)] ?? 3;
        if (ua !== ub) return ua - ub;
        return (effectiveDate(a) || "").localeCompare(effectiveDate(b) || "");
      });
    });

    // Sort groups: persons that appear in personKeys first (their existing sort order), then rest
    const orderedKeys = [
      ...personKeys.filter(n => map[n]),
      ...Object.keys(map).filter(n => !personKeys.includes(n)),
    ];
    return orderedKeys.map(name => ({ name, engs: map[name] }));
  }, [weekEngs, userMap, personKeys]);

  const selectedEng = selectedKey
    ? weekEngs.find(e => String(e.id) === selectedKey.split("-")[0]) : null;

  // Week label
  const monLabel = `${mon.getDate()} ${MONTHS[mon.getMonth()]}`;
  const sunLabel = `${sun.getDate()} ${MONTHS[sun.getMonth()]}`;

  return (
    <div className="card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>
          This Week's Planned Activities
        </div>
        <span style={{ fontSize: 11, color: T.textMuted }}>{monLabel} — {sunLabel}</span>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted, fontSize: 13 }}>
          ✓ No activities scheduled for this week.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {groups.map(({ name, engs }, gi) => {
            const personIdx = personKeys.indexOf(name);
            const color = PERSON_COLORS[personIdx >= 0 ? personIdx % PERSON_COLORS.length : gi % PERSON_COLORS.length];
            return (
              <div key={name}>
                {gi > 0 && <div style={{ height: 1, background: T.border, margin: "12px 0" }} />}
                {/* Person header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${color}18`, border: `1.5px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color, fontWeight: 800, flexShrink: 0 }}>
                    {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, minWidth: 20, textAlign: "center", background: T.accentBg, color: T.accent, borderRadius: 100, padding: "1px 6px" }}>{engs.length}</span>
                </div>
                {/* Activity cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 40 }}>
                  {engs.map(eng => {
                    const rowKey = `${eng.id}-${name}`;
                    const lead = leadMap[eng.x_crm_lead_id?.[0]];
                    const status = eng.x_studio_engagement_status || "Unknown";
                    const cfg = STATUS_CONFIG[status] || { bg: "#E2E6ED", text: "#4A5568" };
                    const effDate = effectiveDate(eng);
                    const urg = URGENCY[getUrgency(effDate, status)];
                    const isSelected = selectedKey === rowKey;
                    return (
                      <div key={rowKey}>
                        <ActivityCard
                          eng={eng}
                          lead={lead}
                          hasCompleted={!!completedByLead[lead?.id]}
                          hasAnyActivity={!!anyByLead[lead?.id]}
                          cfg={cfg}
                          urg={urg}
                          isSelected={isSelected}
                          onClick={() => setSelectedKey(isSelected ? null : rowKey)}
                        />
                        {isSelected && (
                          <div style={{ marginTop: 8 }}>
                            <EngagementDetailCard engagement={eng} lead={lead} userMap={userMap} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityCard({ eng, lead, hasCompleted, hasAnyActivity: hasAnyActivityFlag, cfg, urg, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);
  const { date: showDate, label: showDateLabel, pillBg, pillColor } = getDisplayDateMeta(eng);
  const odooLeadId = lead?.id || eng?.x_crm_lead_id?.[0];
  const statusLabel = eng.x_studio_engagement_status || "—";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 8,
        border: `1px solid ${isSelected ? T.accent : T.border}`,
        borderLeft: `4px solid ${urg.border}`,
        background: isSelected ? T.accentBg : hovered ? T.bgCardAlt : T.bgCard,
        cursor: "pointer", transition: "background 0.15s",
      }}
    >
      {/* Type emoji */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{getEmoji(eng.x_studio_engagement_type)}</span>

      {/* Company + dates */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            marginBottom: 2,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.3px",
            color: cfg.bg,
            textTransform: "uppercase",
          }}
        >
          {statusLabel}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lead?.partner_id?.[1] || eng.x_crm_lead_id?.[1] || "—"}
        </div>
        {odooLeadId && (
          <a
            href={`${ODOO_BASE_URL}/odoo/crm/${odooLeadId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
              fontSize: 11,
              fontWeight: 700,
              color: "#02818A",
              textDecoration: "none",
              opacity: 1,
            }}
          >
            View in Odoo ↗
          </a>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, minWidth: 0 }}>
          <HealthTag
            health={lead?.x_studio_prospect_health}
            hasCompleted={hasCompleted}
            hasAnyActivity={hasAnyActivityFlag}
            expectedClosingISO={lead?.x_studio_expected_closing}
          />
        </div>
        {eng.x_studio_engagement_with && (
          <div style={{ marginTop: 2, fontSize: 10, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            With: {eng.x_studio_engagement_with}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
          {showDate && (
            <span style={{ fontSize: 10, color: urg.dateColor }}>
              {showDateLabel === "Rescheduled" && (
                <span style={{ background: pillBg, color: pillColor, borderRadius: 100, padding: "1px 6px", fontSize: 9, fontWeight: 600, marginRight: 3 }}>
                  {showDateLabel}
                </span>
              )}
              {fmtShort(showDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Overdue Activities card ---
function OverdueActivityCard({ engagements, leads, userMap, personKeys, completedByLead, anyByLead }) {
  const [selectedKey, setSelectedKey] = useState(null);

  const leadMap = useMemo(() => {
    const m = {}; leads.forEach(l => { m[l.id] = l; }); return m;
  }, [leads]);

  const overdueEngs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return engagements.filter(eng => {
      const status = eng.x_studio_engagement_status;
      if (status === "Completed" || status === "Cancelled" || status === "Done") return false;
      const dateStr = eng.x_studio_rescheduled_date || eng.x_studio_planned_date;
      if (!dateStr) return false;
      const [y, m, d] = dateStr.split("T")[0].split("-").map(Number);
      const engDate = new Date(y, m - 1, d);
      return engDate < today;
    });
  }, [engagements]);

  // Urgency priority order
  const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, none: 3 };
  const effectiveDate = (eng) => {
    return eng.x_studio_rescheduled_date || eng.x_studio_planned_date;
  };

  const groups = useMemo(() => {
    const map = {};
    overdueEngs.forEach(eng => {
      const persons = Array.isArray(eng.x_studio_action_by) ? eng.x_studio_action_by : [];
      const names = persons.map(p => getPersonName(p, userMap)).filter(Boolean);
      const keys = names.length > 0 ? names : ["Unassigned"];
      keys.forEach(name => {
        if (!map[name]) map[name] = [];
        map[name].push(eng);
      });
    });

    Object.values(map).forEach(engs => {
      engs.sort((a, b) => {
        const ua = urgencyOrder[getUrgency(effectiveDate(a), a.x_studio_engagement_status)] ?? 3;
        const ub = urgencyOrder[getUrgency(effectiveDate(b), b.x_studio_engagement_status)] ?? 3;
        if (ua !== ub) return ua - ub;
        return (effectiveDate(a) || "").localeCompare(effectiveDate(b) || "");
      });
    });

    const orderedKeys = [
      ...personKeys.filter(n => map[n]),
      ...Object.keys(map).filter(n => !personKeys.includes(n)),
    ];
    return orderedKeys.map(name => ({ name, engs: map[name] }));
  }, [overdueEngs, userMap, personKeys]);

  if (groups.length === 0) return null;

  return (
    <div className="card" style={{ padding: "20px 22px", background: "#FEF2F2", border: "1px solid #FECACA" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.danger || "#DC2626", letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 700 }}>
          Overdue Activities
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {groups.map(({ name, engs }, gi) => {
          const personIdx = personKeys.indexOf(name);
          const color = PERSON_COLORS[personIdx >= 0 ? personIdx % PERSON_COLORS.length : gi % PERSON_COLORS.length];
          return (
            <div key={name}>
              {gi > 0 && <div style={{ height: 1, background: T.border, margin: "12px 0" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${color}18`, border: `1.5px solid ${color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color, fontWeight: 800, flexShrink: 0 }}>
                  {name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, minWidth: 20, textAlign: "center", background: T.accentBg, color: T.accent, borderRadius: 100, padding: "1px 6px" }}>{engs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 40 }}>
                {engs.map(eng => {
                  const rowKey = `${eng.id}-${name}`;
                  const lead = leadMap[eng.x_crm_lead_id?.[0]];
                  const status = eng.x_studio_engagement_status || "Unknown";
                  const cfg = { bg: T.danger || "#DC2626", text: "#fff" }; // override for overdue
                  const effDate = effectiveDate(eng);
                  const urg = URGENCY[getUrgency(effDate, status)];
                  const isSelected = selectedKey === rowKey;
                  return (
                    <div key={rowKey}>
                      <ActivityCard
                        eng={eng}
                        lead={lead}
                        hasCompleted={!!completedByLead[lead?.id]}
                        hasAnyActivity={!!anyByLead[lead?.id]}
                        cfg={cfg}
                        urg={urg}
                        isSelected={isSelected}
                        onClick={() => setSelectedKey(isSelected ? null : rowKey)}
                      />
                      {isSelected && (
                        <div style={{ marginTop: 8 }}>
                          <EngagementDetailCard engagement={eng} lead={lead} userMap={userMap} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main TeamTab export ---
export function TeamTab({ leads, personRegion, personKeys, allRegions, engagements = [], userMap = {} }) {
  const [drill, setDrill] = useState({ level: 0, personName: null, engagementId: null });
  const isPersonSelected = drill.level > 0;
  const { completedByLead, anyByLead } = useMemo(() => {
    const completedMap = {};
    const anyMap = {};
    const engagementsByLead = {};

    engagements.forEach((engagement) => {
      const leadId = engagement?.x_crm_lead_id?.[0];
      if (!leadId) return;
      if (!engagementsByLead[leadId]) engagementsByLead[leadId] = [];
      engagementsByLead[leadId].push(engagement);
    });

    Object.entries(engagementsByLead).forEach(([leadId, leadEngagements]) => {
      completedMap[leadId] = hasCompletedActivity(leadEngagements);
      anyMap[leadId] = hasAnyActivity(leadEngagements);
    });

    return { completedByLead: completedMap, anyByLead: anyMap };
  }, [engagements]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <PivotCard
        leads={leads}
        personRegion={personRegion}
        personKeys={personKeys}
        allRegions={allRegions}
        engagements={engagements}
        userMap={userMap}
        drill={drill}
        setDrill={setDrill}
      />
      {!isPersonSelected && (
        <>
          <OverdueActivityCard
            engagements={engagements}
            leads={leads}
            userMap={userMap}
            personKeys={personKeys}
            completedByLead={completedByLead}
            anyByLead={anyByLead}
          />
          <WeeklyActivityCard
            engagements={engagements}
            leads={leads}
            userMap={userMap}
            personKeys={personKeys}
            completedByLead={completedByLead}
            anyByLead={anyByLead}
          />
        </>
      )}
    </div>
  );
}
