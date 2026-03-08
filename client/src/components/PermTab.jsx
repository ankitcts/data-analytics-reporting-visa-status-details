import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
for (let y = 2026; y >= 2014; y--) YEARS.push(y);

function EmployersTable({ year }) {
  const [page, setPage]   = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sort, setSort]   = useState("certified");

  const { data, loading } = useVisaData(
    year ? "/perm/employers" : null,
    { year: year || undefined, search, page, limit: 50, sort }
  );

  const handleSearch = (e) => { e.preventDefault(); setSearch(draft); setPage(1); };

  return (
    <section className="chart-section">
      <div className="section-label">All Employers — FY{year || "All"}</div>
      <div className="employers-toolbar">
        <form className="explorer-form" onSubmit={handleSearch} style={{ flex: 1 }}>
          <input className="explorer-input" type="text" placeholder="Filter by employer…" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button className="explorer-btn" type="submit">Filter</button>
          {search && (
            <button className="explorer-btn" type="button" style={{ background: "#334155" }}
              onClick={() => { setDraft(""); setSearch(""); setPage(1); }}>Clear</button>
          )}
        </form>
        <div className="sort-tabs">
          {[{ key: "certified", label: "Certified" }, { key: "denied", label: "Denied" }, { key: "total", label: "Total" }].map((s) => (
            <button key={s.key} className={`sort-tab${sort === s.key ? " sort-tab--active" : ""}`} onClick={() => { setSort(s.key); setPage(1); }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {loading && <div className="dim" style={{ padding: "12px 0" }}>Loading…</div>}
      {data && data.data && data.data.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Employer</th><th>State</th><th>Total Cases</th><th>Certified</th><th>Denied</th><th>Withdrawn</th><th>Cert. Rate</th></tr>
              </thead>
              <tbody>
                {data.data.map((emp, i) => (
                  <tr key={i}>
                    <td className="dim">{(page - 1) * 50 + i + 1}</td>
                    <td>{emp.employer}</td>
                    <td className="dim">{emp.state || "—"}</td>
                    <td className="num">{fmt(emp.totalCases)}</td>
                    <td className="num green">{fmt(emp.certified)}</td>
                    <td className="num red">{fmt(emp.denied)}</td>
                    <td className="num dim">{fmt(emp.withdrawn)}</td>
                    <td className="dim">{pct(emp.certificationRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <span className="page-info">Page {page} / {data.pages} · {fmt(data.total)} employers</span>
            <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>›</button>
            <button disabled={page >= data.pages} onClick={() => setPage(data.pages)}>»</button>
          </div>
        </>
      )}
      {data && data.data && data.data.length === 0 && <div className="dim" style={{ padding: "12px 0" }}>No employers found.</div>}
    </section>
  );
}

export default function PermTab() {
  const [year, setYear] = useState("2023");
  const [showEmployers, setShowEmployers] = useState(false);

  const { data: stats } = useVisaData("/perm/stats", { year });
  const { data: trends } = useVisaData("/perm/trends");
  const { data: states } = useVisaData("/perm/states", { year });

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">DOL PERM (Permanent Labor Certification)</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {stats && (
        <div className="kpi-grid kpi-grid--compact">
          {[
            { label: "Total Filings",        value: fmt(stats.totalCases),       color: "#e2e8f0" },
            { label: "Certified",            value: fmt(stats.totalApproved),    color: "#34d399" },
            { label: "Denied",               value: fmt(stats.totalDenied),      color: "#f87171" },
            { label: "Withdrawn",            value: fmt(stats.totalWithdrawn),   color: "#fbbf24" },
            { label: "Certification Rate",   value: stats.certificationRate ? `${stats.certificationRate.toFixed(1)}%` : "—", color: "#60a5fa" },
          ].map((k) => (
            <div key={k.label} className="kpi-card kpi-card--sm">
              <div className="kpi-card__label">{k.label}</div>
              <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-box">
        <strong>PERM</strong> (Program Electronic Review Management) — the DOL labor certification step required for most EB-2 and EB-3 green cards.
        Employer must demonstrate no qualified US worker is available. Typical processing: 6–18 months before I-140 can be filed.
      </div>

      <div className="two-col">
        {trends && trends.length > 0 && (
          <section className="chart-section">
            <div className="section-label">PERM Trend — Certified vs Denied</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trends} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                <Bar dataKey="certified" name="Certified" fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="denied" name="Denied" fill="#f87171" radius={[3, 3, 0, 0]} />
                <Bar dataKey="withdrawn" name="Withdrawn" fill="#fbbf24" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {states && states.length > 0 && (
          <section className="chart-section">
            <div className="section-label">Top States by Certified Cases (FY{year || "All"})</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={states.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis type="category" dataKey="state" width={30} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
                <Bar dataKey="certified" name="Certified" fill="#7c3aed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button className="explorer-btn" style={{ fontSize: 13, padding: "8px 24px" }}
          onClick={() => setShowEmployers((v) => !v)}>
          {showEmployers ? "Hide" : "Show"} Employer Table
        </button>
      </div>
      {showEmployers && <EmployersTable year={year} />}
    </div>
  );
}
