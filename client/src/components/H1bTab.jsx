import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#38bdf8", "#4ade80"];

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function H1bTab() {
  const [year, setYear] = useState("2023");
  const [country, setCountry] = useState("");

  const { data: stats } = useVisaData("/h1b/stats", { year, country });
  const { data: trends } = useVisaData("/h1b/trends", { country });
  const { data: sponsors, loading: spLoading } = useVisaData("/h1b/sponsors", { year, limit: 20 });
  const { data: countries } = useVisaData("/h1b/countries", { year, limit: 15 });
  const { data: states } = useVisaData("/h1b/states", { year });

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">H-1B Visa Program</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {[2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input
            className="search-input"
            placeholder="Filter by country…"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Initial Approvals", value: fmt(stats.totalInitialApprovals), color: "#60a5fa" },
            { label: "Initial Denials", value: fmt(stats.totalInitialDenials), color: "#f87171" },
            { label: "Approval Rate", value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
            { label: "Continuing Approvals", value: fmt(stats.totalContinuingApprovals), color: "#a78bfa" },
            { label: "RFE Issued", value: fmt(stats.totalRfeIssued), color: "#fbbf24" },
            { label: "Employers", value: fmt(stats.uniqueEmployers), color: "#e2e8f0" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {trends && trends.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Approval &amp; Denial Trend (FY2009–FY2024)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [fmt(v)]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Line type="monotone" dataKey="initialApprovals" name="Initial Approvals" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="initialDenials" name="Initial Denials" stroke="#f87171" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="rfeIssued" name="RFE Issued" stroke="#fbbf24" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      <div className="two-col">
        {sponsors && sponsors.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top 20 H-1B Employers ({year || "All Years"})</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Employer</th>
                    <th>State</th>
                    <th>Approvals</th>
                    <th>Denials</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.map((s, i) => (
                    <tr key={i}>
                      <td className="dim">{i + 1}</td>
                      <td>{s.employer}</td>
                      <td className="dim">{s.state || "—"}</td>
                      <td className="num green">{fmt(s.initialApprovals)}</td>
                      <td className="num red">{fmt(s.initialDenials)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {countries && countries.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top Countries of Origin</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={countries.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={120} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v) => [fmt(v)]}
                />
                <Bar dataKey="initialApprovals" name="Approvals" fill="#60a5fa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      {states && states.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Approvals by State</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={states.slice(0, 15)} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="state" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [fmt(v)]}
              />
              <Bar dataKey="initialApprovals" name="Approvals" fill="#60a5fa" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
