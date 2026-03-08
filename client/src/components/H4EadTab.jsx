import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "H4_EAD", label: "H-4 EAD" },
  { value: "H4_EXTENSION", label: "H-4 Extension" },
  { value: "H4_CHANGE_STATUS", label: "Change of Status" },
];

const YEARS = [];
for (let y = 2026; y >= 2015; y--) YEARS.push(y);

export default function H4EadTab() {
  const [year, setYear] = useState("2023");
  const [category, setCategory] = useState("");

  const { data: stats } = useVisaData("/h4ead/stats", { year, category });
  const { data: trends } = useVisaData("/h4ead/trends", { category });

  // Pivot trends for chart: [{ year, H4_EAD: n, H4_EXTENSION: n }]
  const chartData = React.useMemo(() => {
    if (!trends) return [];
    const byYear = {};
    trends.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year][r.category] = r.approvals;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">H-4 EAD Program</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="year-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Receipts",      value: fmt(stats.totalReceipts),  color: "#e2e8f0" },
            { label: "Approvals",     value: fmt(stats.totalApprovals), color: "#60a5fa" },
            { label: "Denials",       value: fmt(stats.totalDenials),   color: "#f87171" },
            { label: "Pending",       value: fmt(stats.totalPending),   color: "#fbbf24" },
            { label: "Approval Rate", value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-box">
        <strong>H-4 EAD</strong> — Employment Authorization for H-4 dependents (spouses of H-1B holders in certain green card stages).
        Introduced <strong>2015</strong> (Obama rule). Paused/challenged 2017–2021. Restored 2021 (Biden administration).
        Covers only H-4 holders whose H-1B spouse has an approved I-140 or has been granted H-1B extensions beyond 6 years.
      </div>

      {chartData.length > 0 && (
        <section className="chart-section">
          <div className="section-label">H-4 EAD Approvals — Year-over-Year</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Line type="monotone" dataKey="H4_EAD" name="H-4 EAD" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="H4_EXTENSION" name="H-4 Extension" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="H4_CHANGE_STATUS" name="Change of Status" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
