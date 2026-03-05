import React, { useState } from "react";
import { useVisaData } from "../hooks/useVisaData";

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`accordion-item${open ? " accordion-item--open" : ""}`}>
      <button className="accordion-q" onClick={() => setOpen(!open)}>
        <span>{q}</span>
        <span className="accordion-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="accordion-a">{a}</div>}
    </div>
  );
}

const SECTIONS = [
  { key: "h1b", label: "H-1B Visa" },
  { key: "l1", label: "L-1A / L-1B Visa" },
  { key: "opt", label: "OPT / CPT" },
];

export default function FaqTab() {
  const { data: allFaqs } = useVisaData("/faq");

  return (
    <div className="tab-content">
      <div className="tab-header">
        <h2 className="tab-title">Frequently Asked Questions</h2>
      </div>

      <p className="faq-intro">
        Plain-English answers to common questions about US work and student visa programs.
        All data on this site comes from official USCIS, DOL, and ICE SEVIS sources.
      </p>

      {SECTIONS.map(({ key, label }) => (
        <section key={key} className="faq-section">
          <div className="section-label">{label}</div>
          {allFaqs?.[key]?.map((item, i) => (
            <AccordionItem key={i} q={item.q} a={item.a} />
          )) ?? <div className="loading">Loading…</div>}
        </section>
      ))}
    </div>
  );
}
