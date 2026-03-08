import React, { useState, useCallback, useRef, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

function VBadge({ type }) {
  return <span className={`visa-badge visa-badge--${type.toLowerCase()}`}>{type}</span>;
}

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="accordion-header" onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} {title}
      </div>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}

export default function CompanyExplorerTab() {
  const [query, setQuery]       = useState("");
  const [suggestions, setSuggs] = useState([]);
  const [showSuggs, setShowSuggs] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const suggestTimer            = useRef(null);

  const fetchSuggestions = useCallback((q) => {
    clearTimeout(suggestTimer.current);
    if (q.trim().length < 2) { setSuggs([]); setShowSuggs(false); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/company/search/employers?q=${encodeURIComponent(q.trim())}&limit=10`);
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
      const r = await fetch(`/api/company/${encodeURIComponent(name.trim())}/summary`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setResult(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e) => { e.preventDefault(); lookup(query); };
  const pickSuggestion = (item) => {
    const name = typeof item === "string" ? item : item.name;
    setQuery(name);
    setShowSuggs(false);
    lookup(name);
  };

  // Build combined annual chart from summary data
  const combinedChart = useMemo(() => {
    if (!result) return [];
    const byYear = {};

    (result.h1b || []).forEach((r) => {
      if (!byYear[r.fiscalYear]) byYear[r.fiscalYear] = { year: r.fiscalYear };
      byYear[r.fiscalYear].h1bApprovals = (byYear[r.fiscalYear].h1bApprovals || 0) + (r.initialApprovals || 0);
    });
    (result.l1 || []).forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year].l1Approvals = (byYear[r.year].l1Approvals || 0) + (r.approvals || 0);
    });
    (result.perm || []).forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year].permCertified = (byYear[r.year].permCertified || 0) + (r.certified || 0);
    });
    (result.eb || []).forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year].ebApprovals = (byYear[r.year].ebApprovals || 0) + (r.approvals || 0);
    });

    return Object.values(byYear).sort((a, b) => a.year - b.year);
  }, [result]);

  // KPI totals
  const totals = useMemo(() => {
    if (!result) return {};
    return {
      h1b: (result.h1b || []).reduce((s, r) => s + (r.initialApprovals || 0), 0),
      l1: (result.l1 || []).reduce((s, r) => s + (r.approvals || 0), 0),
      perm: (result.perm || []).reduce((s, r) => s + (r.certified || 0), 0),
      eb: (result.eb || []).reduce((s, r) => s + (r.approvals || 0), 0),
      o1: (result.o1 || []).reduce((s, r) => s + (r.approvals || 0), 0),
    };
  }, [result]);

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">Company Explorer</h2>
      </div>

      <p className="dim" style={{ fontSize: 12, marginBottom: 12 }}>
        Search any employer to see their full visa portfolio across H-1B, L-1, PERM, EB, and O-1 programs.
      </p>

      <div className="explorer-wrap">
        <form className="explorer-form" onSubmit={handleSubmit}>
          <div className="explorer-input-wrap">
            <input
              className="explorer-input"
              type="text"
              placeholder="e.g. INFOSYS, GOOGLE, AMAZON, MICROSOFT…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
              onBlur={() => setTimeout(() => setShowSuggs(false), 200)}
              onFocus={() => suggestions.length > 0 && setShowSuggs(true)}
              autoComplete="off"
            />
            {showSuggs && suggestions.length > 0 && (
              <ul className="suggest-list">
                {suggestions.map((s, i) => {
                  const name = typeof s === "string" ? s : s.name;
                  const types = typeof s === "object" ? (s.visaTypes || []) : [];
                  return (
                    <li key={i} className="suggest-item" onMouseDown={() => pickSuggestion(s)}>
                      {name}
                      {types.map((t) => <VBadge key={t} type={t} />)}
                    </li>
                  );
                })}
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

          {/* Visa type badges */}
          <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {result.crossVisaLinks?.hasPermData && <VBadge type="PERM" />}
            {result.crossVisaLinks?.hasEbData && <VBadge type="EB" />}
            {result.crossVisaLinks?.hasL1Data && <VBadge type="L1" />}
            {result.crossVisaLinks?.hasO1Data && <VBadge type="O1" />}
            {(result.h1b || []).length > 0 && <VBadge type="H1B" />}
          </div>

          {/* Summary KPIs */}
          <div className="kpi-grid kpi-grid--compact" style={{ marginBottom: 16 }}>
            {[
              { label: "H-1B Approvals (All Years)", value: fmt(totals.h1b), color: "#1d4ed8" },
              { label: "L-1 Approvals (All Years)",  value: fmt(totals.l1),  color: "#065f46" },
              { label: "PERM Certified (All Years)",  value: fmt(totals.perm), color: "#7c3aed" },
              { label: "EB Approvals (All Years)",    value: fmt(totals.eb),  color: "#b45309" },
              { label: "O-1 Approvals (All Years)",   value: fmt(totals.o1),  color: "#be185d" },
            ].map((k) => (
              <div key={k.label} className="kpi-card kpi-card--sm">
                <div className="kpi-card__label">{k.label}</div>
                <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Combined annual chart */}
          {combinedChart.length > 0 && (
            <section className="chart-section">
              <div className="section-label">Multi-Visa Annual Portfolio</div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={combinedChart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                  <Bar dataKey="h1bApprovals" name="H-1B" fill="#1d4ed8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="l1Approvals"  name="L-1"  fill="#065f46" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="permCertified" name="PERM" fill="#7c3aed" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="ebApprovals" name="EB" stroke="#b45309" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Accordion sections */}
          {(result.h1b || []).length > 0 && (
            <Accordion title={`H-1B History (${result.h1b.length} years)`} defaultOpen>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Year</th><th>New H-1B</th><th>Extensions</th><th>Denials</th><th>Source</th></tr></thead>
                  <tbody>
                    {result.h1b.map((r) => (
                      <tr key={r.fiscalYear}>
                        <td className="dim">FY{r.fiscalYear}</td>
                        <td className="num green">{fmt(r.initialApprovals)}</td>
                        <td className="num" style={{ color: "#a78bfa" }}>{fmt(r.continuingApprovals)}</td>
                        <td className="num red">{fmt(r.initialDenials)}</td>
                        <td className="dim" style={{ fontSize: 10 }}>{r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          )}

          {(result.l1 || []).length > 0 && (
            <Accordion title={`L-1 History (${result.l1.length} entries)`}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Year</th><th>Type</th><th>Approvals</th><th>Denials</th></tr></thead>
                  <tbody>
                    {result.l1.map((r, i) => (
                      <tr key={i}>
                        <td className="dim">FY{r.year}</td>
                        <td>{r.visaType}</td>
                        <td className="num green">{fmt(r.approvals)}</td>
                        <td className="num red">{fmt(r.denials)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          )}

          {(result.perm || []).length > 0 && (
            <Accordion title={`PERM History (${result.perm.length} years)`}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Year</th><th>Certified</th><th>Denied</th><th>Total Cases</th></tr></thead>
                  <tbody>
                    {result.perm.map((r) => (
                      <tr key={r.year}>
                        <td className="dim">FY{r.year}</td>
                        <td className="num green">{fmt(r.certified)}</td>
                        <td className="num red">{fmt(r.denied)}</td>
                        <td className="num">{fmt(r.totalCases)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          )}

          {(result.eb || []).length > 0 && (
            <Accordion title={`EB Green Card History (${result.eb.length} entries)`}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Year</th><th>Category</th><th>Approvals</th><th>Denials</th></tr></thead>
                  <tbody>
                    {result.eb.map((r, i) => (
                      <tr key={i}>
                        <td className="dim">FY{r.year}</td>
                        <td>{r.ebCategory}</td>
                        <td className="num green">{fmt(r.approvals)}</td>
                        <td className="num red">{fmt(r.denials)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          )}

          {(result.o1 || []).length > 0 && (
            <Accordion title={`O-1 History (${result.o1.length} entries)`}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Year</th><th>Type</th><th>Approvals</th><th>Denials</th></tr></thead>
                  <tbody>
                    {result.o1.map((r, i) => (
                      <tr key={i}>
                        <td className="dim">FY{r.year}</td>
                        <td>{r.subType}</td>
                        <td className="num green">{fmt(r.approvals)}</td>
                        <td className="num red">{fmt(r.denials)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
}
