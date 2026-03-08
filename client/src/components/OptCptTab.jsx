import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function OptCptTab() {
  const [year, setYear] = useState("2023");
  const [country, setCountry] = useState("");

  const { data: stats } = useVisaData("/optcpt/stats", { year, country });
  const { data: trends } = useVisaData("/optcpt/trends");
  const { data: schools, loading: schoolLoading } = useVisaData("/optcpt/schools", { year, limit: 20 });
  const { data: countries } = useVisaData("/optcpt/countries", { year, limit: 12 });

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">OPT / F-1 Program</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {[2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
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
            { label: "Active Students", value: fmt(stats.totalActiveStudents), color: "#60a5fa" },
            { label: "OPT Participants", value: fmt(stats.totalOpt), color: "#34d399" },
            { label: "STEM OPT", value: fmt(stats.totalStemOpt), color: "#fbbf24" },
            { label: "CPT Participants", value: fmt(stats.totalCpt), color: "#a78bfa" },
            { label: "Schools Reporting", value: fmt(stats.uniqueSchools), color: "#e2e8f0" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-box">
        <strong>OPT</strong> — 12 months post-graduation work authorization for F-1 students. STEM graduates may apply for a <strong>24-month STEM OPT extension</strong> (total 36 months).
        <br />
        <strong>CPT</strong> — Authorized off-campus work as part of a curriculum requirement. Must be integral to the degree program.
        <br />
        <strong>Pipeline:</strong> OPT is the primary pathway to H-1B — see the <em>Overview</em> tab for F-1 → OPT → H-1B funnel visualization.
      </div>

      {trends && trends.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Active Students Over Time</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="stemGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="quarter" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={3} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [fmt(v)]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Area type="monotone" dataKey="optCount" name="OPT" stroke="#60a5fa" fill="url(#optGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="stemOptCount" name="STEM OPT" stroke="#fbbf24" fill="url(#stemGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      <div className="two-col">
        {schools && schools.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top 20 Schools ({year || "All Years"})</div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>School</th>
                    <th>State</th>
                    <th>Active</th>
                    <th>OPT</th>
                    <th>STEM OPT</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((s, i) => (
                    <tr key={i}>
                      <td className="dim">{i + 1}</td>
                      <td>{s.school}</td>
                      <td className="dim">{s.state || "—"}</td>
                      <td className="num">{fmt(s.activeStudents)}</td>
                      <td className="num green">{fmt(s.optCount)}</td>
                      <td className="num gold">{fmt(s.stemOptCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {countries && countries.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top Countries</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={countries} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={110} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                  formatter={(v) => [fmt(v)]}
                />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Bar dataKey="activeStudents" name="Active Students" fill="#60a5fa" radius={[0, 3, 3, 0]} />
                <Bar dataKey="stemOptCount" name="STEM OPT" fill="#fbbf24" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>
    </div>
  );
}
