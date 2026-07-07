import { useState, useEffect, useCallback, Component } from "react";
import { T } from "./constants/theme";
import { fetchOdoo } from "./lib/odoo";
import { getPersonName } from "./lib/format";
import { PipelineTab }       from "./views/PipelineTab";
import { VisitsTab }         from "./views/VisitsTab";
import { TeamTab }           from "./views/TeamTab";
import { CalendarDayPopup }  from "./views/CalendarDayPopup";
import SwimlaneView          from "./views/SwimlaneView";
import mainLogo from "./logos/Main Logo.png";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div style={{ background: T.dangerBg, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 20, color: "#B91C1C", fontSize: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>UI Error</div>
          <div style={{ color: "#B91C1C" }}>{msg}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab]           = useState("pipeline");
  const [data, setData]                     = useState({ leads: [], engagements: [], stages: [], closedLeads: [] });
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [popupDay, setPopupDay]             = useState(null);
  const [popupDetail, setPopupDetail]       = useState(null);
  const [selectedLead, setSelectedLead]     = useState(null);
  const [userMap, setUserMap]               = useState({});

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leads, engagements, stages, closedLeads] = await Promise.all([
        fetchOdoo("crm.lead", "search_read", [[["type","=","opportunity"],["active","=",true]]], {
          fields: ["name","partner_name","partner_id","stage_id","expected_revenue","probability","won_status",
            "x_studio_responsible_region_1","x_studio_expected_month","x_studio_expected_year",
            "x_studio_importance_of_lead","x_studio_customer_type","x_studio_industry_type",
            "x_studio_assigned_salesperson","date_deadline","user_id","x_studio_product_info",
            "x_studio_crm_lead_approval","x_studio_sbu","x_studio_project_details",
            "x_studio_sales_lead","activity_date_deadline","priority","x_studio_project_background",
            "x_studio_lead_status","x_studio_expected_closing","x_studio_prospect_health"],
          limit: 200,
        }),
        fetchOdoo("x_crm_lead_line_6bc5b", "search_read", [[]], {
          fields: ["x_name","x_crm_lead_id","x_studio_engagement_type","x_studio_proposed_date","x_studio_engagement_status","x_studio_visit_by",
            "x_studio_remarkscommments","x_studio_rescheduled_date","x_studio_engagement_with","x_studio_completed_date"],
          limit: 500,
        }),
        fetchOdoo("crm.stage", "search_read", [[]], { fields: ["name","sequence"], order: "sequence asc" }),
        fetchOdoo("crm.lead", "search_read", [[["type","=","opportunity"],["active","=",true]]], {
          fields: ["stage_id","expected_revenue","active"], limit: 500,
          context: { lang: "en_US" },
        }),
      ]);

      const activeLeadIds = new Set((leads || []).map((lead) => lead.id).filter(Boolean));
      const visibleEngagements = (engagements || []).filter((engagement) => activeLeadIds.has(engagement?.x_crm_lead_id?.[0]));

      const ids = new Set();
      visibleEngagements.forEach(e => {
        const raw = Array.isArray(e.x_studio_visit_by) ? e.x_studio_visit_by : [e.x_studio_visit_by];
        raw.forEach(p => {
          if (!p && p !== 0) return;
          if (typeof p === "object" && !Array.isArray(p) && p.id) ids.add(p.id);
          else if (Array.isArray(p) && p.length > 0) ids.add(p[0]);
          else { const n = +p; if (!isNaN(n) && n > 0) ids.add(n); }
        });
      });

      let map = {};
      if (ids.size > 0) {
        try {
          const employees = await fetchOdoo("hr.employee", "search_read", [[["id","in", Array.from(ids)]]], { fields: ["id","name"], limit: 500 });
          (employees || []).forEach(emp => { map[emp.id] = emp.name; });
        } catch (umErr) { console.warn("employeeMap load error:", umErr); }
      }

      setUserMap(map);
      setData({ leads: leads || [], engagements: visibleEngagements, stages: stages || [], closedLeads: closedLeads || [] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Escape key closes popups ────────────────────────────────────────────────
  useEffect(() => {
    const h = (ev) => { if (ev.key === "Escape") { setPopupDetail(null); setPopupDay(null); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────
  const leads      = data.leads;
  const engagements = data.engagements;

  const wonLeads  = (data.closedLeads || []).filter(l => l.stage_id?.[1] === "Won");
  const lostLeads = (data.closedLeads || []).filter(l => l.stage_id?.[1] === "Lost");
  const totalRev  = leads.reduce((s, l) => s + (l.expected_revenue || 0), 0);
  const hotLeads  = leads.filter(l => l.x_studio_importance_of_lead === "Hot");
  const plannedVisits = engagements.filter(e => e.x_studio_engagement_status === "Planned");
  const winRate   = (wonLeads.length + lostLeads.length) > 0
    ? Math.round((wonLeads.length / (wonLeads.length + lostLeads.length)) * 100) : null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueLeads = leads.filter(l => {
    if (!l.x_studio_expected_closing) return false;
    const d = new Date(l.x_studio_expected_closing); d.setHours(0,0,0,0);
    return d < today && l.won_status !== "won" && l.won_status !== "lost";
  });
  const overdueRev = overdueLeads.reduce((s, l) => s + (l.expected_revenue || 0), 0);

  const byRegion = {}; leads.forEach(l => { const r = l.x_studio_responsible_region_1 || "Unknown"; if (!byRegion[r]) byRegion[r] = { count:0, rev:0 }; byRegion[r].count++; byRegion[r].rev += l.expected_revenue||0; });
  const byStage  = {}; leads.forEach(l => { const s = l.stage_id?.[1] || "Unknown"; if (!byStage[s]) byStage[s] = { count:0, rev:0 }; byStage[s].count++; byStage[s].rev += l.expected_revenue||0; });

  const byCustomerType = {}; leads.forEach(l => { const ct = l.x_studio_customer_type || "Unknown"; if (!byCustomerType[ct]) byCustomerType[ct] = { count:0, rev:0 }; byCustomerType[ct].count++; byCustomerType[ct].rev += l.expected_revenue||0; });
  const gbTotal   = Object.values(byCustomerType).reduce((s,v) => s + v.rev, 0) || 1;
  const gbEntries = Object.entries(byCustomerType).sort((a,b) => b[1].rev - a[1].rev);

  const byProjectBg = {}; leads.forEach(l => { const pb = l.x_studio_project_background || "Unknown"; if (!byProjectBg[pb]) byProjectBg[pb] = { count:0, rev:0 }; byProjectBg[pb].count++; byProjectBg[pb].rev += l.expected_revenue||0; });
  const pbTotal   = Object.values(byProjectBg).reduce((s,v) => s + v.rev, 0) || 1;
  const pbEntries = Object.entries(byProjectBg).sort((a,b) => b[1].rev - a[1].rev);

  const personRegion = {};
  engagements.forEach(e => {
    const persons = e.x_studio_visit_by || [];
    const lead    = leads.find(l => l.id === e.x_crm_lead_id?.[0]);
    const region  = lead?.x_studio_responsible_region_1 || "Unknown";
    const raw     = Array.isArray(persons) ? persons : [persons];
    raw.map(p => getPersonName(p, userMap)).filter(Boolean).forEach(name => {
      if (!personRegion[name]) personRegion[name] = {};
      personRegion[name][region] = (personRegion[name][region] || 0) + 1;
    });
  });
  const allRegions = [...new Set(Object.values(personRegion).flatMap(r => Object.keys(r)))];
  const personKeys = Object.keys(personRegion).sort((a,b) =>
    Object.values(personRegion[b]).reduce((s,v)=>s+v,0) - Object.values(personRegion[a]).reduce((s,v)=>s+v,0)
  );

  const hotSorted = [...leads]
    .filter(l => l.x_studio_importance_of_lead === "Hot" || l.priority === "2" || l.priority === "3")
    .sort((a,b) => (b.expected_revenue||0) - (a.expected_revenue||0)).slice(0, 8);

  const upcomingVisits = [...engagements]
    .filter(e => e.x_studio_engagement_status === "Planned" && e.x_studio_proposed_date)
    .sort((a,b) => new Date(a.x_studio_proposed_date) - new Date(b.x_studio_proposed_date)).slice(0, 12);

  const tabs = [
    { id: "pipeline", label: "Pipeline" },
    { id: "visits",   label: "Visits" },
    { id: "team",     label: "Team View" },
    { id: "swimlane", label: "Calendar" },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', 'Segoe UI', sans-serif", background: "#F7F7FA", minHeight: "100vh", color: T.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.scrollThumb}; border-radius: 3px; }
        .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .tab-btn:hover { background: ${T.accentBg} !important; color: ${T.accent} !important; }
        .card { background: ${T.bgCard}; border: 1px solid ${T.border}; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04); }
        .card:hover { border-color: ${T.borderMd}; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .pill { border-radius: 100px; font-size: 11px; font-weight: 600; padding: 3px 10px; display: inline-block; }
        .bar-fill { transition: width 0.8s cubic-bezier(.4,0,.2,1); }
        .visit-row:hover { background: ${T.accentBg} !important; }
        .lead-row:hover { background: ${T.bgCardAlt} !important; cursor: pointer; }
        .pipeline-card:hover { border-color: ${T.accent} !important; box-shadow: 0 4px 12px rgba(2,129,138,0.15) !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .pulse { animation: pulse 2s infinite; }
        @media (prefers-reduced-motion: reduce) { .fade-in, .bar-fill, .pulse { animation: none; transition: none; } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 28px", background: T.bgHeader, display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab("pipeline");
              setPopupDetail(null);
              setPopupDay(null);
              setSelectedLead(null);
            }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <img src={mainLogo} alt="ADAGE" style={{ height: 22, width: "auto", display: "block" }} />
            <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "1.6px", textTransform: "uppercase", marginTop: 4, fontWeight: 700 }}>
              CRM INTELLIGENCE
            </div>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {tabs.map(t => (
            <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: activeTab === t.id ? T.accent : T.textSecondary,
              background: activeTab === t.id ? T.accentBg : "transparent",
              border: activeTab === t.id ? `1px solid ${T.accentBdr}` : "1px solid transparent",
            }}>{t.label}</button>
          ))}
          <button onClick={loadData} style={{ marginLeft: 8, background: T.accentBg, border: `1px solid ${T.accentBdr}`, color: T.accent, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s" }}>⟳ Refresh</button>
        </div>
      </div>

      <div style={{ padding: "24px 28px", minHeight: "calc(100vh - 60px)" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16 }}>
            <div className="pulse" style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #02818A, #04A8B4)" }} />
            <div style={{ color: T.textMuted, fontSize: 14 }}>Connecting to Odoo CRM…</div>
          </div>
        )}
        {error && (
          <div style={{ background: T.dangerBg, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 20, color: "#B91C1C", fontSize: 14 }}>
            <strong>Connection error:</strong> {error}
            <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted }}>Check that your Odoo API key and URL are correct.</div>
          </div>
        )}

        {!loading && !error && (
          <ErrorBoundary key={activeTab}>
            <div className="fade-in">
            {activeTab === "pipeline" && (
              <PipelineTab leads={leads} stages={data.stages} engagements={engagements} userMap={userMap} />
            )}
            {activeTab === "visits" && (
              <VisitsTab
                leads={leads} engagements={engagements}
                plannedVisits={plannedVisits} upcomingVisits={upcomingVisits} userMap={userMap}
              />
            )}
            {activeTab === "team" && (
              <TeamTab leads={leads} personRegion={personRegion} personKeys={personKeys} allRegions={allRegions} engagements={engagements} userMap={userMap} />
            )}
            {activeTab === "swimlane" && (
              <div className="card" style={{ padding: "24px 28px", minHeight: "calc(100vh - 130px)", display: "flex", flexDirection: "column" }}>
                <SwimlaneView />
              </div>
            )}
            </div>
          </ErrorBoundary>
        )}
      </div>

      <CalendarDayPopup
      popupDay={popupDay} setPopupDay={setPopupDay}
      popupDetail={popupDetail} setPopupDetail={setPopupDetail}
      leads={leads} engagements={engagements} userMap={userMap}
    />
    </div>
  );
}
