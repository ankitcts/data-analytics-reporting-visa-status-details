import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

export default function Dashboard() {
  const [year, setYear] = useState("");

  const { data: h1bStats, loading: h1bLoading } = useVisaData("/h1b/stats", { year });
  const { data: l1Stats, loading: l1Loading } = useVisaData("/l1/stats", { year });
  const { data: optStats, loading: optLoading } = useVisaData("/optcpt/stats", { year });
  const { data: h1bTrends } = useVisaData("/h1b/trends");
  const { data: syncStatus } = useVisaData("/sync/status");

  const loading = h1bLoading || l1Loading || optLoading;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">Overview</h2>
        <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading && <div className="loading">Loading data…</div>}

      <section className="kpi-section">
        <div className="section-label">H-1B</div>
        <div className="kpi-grid">
          <KpiCard label="Initial Approvals" value={fmt(h1bStats?.totalInitialApprovals)} color="#60a5fa" />
          <KpiCard label="Initial Denials" value={fmt(h1bStats?.totalInitialDenials)} color="#f87171" />
          <KpiCard label="Approval Rate" value={h1bStats?.approvalRate ? `${h1bStats.approvalRate.toFixed(1)}%` : "—"} color="#34d399" />
          <KpiCard label="RFE Issued" value={fmt(h1bStats?.totalRfeIssued)} color="#fbbf24" />
          <KpiCard label="Unique Employers" value={fmt(h1bStats?.uniqueEmployers)} color="#a78bfa" />
        </div>
      </section>

      <section className="kpi-section">
        <div className="section-label">L-1A / L-1B</div>
        <div className="kpi-grid">
          <KpiCard label="Approvals" value={fmt(l1Stats?.totalApprovals)} color="#60a5fa" />
          <KpiCard label="Denials" value={fmt(l1Stats?.totalDenials)} color="#f87171" />
          <KpiCard label="Approval Rate" value={l1Stats?.approvalRate ? `${l1Stats.approvalRate.toFixed(1)}%` : "—"} color="#34d399" />
          <KpiCard label="Unique Employers" value={fmt(l1Stats?.uniqueEmployers)} color="#a78bfa" />
        </div>
      </section>

      <section className="kpi-section">
        <div className="section-label">OPT / CPT</div>
        <div className="kpi-grid">
          <KpiCard label="Active Students" value={fmt(optStats?.totalActiveStudents)} color="#60a5fa" />
          <KpiCard label="OPT Total" value={fmt(optStats?.totalOpt)} color="#34d399" />
          <KpiCard label="STEM OPT" value={fmt(optStats?.totalStemOpt)} color="#fbbf24" />
          <KpiCard label="CPT Total" value={fmt(optStats?.totalCpt)} color="#a78bfa" />
          <KpiCard label="Schools" value={fmt(optStats?.uniqueSchools)} color="#e2e8f0" />
        </div>
      </section>

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
              <Bar dataKey="initialDenials" name="Initial Denials" fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

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
