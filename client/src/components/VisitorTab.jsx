import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function pct(n) {
  if (!n && n !== 0) return "—";
  return `${Number(n).toFixed(1)}%`;
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

const YEARS = [];
for (let y = 2026; y >= 2000; y--) YEARS.push(y);

export default function VisitorTab() {
  const [year, setYear] = useState("2023");
  const [visaClass, setVisaClass] = useState("B1B2");
  const [country, setCountry] = useState("");

  const { data: stats } = useVisaData("/visitor/stats", { year, country, visaClass });
  const { data: trends } = useVisaData("/visitor/trends", { country, visaClass });
  const { data: byCountry } = useVisaData("/visitor/by-country", { year, limit: 20, visaClass });

  // Countries sorted by refusal rate (highest first) for refusal chart
  const refusalRateData = React.useMemo(() => {
    if (!byCountry) return [];
    return [...byCountry].sort((a, b) => (b.refusalRate || 0) - (a.refusalRate || 0)).slice(0, 15);
  }, [byCountry]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">Visitor Visas (B-1 / B-2)</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="year-select" value={visaClass} onChange={(e) => setVisaClass(e.target.value)}>
            <option value="">All Classes</option>
            <option value="B1B2">B-1/B-2 (Combined)</option>
            <option value="B1">B-1 (Business)</option>
            <option value="B2">B-2 (Tourism)</option>
          </select>
          <input className="search-input" placeholder="Filter by country…" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Total Issuances",    value: fmt(stats.totalIssuances),           color: "#60a5fa" },
            { label: "Total Refusals",     value: fmt(stats.totalRefusals),            color: "#f87171" },
            { label: "Overall Refusal Rate", value: stats.overallRefusalRate ? `${stats.overallRefusalRate.toFixed(1)}%` : "—", color: "#fbbf24" },
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
          <div className="section-label">Issuances vs Refusals Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Line type="monotone" dataKey="issuances" name="Issuances" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="refusals" name="Refusals" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      <div className="two-col">
        {byCountry && byCountry.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top 20 Countries by Issuances (FY{year || "All"})</div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={byCountry} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={100} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
                <Bar dataKey="issuances" name="Issuances" fill="#60a5fa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {refusalRateData.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Refusal Rate by Country (Highest First)</div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={refusalRateData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={100} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Refusal Rate"]} />
                <Bar dataKey="refusalRate" name="Refusal Rate %" fill="#f87171" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>
    </div>
  );
}
