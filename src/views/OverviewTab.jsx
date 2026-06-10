import { T } from "../constants/theme";
import { REGION_COLORS, STAGE_COLORS, PERSON_COLORS, GB_COLORS, PB_COLORS } from "../constants/colors";
import { fmt, fmtDate } from "../lib/format";

export function OverviewTab({
  leads, engagements, totalRev, hotLeads, plannedVisits,
  wonLeads, lostLeads, winRate, overdueLeads, overdueRev,
  byRegion, byStage, gbEntries, pbEntries, gbTotal, pbTotal,
  hotSorted, selectedLead, setSelectedLead,
}) {
  const regionKeys = Object.keys(byRegion).sort((a, b) => byRegion[b].rev - byRegion[a].rev);
  const maxRegionRev = Math.max(...regionKeys.map(r => byRegion[r].rev), 1);

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Pipeline",  value: fmt(totalRev), sub: `${leads.length} opportunities`, color: T.accent,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
          { label: "Hot Leads",       value: hotLeads.length, sub: "High importance", color: "#EA580C",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c0 6-8 8-8 14a8 8 0 0 0 16 0c0-6-8-8-8-14z"/></svg> },
          { label: "Planned Visits",  value: plannedVisits.length, sub: "Upcoming engagements", color: T.success,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
          { label: "Won This Year",   value: wonLeads.length, sub: fmt(wonLeads.reduce((s,l)=>s+(l.expected_revenue||0),0)), color: "#0891B2",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: "Win Rate",        value: winRate !== null ? `${winRate}%` : "—", sub: `${wonLeads.length}W · ${lostLeads.length}L`, color: "#7C3AED",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
          { label: "Overdue Pipeline",value: overdueLeads.length, sub: overdueLeads.length > 0 ? fmt(overdueRev) : "All on track", color: overdueLeads.length > 0 ? T.danger : T.success,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: "18px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: kpi.color, opacity: 0.8, borderRadius: "14px 14px 0 0" }} />
            <div style={{ color: kpi.color, marginBottom: 10 }}>{kpi.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: T.textLabel, marginTop: 5, fontWeight: 500 }}>{kpi.label}</div>
            <div style={{ fontSize: 11, color: kpi.color, marginTop: 3, fontWeight: 600 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 2: Region + Stage + Donuts */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Region Bars */}
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Pipeline by Region</div>
          {regionKeys.map(r => (
            <div key={r} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: REGION_COLORS[r] || T.textSecondary, fontWeight: 600 }}>{r}</span>
                <span style={{ color: T.textMuted }}>{byRegion[r].count} leads · {fmt(byRegion[r].rev)}</span>
              </div>
              <div style={{ height: 6, background: T.bgInput, borderRadius: 4 }}>
                <div className="bar-fill" style={{ height: "100%", width: `${(byRegion[r].rev / maxRegionRev) * 100}%`, background: REGION_COLORS[r] || T.accent, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Stage Funnel */}
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Pipeline Stages</div>
          {Object.entries(byStage).sort((a,b) => b[1].count - a[1].count).map(([stage, d]) => (
            <div key={stage} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: STAGE_COLORS[stage] || T.textMuted }} />
                <span style={{ fontSize: 13, color: T.textSecondary }}>{stage}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{d.count}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>{fmt(d.rev)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Dual donut */}
        <div className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { title: "Distribution as per customer type", entries: gbEntries, total: gbTotal, colors: GB_COLORS, emptyMsg: "No customer type data yet." },
            { title: "Greenfield vs Brownfield",          entries: pbEntries, total: pbTotal, colors: PB_COLORS, emptyMsg: "No project background data yet." },
          ].map(({ title, entries, total, colors, emptyMsg }, chartIdx) => (
            <div key={title}>
              <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>{title}</div>
              {entries.length === 0 ? (
                <div style={{ color: T.textMuted, fontSize: 12 }}>{emptyMsg}</div>
              ) : (() => {
                const size = 110, cx = size/2, cy = size/2, r = 40, strokeW = 16;
                const circumference = 2 * Math.PI * r;
                let offset = 0;
                const segments = entries.map(([type, d], i) => {
                  const pct = d.rev / total;
                  const dash = pct * circumference;
                  const gap  = circumference - dash;
                  const seg  = { type, d, pct, dash, gap, offset, color: colors[type] || PERSON_COLORS[i % PERSON_COLORS.length] };
                  offset += dash;
                  return seg;
                });
                const top = segments[0];
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.bgInput} strokeWidth={strokeW} />
                        {segments.map((seg, i) => (
                          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeW}
                            strokeDasharray={`${seg.dash} ${seg.gap}`} strokeDashoffset={-seg.offset} strokeLinecap="butt"
                            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }} />
                        ))}
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: top.color }}>{Math.round(top.pct * 100)}%</div>
                        <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginTop: 1, textAlign: "center", maxWidth: 56 }}>{top.type}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      {segments.map((seg) => (
                        <div key={seg.type} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>{seg.type}</span>
                            </div>
                            <span style={{ fontSize: 11, color: T.textMuted }}>{seg.d.count} leads</span>
                          </div>
                          <div style={{ height: 5, background: T.bgInput, borderRadius: 3 }}>
                            <div className="bar-fill" style={{ height: "100%", width: `${seg.pct * 100}%`, background: seg.color, borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: seg.color, marginTop: 2 }}>
                            {fmt(seg.d.rev)} <span style={{ fontWeight: 400, color: T.textMuted }}>({Math.round(seg.pct * 100)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {chartIdx === 0 && <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8 }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Hot leads table */}
      <div className="card" style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>High Priority Opportunities</div>
          <span className="pill" style={{ background: "rgba(234,88,12,0.10)", color: "#EA580C" }}>{hotSorted.length} leads</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Opportunity","Company","Region","Stage","Revenue","Closing","Salesperson"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10, color: T.textMuted, letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hotSorted.map(l => (
              <tr key={l.id} className="lead-row" onClick={() => setSelectedLead(selectedLead?.id === l.id ? null : l)}
                style={{ borderBottom: `1px solid ${T.border}`, background: selectedLead?.id === l.id ? T.accentBg : "transparent", transition: "background 0.15s" }}>
                <td style={{ padding: "9px 10px", fontSize: 13, color: T.textPrimary, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{l.name}</td>
                <td style={{ padding: "9px 10px", fontSize: 12, color: T.textSecondary }}>{l.partner_id?.[1] || l.partner_name || "—"}</td>
                <td style={{ padding: "9px 10px" }}>
                  {l.x_studio_responsible_region_1 ? (
                    <span className="pill" style={{ background: `${REGION_COLORS[l.x_studio_responsible_region_1] || T.textMuted}18`, color: REGION_COLORS[l.x_studio_responsible_region_1] || T.textSecondary }}>{l.x_studio_responsible_region_1}</span>
                  ) : "—"}
                </td>
                <td style={{ padding: "9px 10px", fontSize: 12, color: T.textSecondary }}>{l.stage_id?.[1] || "—"}</td>
                <td style={{ padding: "9px 10px", fontSize: 13, fontWeight: 700, color: T.success }}>{l.expected_revenue ? fmt(l.expected_revenue) : "—"}</td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: T.textMuted }}>{l.date_deadline ? new Date(l.date_deadline).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—"}</td>
                <td style={{ padding: "9px 10px", fontSize: 12, color: T.textSecondary }}>{l.user_id?.[1] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedLead && (
          <div style={{ marginTop: 12, background: T.bgCardAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              ["SBU", selectedLead.x_studio_sbu],
              ["Industry", selectedLead.x_studio_industry_type],
              ["Customer Type", selectedLead.x_studio_customer_type],
              ["Probability", selectedLead.probability ? `${selectedLead.probability}%` : "—"],
              ["Importance", selectedLead.x_studio_importance_of_lead],
              ["Approval", selectedLead.x_studio_crm_lead_approval],
            ].map(([k, v]) => (
              <div key={k} style={{ fontSize: 12 }}>
                <span style={{ color: T.textMuted }}>{k}: </span>
                <span style={{ color: T.textPrimary, fontWeight: 500 }}>{v || "—"}</span>
              </div>
            ))}
            {selectedLead.x_studio_project_details && (
              <div style={{ gridColumn: "span 3", fontSize: 12, color: T.textSecondary, marginTop: 4, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                <span style={{ color: T.textMuted }}>Project: </span>{selectedLead.x_studio_project_details}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
