import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

const EB_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "EB1", label: "EB-1 (Priority Workers)" },
  { value: "EB1A", label: "EB-1A (Extraordinary Ability)" },
  { value: "EB1B", label: "EB-1B (Outstanding Professors/Researchers)" },
  { value: "EB1C", label: "EB-1C (Multinational Managers)" },
  { value: "EB2", label: "EB-2 (Advanced Degree)" },
  { value: "EB2NIW", label: "EB-2 NIW (National Interest Waiver)" },
  { value: "EB3", label: "EB-3 (Skilled Workers)" },
  { value: "EB3W", label: "EB-3W (Other Workers)" },
  { value: "EB4", label: "EB-4 (Special Immigrants)" },
  { value: "EB5", label: "EB-5 (Investors)" },
];

const YEARS = [];
for (let y = 2026; y >= 2009; y--) YEARS.push(y);

export default function EbTab() {
  const [year, setYear] = useState("2023");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");

  const { data: stats } = useVisaData("/eb/stats", { year, category, country });
  const { data: byCategory } = useVisaData("/eb/by-category", { year });
  const { data: countries } = useVisaData("/eb/countries", { year, category, limit: 15 });
  const { data: trends } = useVisaData("/eb/trends", { category });

  // Pivot trends for stacked bar: [{ year, EB1: n, EB2: n, EB3: n }]
  const trendChart = React.useMemo(() => {
    if (!trends) return [];
    const byYear = {};
    trends.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year][r.category] = (byYear[r.year][r.category] || 0) + r.approvals;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">EB Green Cards (Employment-Based)</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="year-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
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
            { label: "Total Approvals", value: fmt(stats.totalApprovals), color: "#60a5fa" },
            { label: "Total Denials",   value: fmt(stats.totalDenials),   color: "#f87171" },
            { label: "Receipts",        value: fmt(stats.totalReceipts),  color: "#e2e8f0" },
            { label: "Pending",         value: fmt(stats.totalPending),   color: "#fbbf24" },
            { label: "Approval Rate",   value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-box">
        <strong>EB-1C</strong> is the green card for multinational managers/executives — the natural pathway from L-1A.
        <br />
        <strong>EB-2 NIW</strong> — self-petition, no employer sponsorship or PERM required.
        <br />
        <strong>Country retrogression:</strong> India and China nationals typically wait 10+ years for EB-2/EB-3 due to per-country visa caps.
      </div>

      <div className="two-col">
        {trendChart.length > 0 && (
          <section className="chart-section">
            <div className="section-label">EB Approvals by Category — Year Trend</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => [fmt(v)]} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Bar dataKey="EB1" name="EB-1" fill="#60a5fa" stackId="eb" radius={[0, 0, 0, 0]} />
                <Bar dataKey="EB2" name="EB-2" fill="#34d399" stackId="eb" radius={[0, 0, 0, 0]} />
                <Bar dataKey="EB3" name="EB-3" fill="#fbbf24" stackId="eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {countries && countries.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top Countries by Approvals (FY{year || "All"})</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={countries} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="country" width={120} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => [fmt(v)]} />
                <Bar dataKey="approvals" name="Approvals" fill="#60a5fa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      {byCategory && byCategory.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Approvals by Category (FY{year || "All"})</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Category</th><th>Approvals</th><th>Denials</th><th>Receipts</th></tr>
              </thead>
              <tbody>
                {byCategory.map((r) => (
                  <tr key={r.category}>
                    <td>{r.category}</td>
                    <td className="num green">{fmt(r.approvals)}</td>
                    <td className="num red">{fmt(r.denials)}</td>
                    <td className="num">{fmt(r.receipts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
