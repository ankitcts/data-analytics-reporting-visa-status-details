import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function L1Tab() {
  const [year, setYear] = useState("2023");
  const [visaType, setVisaType] = useState("");

  const { data: stats } = useVisaData("/l1/stats", { year, type: visaType });
  const { data: trends } = useVisaData("/l1/trends", { type: visaType });
  const { data: countries } = useVisaData("/l1/countries", { year, type: visaType, limit: 15 });

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">L-1A / L-1B Visa Program</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {[2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="year-select" value={visaType} onChange={(e) => setVisaType(e.target.value)}>
            <option value="">All Types</option>
            <option value="L1A">L-1A (Managers/Executives)</option>
            <option value="L1B">L-1B (Specialized Knowledge)</option>
          </select>
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Approvals", value: fmt(stats.totalApprovals), color: "#60a5fa" },
            { label: "Denials", value: fmt(stats.totalDenials), color: "#f87171" },
            { label: "Approval Rate", value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
            { label: "Unique Employers", value: fmt(stats.uniqueEmployers), color: "#a78bfa" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-box">
        <strong>L-1A</strong> — Intracompany transferees in managerial or executive roles. Max stay: 7 years. Eligible for EB-1C green card (no PERM required).
        <br />
        <strong>L-1B</strong> — Intracompany transferees with specialized knowledge. Max stay: 5 years. Typically uses EB-2/EB-3 green card path.
      </div>

      {trends && trends.length > 0 && (
        <section className="chart-section">
          <div className="section-label">L-1A vs L-1B Approval Trend</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={Object.values(
                trends.reduce((acc, row) => {
                  if (!acc[row.year]) acc[row.year] = { year: row.year };
                  acc[row.year][row.visaType] = row.approvals;
                  return acc;
                }, {})
              ).sort((a, b) => a.year - b.year)}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [fmt(v)]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Line type="monotone" dataKey="L1A" name="L-1A" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="L1B" name="L-1B" stroke="#34d399" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="L1" name="L-1 (Combined)" stroke="#fbbf24" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {countries && countries.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Country Breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={countries.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis type="category" dataKey="country" width={120} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [fmt(v)]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="approvals" name="Approvals" fill="#60a5fa" radius={[0, 3, 3, 0]} />
              <Bar dataKey="denials" name="Denials" fill="#f87171" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
