import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

const YEARS = [];
for (let y = 2023; y >= 2016; y--) YEARS.push(y);

export default function O1Tab() {
  const [year, setYear] = useState("2023");
  const [subType, setSubType] = useState("");
  const [country, setCountry] = useState("");

  const { data: stats } = useVisaData("/o1/stats", { year, subType, country });
  const { data: trends } = useVisaData("/o1/trends", { subType });
  const { data: countries } = useVisaData("/o1/countries", { year, subType, limit: 15 });

  // Pivot trends for chart: [{ year, O1A: n, O1B: n }]
  const chartData = React.useMemo(() => {
    if (!trends) return [];
    const byYear = {};
    trends.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year][r.subType] = r.approvals;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">O-1 Visa (Extraordinary Ability)</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="year-select" value={subType} onChange={(e) => setSubType(e.target.value)}>
            <option value="">All Types</option>
            <option value="O1A">O-1A (Sciences, Business, Education, Athletics)</option>
            <option value="O1B">O-1B (Arts, Motion Picture, TV)</option>
          </select>
          <input className="search-input" placeholder="Filter by country…" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Receipts",      value: fmt(stats.totalReceipts),  color: "#e2e8f0" },
            { label: "Approvals",     value: fmt(stats.totalApprovals), color: "#60a5fa" },
            { label: "Denials",       value: fmt(stats.totalDenials),   color: "#f87171" },
            { label: "Approval Rate", value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
            { label: "RFE Rate",      value: stats.rfeRate ? `${stats.rfeRate.toFixed(1)}%` : "—", color: "#fbbf24" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-box">
        <strong>O-1A</strong> — Sciences, education, business, or athletics — requires evidence of extraordinary ability (awards, publications, high salary, etc.).
        <br />
        <strong>O-1B</strong> — Arts, motion picture, or TV — requires evidence of distinction.
        <br />
        <strong>No annual cap.</strong> Can self-petition. Often used by founders, artists, athletes, and researchers.
      </div>

      <div className="two-col">
        {chartData.length > 0 && (
          <section className="chart-section">
            <div className="section-label">O-1A vs O-1B Approvals Over Time</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Line type="monotone" dataKey="O1A" name="O-1A" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="O1B" name="O-1B" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}

        {countries && countries.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top Countries (FY{year || "All"})</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={countries} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={120} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
                <Bar dataKey="approvals" name="Approvals" fill="#be185d" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>
    </div>
  );
}
