import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import PipelineView from "./PipelineView";

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__label">{label}</div>
      <div className="kpi-card__value" style={{ color: color || "#60a5fa" }}>
        {value ?? "—"}
      </div>
      {sub && <div className="kpi-card__sub">{sub}</div>}
    </div>
  );
}

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const YEARS = [];
for (let y = 2026; y >= 2000; y--) YEARS.push(y);

export default function Dashboard() {
  const [year, setYear] = useState("");

  const { data: h1bStats, loading: h1bLoading } = useVisaData("/h1b/stats", { year });
  const { data: l1Stats,  loading: l1Loading  } = useVisaData("/l1/stats",  { year });
  const { data: optStats, loading: optLoading  } = useVisaData("/optcpt/stats", { year });
  const { data: ebStats,  loading: ebLoading   } = useVisaData("/eb/stats",  { year });
  const { data: permStats } = useVisaData("/perm/stats", { year });
  const { data: o1Stats  } = useVisaData("/o1/stats",  { year });
  const { data: h1bTrends } = useVisaData("/h1b/trends");
  const { data: syncStatus } = useVisaData("/sync/status");

  const loading = h1bLoading || l1Loading || optLoading || ebLoading;

  // Approval rate comparison data for selected year
  const approvalCompare = React.useMemo(() => {
    const data = [];
    if (h1bStats?.approvalRate) data.push({ name: "H-1B",   rate: parseFloat(h1bStats.approvalRate.toFixed(1)) });
    if (l1Stats?.approvalRate)  data.push({ name: "L-1",    rate: parseFloat(l1Stats.approvalRate.toFixed(1)) });
    if (permStats?.certificationRate) data.push({ name: "PERM", rate: parseFloat(permStats.certificationRate.toFixed(1)) });
    if (ebStats?.approvalRate)  data.push({ name: "EB",     rate: parseFloat(ebStats.approvalRate.toFixed(1)) });
    if (o1Stats?.approvalRate)  data.push({ name: "O-1",    rate: parseFloat(o1Stats.approvalRate.toFixed(1)) });
    return data;
  }, [h1bStats, l1Stats, permStats, ebStats, o1Stats]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">Overview</h2>
        <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <div className="loading">Loading data…</div>}

      <section className="kpi-section">
        <div className="section-label">H-1B</div>
        <div className="kpi-grid">
          <KpiCard label="Initial Approvals"  value={fmt(h1bStats?.totalInitialApprovals)}  color="#60a5fa" />
          <KpiCard label="Initial Denials"    value={fmt(h1bStats?.totalInitialDenials)}    color="#f87171" />
          <KpiCard label="Approval Rate"      value={h1bStats?.approvalRate ? `${h1bStats.approvalRate.toFixed(1)}%` : "—"} color="#34d399" />
          <KpiCard label="RFE Issued"         value={fmt(h1bStats?.totalRfeIssued)}         color="#fbbf24" />
          <KpiCard label="Unique Employers"   value={fmt(h1bStats?.uniqueEmployers)}        color="#a78bfa" />
        </div>
      </section>

      <section className="kpi-section">
        <div className="section-label">L-1A / L-1B</div>
        <div className="kpi-grid">
          <KpiCard label="Approvals"        value={fmt(l1Stats?.totalApprovals)}  color="#60a5fa" />
          <KpiCard label="Denials"          value={fmt(l1Stats?.totalDenials)}    color="#f87171" />
          <KpiCard label="Approval Rate"    value={l1Stats?.approvalRate ? `${l1Stats.approvalRate.toFixed(1)}%` : "—"} color="#34d399" />
          <KpiCard label="Unique Employers" value={fmt(l1Stats?.uniqueEmployers)} color="#a78bfa" />
        </div>
      </section>

      <section className="kpi-section">
        <div className="section-label">OPT / CPT</div>
        <div className="kpi-grid">
          <KpiCard label="Active Students" value={fmt(optStats?.totalActiveStudents)} color="#60a5fa" />
          <KpiCard label="OPT Total"       value={fmt(optStats?.totalOpt)}            color="#34d399" />
          <KpiCard label="STEM OPT"        value={fmt(optStats?.totalStemOpt)}        color="#fbbf24" />
          <KpiCard label="CPT Total"       value={fmt(optStats?.totalCpt)}            color="#a78bfa" />
          <KpiCard label="Schools"         value={fmt(optStats?.uniqueSchools)}       color="#e2e8f0" />
        </div>
      </section>

      <section className="kpi-section">
        <div className="section-label">EB Green Cards</div>
        <div className="kpi-grid">
          <KpiCard label="Approvals"    value={fmt(ebStats?.totalApprovals)} color="#60a5fa" />
          <KpiCard label="Denials"      value={fmt(ebStats?.totalDenials)}   color="#f87171" />
          <KpiCard label="Receipts"     value={fmt(ebStats?.totalReceipts)}  color="#e2e8f0" />
          <KpiCard label="Approval Rate" value={ebStats?.approvalRate ? `${ebStats.approvalRate.toFixed(1)}%` : "—"} color="#34d399" />
        </div>
      </section>

      <section className="kpi-section">
        <div className="section-label">PERM · O-1</div>
        <div className="kpi-grid">
          <KpiCard label="PERM Certified"   value={fmt(permStats?.totalApproved)}     color="#34d399" />
          <KpiCard label="PERM Denied"      value={fmt(permStats?.totalDenied)}       color="#f87171" />
          <KpiCard label="O-1 Approvals"    value={fmt(o1Stats?.totalApprovals)}      color="#60a5fa" />
          <KpiCard label="O-1 Approval Rate" value={o1Stats?.approvalRate ? `${o1Stats.approvalRate.toFixed(1)}%` : "—"} color="#34d399" />
        </div>
      </section>

      {/* Approval rate comparison */}
      {approvalCompare.length > 1 && (
        <section className="chart-section">
          <div className="section-label">Approval Rate Comparison — {year || "All Years"}</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={approvalCompare} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [`${v}%`, "Approval Rate"]}
              />
              <Bar dataKey="rate" name="Approval Rate" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* H-1B trend chart */}
      {h1bTrends && h1bTrends.length > 0 && (
        <section className="chart-section">
          <div className="section-label">H-1B Year-over-Year Trend</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={h1bTrends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v) => [fmt(v)]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="initialApprovals" name="Initial Approvals" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="initialDenials"   name="Initial Denials"   fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Pipeline view (mini) */}
      <section className="chart-section">
        <div className="section-label">Visa Pipeline Overview</div>
        <PipelineView mini />
      </section>

      {syncStatus && (
        <section className="sync-section">
          <div className="section-label">Data Freshness</div>
          <div className="sync-grid">
            {syncStatus.map((s) => (
              <div key={s.source} className="sync-card">
                <div className="sync-card__source">{s.source}</div>
                <div className={`sync-card__status sync-card__status--${s.status}`}>{s.status}</div>
                <div className="sync-card__date">
                  {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : "Never"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
