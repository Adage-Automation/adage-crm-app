import { T } from "../constants/theme";
import { REGION_COLORS } from "../constants/colors";
import { fmt, fmtDate, getPersonNames } from "../lib/format";

export function CalendarDayPopup({ popupDay, setPopupDay, popupDetail, setPopupDetail, leads, userMap }) {
  if (!popupDay) return null;

  const statusColors = { Planned: T.accent, Completed: T.success, Cancelled: T.danger, Rescheduled: "#F59E0B" };
  const statusBgs   = { Planned: T.accentBg, Completed: T.successBg, Cancelled: T.dangerBg, Rescheduled: T.warningBg };

  return (
    <div
      onClick={() => { setPopupDay(null); setPopupDetail(null); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        className="card fade-in"
        onClick={ev => ev.stopPropagation()}
        style={{ width: "100%", maxWidth: 660, maxHeight: "80vh", overflowY: "auto", padding: 24, borderRadius: 14, background: T.bgCard }}
      >
        {popupDetail ? (
          <DetailView
            e={popupDetail}
            leads={leads}
            userMap={userMap}
            statusColors={statusColors}
            statusBgs={statusBgs}
            onBack={() => setPopupDetail(null)}
          />
        ) : (
          <DayListView
            popupDay={popupDay}
            leads={leads}
            userMap={userMap}
            statusColors={statusColors}
            statusBgs={statusBgs}
            onClose={() => setPopupDay(null)}
            onSelectDetail={setPopupDetail}
          />
        )}
      </div>
    </div>
  );
}

function DetailView({ e, leads, userMap, statusColors, statusBgs, onBack }) {
  const lead = leads.find(l => l.id === e.x_crm_lead_id?.[0]);
  const pbColor = e.x_studio_project_background === "Greenfield" ? T.accent
    : e.x_studio_project_background === "Brownfield" ? "#F59E0B" : T.textMuted;
  const pbBg = e.x_studio_project_background === "Greenfield" ? T.accentBg
    : e.x_studio_project_background === "Brownfield" ? T.warningBg : T.bgInput;

  const Field = ({ label, value, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, color: color || T.textPrimary, fontWeight: 500 }}>{value || "â€”"}</div>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: T.textSecondary, fontFamily: "inherit", transition: "all 0.2s" }}>â† Back</button>
        <div style={{ fontWeight: 800, fontSize: 16, color: T.textPrimary }}>Visit Detail</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Customer" value={lead?.partner_id?.[1] || e.x_crm_lead_id?.[1]} />
        <Field label="Engagement Type" value={e.x_studio_engagement_type} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase" }}>Status</div>
          {e.x_studio_engagement_status
            ? <span className="pill" style={{ background: statusBgs[e.x_studio_engagement_status] || T.bgInput, color: statusColors[e.x_studio_engagement_status] || T.textMuted, alignSelf: "flex-start" }}>{e.x_studio_engagement_status}</span>
            : <span style={{ fontSize: 13, color: T.textMuted }}>â€”</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Assigned Person(s)" value={getPersonNames(e.x_studio_visit_by, userMap)} />
        <Field label="Region" value={lead?.x_studio_responsible_region_1} color={REGION_COLORS[lead?.x_studio_responsible_region_1] || T.textPrimary} />
        <Field label="Order Value" value={lead?.expected_revenue > 0 ? fmt(lead.expected_revenue) : null} color={T.success} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Proposed Date" value={fmtDate(e.x_studio_proposed_date)} />
        <Field label="Actual Visit Date" value={fmtDate(e.x_studio_visit_date)} />
        <Field label="Next Follow-up" value={fmtDate(e.x_studio_next_follow_up_date)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Field label="Opportunity" value={lead?.name || e.x_crm_lead_id?.[1]} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase" }}>Project Background</div>
          {e.x_studio_project_background
            ? <span className="pill" style={{ background: pbBg, color: pbColor, alignSelf: "flex-start" }}>{e.x_studio_project_background}</span>
            : <span style={{ fontSize: 13, color: T.textMuted }}>â€”</span>}
        </div>
        <Field label="Industry" value={lead?.x_studio_industry_type} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: e.x_studio_remarkscommments ? 16 : 0 }}>
        <Field label="SBU" value={lead?.x_studio_sbu} />
      </div>

      {e.x_studio_remarkscommments && (
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 6 }}>Remarks / Comments</div>
          <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{e.x_studio_remarkscommments}</div>
        </div>
      )}
    </>
  );
}

function DayListView({ popupDay, leads, userMap, statusColors, statusBgs, onClose, onSelectDetail }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: T.textPrimary }}>{popupDay.dateLabel}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.textMuted, lineHeight: 1, padding: "2px 6px", borderRadius: 6, transition: "all 0.2s" }}>âœ•</button>
      </div>

      {popupDay.visits.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: T.textMuted, fontSize: 14 }}>No visits on this date.</div>
      ) : popupDay.visits.map((e, idx) => {
        const lead = leads.find(l => l.id === e.x_crm_lead_id?.[0]);
        return (
          <div key={e.id} onClick={() => onSelectDetail(e)}
            style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: idx < popupDay.visits.length - 1 ? 10 : 0, cursor: "pointer", transition: "all 0.2s", background: T.bgCard }}
            onMouseEnter={ev => { ev.currentTarget.style.borderColor = T.accent; ev.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.12)"; }}
            onMouseLeave={ev => { ev.currentTarget.style.borderColor = T.border; ev.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {e.x_studio_engagement_type && (
                  <span className="pill" style={{ background: "rgba(124,58,237,0.10)", color: "#7C3AED", fontSize: 10 }}>{e.x_studio_engagement_type}</span>
                )}
                {e.x_studio_engagement_status && (
                  <span className="pill" style={{ background: statusBgs[e.x_studio_engagement_status] || T.bgInput, color: statusColors[e.x_studio_engagement_status] || T.textMuted, fontSize: 10 }}>{e.x_studio_engagement_status}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted }}>click for details â†’</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{lead?.partner_id?.[1] || e.x_crm_lead_id?.[1] || "â€”"}</div>
              <div style={{ fontSize: 12, color: T.textSecondary }}>{getPersonNames(e.x_studio_visit_by, userMap)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: lead?.expected_revenue > 0 ? T.success : T.textMuted }}>
                {lead?.expected_revenue > 0 ? fmt(lead.expected_revenue) : "â€”"}
              </div>
              <div style={{ fontSize: 12, color: REGION_COLORS[lead?.x_studio_responsible_region_1] || T.textMuted, fontWeight: 600 }}>
                {lead?.x_studio_responsible_region_1 || "â€”"}
              </div>
            </div>

            {e.x_studio_remarkscommments && (
              <div style={{ marginTop: 8, fontSize: 11, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.x_studio_remarkscommments}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

