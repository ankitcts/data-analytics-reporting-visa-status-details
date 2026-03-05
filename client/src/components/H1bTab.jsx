import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#38bdf8", "#4ade80", "#e879f9", "#2dd4bf", "#f472b6"];

const USCIS_YEARS = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009];
const LCA_YEARS  = [2026, 2025, 2024];
const ALL_YEARS  = [...LCA_YEARS, ...USCIS_YEARS];
const COUNTRY_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009];

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function isLcaYear(y) { return LCA_YEARS.includes(Number(y)); }

export default function H1bTab() {
  const [year, setYear]         = useState("2022");
  const [countryYear, setCountryYear] = useState("2023");

  // For USCIS years: source=USCIS_HUB; for LCA years: source=DOL_LCA
  const source = year && isLcaYear(year) ? "DOL_LCA" : "USCIS_HUB";

  const { data: stats }             = useVisaData("/h1b/stats",  { year, source });
  const { data: trends }            = useVisaData("/h1b/trends", { source: "USCIS_HUB" });
  const { data: lcaTrends }         = useVisaData("/h1b/trends", { source: "DOL_LCA" });
  const { data: sponsors, loading: spLoading } = useVisaData("/h1b/sponsors", { year, limit: 20, source });
  const { data: countryData }       = useVisaData("/h1b/country-breakdown", { year: countryYear });
  const { data: states }            = useVisaData("/h1b/states", { year, source });

  // Merge USCIS + LCA trends into unified chart
  const mergedTrends = React.useMemo(() => {
    const byYear = {};
    (trends || []).forEach(t => { byYear[t.year] = { ...t, source: "USCIS" }; });
    (lcaTrends || []).forEach(t => {
      if (!byYear[t.year]) byYear[t.year] = { year: t.year, initialApprovals: 0, initialDenials: 0, rfeIssued: 0 };
      byYear[t.year].lcaApprovals = t.initialApprovals;
      byYear[t.year].lcaDenials   = t.initialDenials;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends, lcaTrends]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">H-1B Visa Program</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            <optgroup label="DOL LCA (FY2024–2026)">
              {LCA_YEARS.map(y => <option key={y} value={y}>FY{y} (LCA)</option>)}
            </optgroup>
            <optgroup label="USCIS Employer Hub (FY2009–2023)">
              {USCIS_YEARS.map(y => (
                <option key={y} value={y}>FY{y}{y === 2023 ? " ★partial" : ""}</option>
              ))}
            </optgroup>
          </select>
          {year && isLcaYear(year) && (
            <span className="badge badge--lca">DOL LCA Source</span>
          )}
          {year === "2023" && (
            <span className="badge badge--warn">Partial Year Data</span>
          )}
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Initial Approvals", value: fmt(stats.totalInitialApprovals), color: "#60a5fa" },
            { label: "Initial Denials",   value: fmt(stats.totalInitialDenials),   color: "#f87171" },
            { label: "Approval Rate",     value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
            { label: "Continuing Approvals", value: fmt(stats.totalContinuingApprovals), color: "#a78bfa" },
            { label: "RFE Issued",        value: fmt(stats.totalRfeIssued),        color: "#fbbf24" },
            { label: "Employers",         value: fmt(stats.uniqueEmployers),       color: "#e2e8f0" },
          ].map(k => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {mergedTrends.length > 0 && (
        <section className="chart-section">
          <div className="section-label">
            H-1B Approval Trend (FY2009–FY2026)
            <span className="section-note"> · USCIS data FY2009–2023, DOL LCA data FY2024–2026</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={mergedTrends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                formatter={(v) => [fmt(v)]}
              />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Line type="monotone" dataKey="initialApprovals" name="Initial Approvals (USCIS)" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="initialDenials"   name="Initial Denials (USCIS)"   stroke="#f87171" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="lcaApprovals"     name="LCA Certified (DOL)"       stroke="#34d399" dot={false} strokeWidth={2} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      <div className="two-col">
        {/* Top Sponsors Table */}
        <section className="chart-section">
          <div className="section-label">
            Top 20 H-1B Employers (FY{year || "All"})
            {year && isLcaYear(year) && <span className="section-note"> · LCA Certifications</span>}
          </div>
          {spLoading && <div className="dim" style={{ padding: "12px 0" }}>Loading…</div>}
          {sponsors && sponsors.length > 0 && (
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
          )}
          {sponsors && sponsors.length === 0 && (
            <div className="dim" style={{ padding: "12px 0" }}>No data available for this year.</div>
          )}
        </section>

        {/* Country of Birth Breakdown */}
        <section className="chart-section">
          <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            H-1B Beneficiaries by Country of Birth
            <select
              className="year-select"
              style={{ marginLeft: "auto", fontSize: 12 }}
              value={countryYear}
              onChange={e => setCountryYear(e.target.value)}
            >
              {COUNTRY_YEARS.map(y => <option key={y} value={y}>FY{y}</option>)}
            </select>
          </div>
          {countryData && countryData.countries && (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={countryData.countries.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis type="category" dataKey="country" width={110} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1e2130", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(v, name, props) => [
                      `${fmt(v)} (${props.payload.pct}%)`,
                      "Approvals"
                    ]}
                  />
                  <Bar dataKey="approvals" name="Approvals" radius={[0, 3, 3, 0]}>
                    {countryData.countries.slice(0, 10).map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="dim" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>
                Total FY{countryYear}: {fmt(countryData.total)} approvals.
                Source: {countryData.source}.
              </div>
            </>
          )}
        </section>
      </div>

      {/* State Breakdown */}
      {states && states.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Approvals by State (FY{year || "All"})</div>
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
