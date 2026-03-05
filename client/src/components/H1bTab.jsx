import React, { useState, useCallback, useRef } from "react";
import { useVisaData } from "../hooks/useVisaData";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
  ComposedChart, Area,
} from "recharts";

const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#38bdf8", "#4ade80", "#e879f9", "#2dd4bf", "#f472b6"];

const USCIS_YEARS = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009];
const LCA_YEARS  = [2026, 2025, 2024];
const COUNTRY_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009];

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

function isLcaYear(y) { return LCA_YEARS.includes(Number(y)); }

// Tooltip style shared
const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

// ─── Company Explorer ───────────────────────────────────────────────────────
function CompanyExplorer() {
  const [query, setQuery]       = useState("");
  const [suggestions, setSuggs] = useState([]);
  const [showSuggs, setShowSuggs] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const suggestTimer            = useRef(null);
  const inputRef                = useRef(null);

  // Debounced autocomplete
  const fetchSuggestions = useCallback((q) => {
    clearTimeout(suggestTimer.current);
    if (q.trim().length < 2) { setSuggs([]); setShowSuggs(false); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/h1b/employer-suggest?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setSuggs(Array.isArray(d) ? d : []);
        setShowSuggs(true);
      } catch { setSuggs([]); }
    }, 280);
  }, []);

  const lookup = useCallback(async (name) => {
    if (!name.trim()) return;
    setShowSuggs(false);
    setSuggs([]);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`/api/h1b/company?name=${encodeURIComponent(name.trim())}`);
      if (r.status === 404) { setError(`No H-1B records found for "${name.trim()}".`); setLoading(false); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setResult(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    lookup(query);
  };

  const pickSuggestion = (name) => {
    setQuery(name);
    setShowSuggs(false);
    lookup(name);
  };

  const totalInitial     = result ? result.years.reduce((s, r) => s + (r.initialApprovals || 0), 0) : 0;
  const totalContinuing  = result ? result.years.reduce((s, r) => s + (r.continuingApprovals || 0), 0) : 0;
  const totalDenials     = result ? result.years.reduce((s, r) => s + (r.initialDenials || 0), 0) : 0;
  const totalIssued      = totalInitial + totalContinuing;

  return (
    <section className="chart-section company-explorer">
      <div className="section-label">Company Explorer</div>
      <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
        Search any employer to see their full H-1B history across all available years.
      </p>

      <div className="explorer-wrap">
        <form className="explorer-form" onSubmit={handleSubmit}>
          <div className="explorer-input-wrap">
            <input
              ref={inputRef}
              className="explorer-input"
              type="text"
              placeholder="e.g. INFOSYS, GOOGLE, AMAZON, TATA CONSULTANCY…"
              value={query}
              onChange={e => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
              onBlur={() => setTimeout(() => setShowSuggs(false), 200)}
              onFocus={() => suggestions.length > 0 && setShowSuggs(true)}
              autoComplete="off"
            />
            {showSuggs && suggestions.length > 0 && (
              <ul className="suggest-list">
                {suggestions.map(s => (
                  <li key={s} className="suggest-item" onMouseDown={() => pickSuggestion(s)}>{s}</li>
                ))}
              </ul>
            )}
          </div>
          <button className="explorer-btn" type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
      </div>

      {error && <div className="dim" style={{ color: "#f87171", marginTop: 10 }}>{error}</div>}

      {result && (
        <div className="explorer-result">
          <div className="explorer-company-name">{result.employer}</div>
          {result.matchedNames && result.matchedNames.length > 1 && (
            <div className="dim" style={{ fontSize: 11, marginBottom: 10 }}>
              Aggregating {result.matchedNames.length} matching entries:&nbsp;
              {result.matchedNames.slice(0, 5).join(" · ")}
              {result.matchedNames.length > 5 ? ` · +${result.matchedNames.length - 5} more` : ""}
            </div>
          )}

          {/* Summary KPIs */}
          <div className="kpi-grid kpi-grid--compact" style={{ marginBottom: 16 }}>
            {[
              { label: "New H-1B (All Years)",    value: fmt(totalInitial),    color: "#60a5fa" },
              { label: "Extensions (All Years)",   value: fmt(totalContinuing), color: "#a78bfa" },
              { label: "Total Issued (All Years)", value: fmt(totalIssued),     color: "#34d399" },
              { label: "Initial Denials",          value: fmt(totalDenials),    color: "#f87171" },
            ].map(k => (
              <div key={k.label} className="kpi-card kpi-card--sm">
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Year-by-year chart */}
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={result.years} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="fiscalYear" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="initialApprovals"    name="New H-1B"   fill="#60a5fa" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="continuingApprovals" name="Extensions" fill="#a78bfa" radius={[3, 3, 0, 0]} stackId="a" />
              <Line type="monotone" dataKey="initialDenials" name="Denials" stroke="#f87171" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Year-by-year table */}
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>New H-1B</th>
                  <th>Extensions</th>
                  <th>Total Issued</th>
                  <th>Denials</th>
                  <th>Denial Rate</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.years.map(y => (
                  <tr key={y.fiscalYear}>
                    <td className="dim">FY{y.fiscalYear}</td>
                    <td className="num green">{fmt(y.initialApprovals)}</td>
                    <td className="num" style={{ color: "#a78bfa" }}>{fmt(y.continuingApprovals)}</td>
                    <td className="num" style={{ color: "#34d399" }}>{fmt(y.totalIssued)}</td>
                    <td className="num red">{fmt(y.initialDenials)}</td>
                    <td className="dim">{pct(y.denialRate)}</td>
                    <td className="dim" style={{ fontSize: 10 }}>{y.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── All Employers Table ────────────────────────────────────────────────────
function EmployersTable({ year, source }) {
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft]   = useState("");
  const [sort, setSort]     = useState("initial");

  const { data, loading } = useVisaData(
    year || source ? "/h1b/employers" : null,
    { year: year || undefined, source: source || undefined, search, page, limit: 50, sort }
  );

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(draft);
    setPage(1);
  };

  const changeSort = (s) => { setSort(s); setPage(1); };

  return (
    <section className="chart-section">
      <div className="section-label">All Employers — FY{year || "All"}</div>

      <div className="employers-toolbar">
        <form className="explorer-form" onSubmit={handleSearch} style={{ flex: 1 }}>
          <input
            className="explorer-input"
            type="text"
            placeholder="Filter by employer name…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <button className="explorer-btn" type="submit">Filter</button>
          {search && (
            <button className="explorer-btn" type="button" style={{ background: "#334155" }}
              onClick={() => { setDraft(""); setSearch(""); setPage(1); }}>
              Clear
            </button>
          )}
        </form>
        <div className="sort-tabs">
          {[
            { key: "initial",    label: "New H-1B" },
            { key: "continuing", label: "Extensions" },
            { key: "total",      label: "Total" },
            { key: "denials",    label: "Denials" },
          ].map(s => (
            <button
              key={s.key}
              className={`sort-tab${sort === s.key ? " sort-tab--active" : ""}`}
              onClick={() => changeSort(s.key)}
            >
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
                <tr>
                  <th>#</th>
                  <th>Employer</th>
                  <th>State</th>
                  <th>New H-1B</th>
                  <th>Extensions</th>
                  <th>Total Issued</th>
                  <th>Denials</th>
                  <th>Denial %</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((emp, i) => (
                  <tr key={i}>
                    <td className="dim">{(page - 1) * 50 + i + 1}</td>
                    <td>{emp.employer}</td>
                    <td className="dim">{emp.state || "—"}</td>
                    <td className="num green">{fmt(emp.initialApprovals)}</td>
                    <td className="num" style={{ color: "#a78bfa" }}>{fmt(emp.continuingApprovals)}</td>
                    <td className="num" style={{ color: "#34d399" }}>{fmt(emp.totalIssued)}</td>
                    <td className="num red">{fmt(emp.initialDenials)}</td>
                    <td className="dim">{pct(emp.denialRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(1)}>«</button>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="page-info">Page {page} / {data.pages} · {fmt(data.total)} employers</span>
            <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>›</button>
            <button disabled={page >= data.pages} onClick={() => setPage(data.pages)}>»</button>
          </div>
        </>
      )}
      {data && data.data && data.data.length === 0 && (
        <div className="dim" style={{ padding: "12px 0" }}>No employers found.</div>
      )}
    </section>
  );
}

// ─── Main H1bTab ────────────────────────────────────────────────────────────
export default function H1bTab() {
  const [year, setYear]               = useState("2022");
  const [countryYear, setCountryYear] = useState("2023");
  const [showAllEmployers, setShowAllEmployers] = useState(false);

  const source = year && isLcaYear(year) ? "DOL_LCA" : "USCIS_HUB";
  const isAggregateLcaYear = isLcaYear(year);

  const { data: stats }     = useVisaData("/h1b/stats",  { year, source });
  const { data: trends }    = useVisaData("/h1b/trends", { source: "USCIS_HUB" });
  const { data: lcaTrends } = useVisaData("/h1b/trends", { source: "DOL_LCA" });
  const { data: sponsors, loading: spLoading } = useVisaData(
    isAggregateLcaYear ? null : "/h1b/sponsors",
    { year, limit: 20, source }
  );
  const { data: countryData } = useVisaData("/h1b/country-breakdown", { year: countryYear });
  const { data: states }      = useVisaData(
    isAggregateLcaYear ? null : "/h1b/states",
    { year, source }
  );

  // Merge USCIS + LCA trends
  const mergedTrends = React.useMemo(() => {
    const byYear = {};
    (trends || []).forEach(t => { byYear[t.year] = { ...t }; });
    (lcaTrends || []).forEach(t => {
      if (!byYear[t.year]) byYear[t.year] = { year: t.year, initialApprovals: 0, initialDenials: 0, continuingApprovals: 0 };
      byYear[t.year].lcaCertified = t.initialApprovals;
      byYear[t.year].lcaDenied    = t.initialDenials;
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [trends, lcaTrends]);

  // Cumulative active estimate (rough: initial H-1B valid 3yr, continuing valid 3yr)
  const activeEstimate = React.useMemo(() => {
    if (!mergedTrends.length) return [];
    return mergedTrends.map((t, i, arr) => {
      // Active = sum of initial approvals from past 3 years (H-1B max duration) + continuing
      const window = arr.slice(Math.max(0, i - 2), i + 1);
      const activeEstimate = window.reduce((s, w) => s + (w.initialApprovals || 0), 0)
                           + (t.continuingApprovals || 0);
      return { ...t, activeEstimate };
    });
  }, [mergedTrends]);

  const totalIssued = stats
    ? (stats.totalInitialApprovals || 0) + (stats.totalContinuingApprovals || 0)
    : null;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">H-1B Visa Program</h2>
        <div className="filter-row">
          <select className="year-select" value={year} onChange={(e) => { setYear(e.target.value); setShowAllEmployers(false); }}>
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

      {/* ── KPI Cards: segregated Initial / Continuing / Total ── */}
      {stats && (
        <div style={{ marginBottom: 20 }}>
          <div className="kpi-section-title">New H-1B Petitions (Initial)</div>
          <div className="kpi-grid kpi-grid--compact" style={{ marginBottom: 12 }}>
            {[
              { label: "Initial Approvals", value: fmt(stats.totalInitialApprovals), color: "#60a5fa" },
              { label: "Initial Denials",   value: fmt(stats.totalInitialDenials),   color: "#f87171" },
              { label: "Approval Rate",     value: stats.approvalRate ? `${stats.approvalRate.toFixed(1)}%` : "—", color: "#34d399" },
              { label: "RFE Issued",        value: fmt(stats.totalRfeIssued),        color: "#fbbf24" },
            ].map(k => (
              <div key={k.label} className="kpi-card kpi-card--sm">
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="kpi-section-title">Extension / Amendment Petitions (Continuing)</div>
          <div className="kpi-grid kpi-grid--compact" style={{ marginBottom: 12 }}>
            {[
              { label: "Continuing Approvals", value: fmt(stats.totalContinuingApprovals), color: "#a78bfa" },
              { label: "Continuing Denials",   value: fmt(stats.totalContinuingDenials),   color: "#f87171" },
              { label: "Total Issued (Initial + Continuing)", value: fmt(totalIssued), color: "#34d399" },
              { label: "Unique Employers",     value: fmt(stats.uniqueEmployers),           color: "#e2e8f0" },
            ].map(k => (
              <div key={k.label} className="kpi-card kpi-card--sm">
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Merged trend chart ── */}
      {mergedTrends.length > 0 && (
        <section className="chart-section">
          <div className="section-label">
            H-1B Approval Trend (FY2009–FY2026)
            <span className="section-note"> · Initial = new petitions · Continuing = extensions · LCA = DOL certified</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={activeEstimate} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="initialApprovals"    name="New H-1B (USCIS)"   fill="#60a5fa" stackId="issued" radius={[0, 0, 0, 0]} />
              <Bar dataKey="continuingApprovals" name="Extensions (USCIS)"  fill="#a78bfa" stackId="issued" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="lcaCertified" name="LCA Certified (DOL)" stroke="#34d399" dot={false} strokeWidth={2} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="initialDenials" name="Denials (USCIS)" stroke="#f87171" dot={false} strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
            Stacked bars = Total Issued in each year (Initial + Extensions).
            USCIS data FY2009–2023. DOL LCA certified data FY2024–2026.
          </div>
        </section>
      )}

      <div className="two-col">
        {/* ── Top Sponsors / LCA info ── */}
        <section className="chart-section">
          <div className="section-label">
            {isAggregateLcaYear
              ? `H-1B Data for FY${year} (DOL LCA)`
              : `Top 20 H-1B Employers — New Petitions (FY${year || "All"})`}
          </div>
          {isAggregateLcaYear ? (
            <div className="info-panel">
              <div className="info-panel__title">About FY{year} Data</div>
              <div className="info-panel__body">
                Per-employer H-1B data for FY{year} is not yet available as a bulk download from USCIS.
                The statistics above reflect DOL Labor Condition Application (LCA) certifications —
                the mandatory prerequisite employers file before submitting H-1B petitions.
                LCA certifications are a leading indicator of H-1B activity and generally exceed
                final USCIS approval counts.
                <br /><br />
                <strong style={{ color: "#60a5fa" }}>New petitions</strong> = initial H-1B approvals for first-time or cap-subject workers.
                <br />
                <strong style={{ color: "#a78bfa" }}>Extensions</strong> = continuing approvals for existing H-1B holders (cap-exempt).
                <br /><br />
                Source: U.S. Department of Labor, Office of Foreign Labor Certification annual reports.
              </div>
            </div>
          ) : (
            <>
              {spLoading && <div className="dim" style={{ padding: "12px 0" }}>Loading…</div>}
              {sponsors && sponsors.length > 0 && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Employer</th><th>State</th><th>New H-1B</th><th>Extensions</th><th>Denials</th></tr>
                    </thead>
                    <tbody>
                      {sponsors.map((s, i) => (
                        <tr key={i}>
                          <td className="dim">{i + 1}</td>
                          <td>{s.employer}</td>
                          <td className="dim">{s.state || "—"}</td>
                          <td className="num green">{fmt(s.initialApprovals)}</td>
                          <td className="num" style={{ color: "#a78bfa" }}>{fmt(s.continuingApprovals)}</td>
                          <td className="num red">{fmt(s.initialDenials)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {sponsors && sponsors.length === 0 && (
                <div className="dim" style={{ padding: "12px 0" }}>No data for this selection.</div>
              )}
            </>
          )}
        </section>

        {/* ── Country of Birth Breakdown ── */}
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
                    contentStyle={ttStyle}
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
                Total FY{countryYear}: {fmt(countryData.total)} initial approvals.
                Source: {countryData.source}.
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── State Breakdown ── */}
      {!isAggregateLcaYear && states && states.length > 0 && (
        <section className="chart-section">
          <div className="section-label">Approvals by State (FY{year || "All"})</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={states.slice(0, 15)} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="state" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Bar dataKey="initialApprovals" name="New H-1B" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="initialDenials"   name="Denials"  fill="#f87171" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ── Company Explorer ── */}
      <CompanyExplorer />

      {/* ── All Employers Table ── */}
      {!isAggregateLcaYear && (
        <>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <button
              className="explorer-btn"
              style={{ fontSize: 13, padding: "8px 24px" }}
              onClick={() => setShowAllEmployers(v => !v)}
            >
              {showAllEmployers ? "Hide" : "Show"} Full Employer List
            </button>
          </div>
          {showAllEmployers && <EmployersTable year={year} source={isAggregateLcaYear ? "DOL_LCA" : "USCIS_HUB"} />}
        </>
      )}
    </div>
  );
}
