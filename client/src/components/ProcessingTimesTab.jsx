import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

const FORM_TYPES = [
  { value: "", label: "All Forms" },
  { value: "I129", label: "I-129 (Work Visas — H-1B, L-1, O-1)" },
  { value: "I140", label: "I-140 (Immigrant Petition)" },
  { value: "I765", label: "I-765 (Employment Authorization)" },
  { value: "I485", label: "I-485 (Adjustment of Status)" },
  { value: "I539", label: "I-539 (Change/Extend Status)" },
  { value: "I131", label: "I-131 (Travel Document)" },
];

const COLORS = {
  I129: "#60a5fa",
  I140: "#34d399",
  I765: "#fbbf24",
  I485: "#f87171",
  I539: "#a78bfa",
  I131: "#fb923c",
};

const YEARS = [];
for (let y = 2026; y >= 2010; y--) YEARS.push(y);

export default function ProcessingTimesTab() {
  const [year, setYear] = useState("2023");
  const [formType, setFormType] = useState("");

  const { data: stats } = useVisaData("/processing/stats", { year, formType });
  const { data: byForm } = useVisaData("/processing/by-form", { year });
  const { data: trends } = useVisaData("/processing/trends", { formType });

  // Pivot trends for chart: [{ year, I129: days, I140: days, ... }]
  const chartData = React.useMemo(() => {
    if (!trends) return [];
    const byYear = {};
    trends.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year][r.formType] = r.avgProcessingDays;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">USCIS Processing Times</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="year-select" value={formType} onChange={(e) => setFormType(e.target.value)}>
            {FORM_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {stats && Object.keys(stats).length > 0 && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Avg Processing Days", value: stats.avgProcessingDays ? `${stats.avgProcessingDays} days` : "—", color: "#60a5fa" },
            { label: "Median Days",         value: stats.medianDays ? `${stats.medianDays} days` : "—", color: "#34d399" },
            { label: "Completion Rate",     value: stats.completionRate ? `${stats.completionRate}%` : "—", color: "#fbbf24" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {chartData.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Processing Days Trend by Form Type</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${v}d`} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [`${v} days`]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              {Object.keys(COLORS).map((ft) => (
                <Line key={ft} type="monotone" dataKey={ft} name={ft} stroke={COLORS[ft]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {byForm && byForm.length > 0 && (
        <section className="chart-section">
          <div className="section-label">All Form Types Side-by-Side (FY{year || "All"})</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Form</th><th>Avg Days</th><th>Median Days</th><th>Completion Rate</th></tr>
              </thead>
              <tbody>
                {byForm.map((r) => (
                  <tr key={r.formType}>
                    <td><strong>{r.formType}</strong></td>
                    <td className="num" style={{ color: "#60a5fa" }}>{r.avgProcessingDays ? `${r.avgProcessingDays}d` : "—"}</td>
                    <td className="num" style={{ color: "#34d399" }}>{r.medianDays ? `${r.medianDays}d` : "—"}</td>
                    <td className="num" style={{ color: "#fbbf24" }}>{r.completionRate ? `${r.completionRate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(!byForm || byForm.length === 0) && (
        <div className="info-box">
          Processing time data will appear here once the database is seeded with USCIS historic processing time data.
          Run: <code>node scripts/seed-historical.js --only processing</code>
        </div>
      )}
    </div>
  );
}
