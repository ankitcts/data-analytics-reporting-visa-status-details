import React, { useMemo } from "react";
import { useVisaData } from "../hooks/useVisaData";
import { ComposedChart, Bar, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function fmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ttStyle = { background: "#1e2130", border: "1px solid #334155", borderRadius: 8 };

export default function PipelineView({ mini = false }) {
  const { data: f1ToH1b } = useVisaData("/pipeline/f1-to-h1b", { fromYear: 2008, toYear: 2026 });
  const { data: h1bToGc } = useVisaData("/pipeline/h1b-to-green-card", { fromYear: 2009, toYear: 2026 });

  const height = mini ? 180 : 280;

  return (
    <div>
      {f1ToH1b && f1ToH1b.length > 0 && (
        <section className="pipeline-section">
          <div className="section-label">
            F-1 Student → OPT → H-1B Pipeline
            {!mini && <span className="section-note"> · Shows the student-to-worker pathway</span>}
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={f1ToH1b} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="studGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Area type="monotone" dataKey="activeStudents" name="F-1 Active Students" fill="url(#studGrad)" stroke="#60a5fa" strokeWidth={1.5} />
              <Line type="monotone" dataKey="optCount" name="OPT Workers" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="stemOptCount" name="STEM OPT" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Bar dataKey="h1bInitialApprovals" name="H-1B Initial Approvals" fill="#a78bfa" radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      )}

      {h1bToGc && h1bToGc.length > 0 && (
        <section className="pipeline-section">
          <div className="section-label">
            H-1B → PERM → Green Card (EB) Pipeline
            {!mini && <span className="section-note"> · Typical lag: 2–5 years from H-1B to green card</span>}
          </div>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={h1bToGc} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip contentStyle={ttStyle} formatter={(v) => [fmt(v)]} />
              <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
              <Bar dataKey="h1bApprovals" name="H-1B Approvals" fill="#60a5fa" radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="permCertified" name="PERM Certified" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ebApprovals" name="EB Approvals" stroke="#fbbf24" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
          {!mini && (
            <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
              PERM certified in year N typically leads to EB approval 2–10+ years later (country-dependent).
              India/China nationals may wait decades due to per-country visa caps.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
