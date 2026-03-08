import React, { useState } from "react";
import Dashboard from "./components/Dashboard";
import H1bTab from "./components/H1bTab";
import H4EadTab from "./components/H4EadTab";
import L1Tab from "./components/L1Tab";
import OptCptTab from "./components/OptCptTab";
import EbTab from "./components/EbTab";
import O1Tab from "./components/O1Tab";
import VisitorTab from "./components/VisitorTab";
import ProcessingTimesTab from "./components/ProcessingTimesTab";
import CompanyExplorerTab from "./components/CompanyExplorerTab";
import FaqTab from "./components/FaqTab";
import "./styles.css";

const TABS = [
  { id: "overview",    label: "Overview" },
  { id: "h1b",         label: "H-1B" },
  { id: "h4ead",       label: "H-4 / EAD" },
  { id: "l1",          label: "L-1A / L-1B" },
  { id: "opt",         label: "OPT / F-1" },
  { id: "eb",          label: "EB Green Cards" },
  { id: "o1",          label: "O-1" },
  { id: "visitor",     label: "Visitor Visas" },
  { id: "processing",  label: "Processing Times" },
  { id: "company",     label: "Company Explorer" },
  { id: "faq",         label: "FAQ" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <span className="app-header__icon">🇺🇸</span>
            <div>
              <div className="app-header__title">US Visa Analytics</div>
              <div className="app-header__sub">Official government data · Auto-refreshed weekly</div>
            </div>
          </div>
          <nav className="app-nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`app-nav__tab${activeTab === t.id ? " app-nav__tab--active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {/* Mobile nav */}
          <select
            className="app-nav-mobile"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
          >
            {TABS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="app-main">
        {activeTab === "overview"    && <Dashboard />}
        {activeTab === "h1b"         && <H1bTab />}
        {activeTab === "h4ead"       && <H4EadTab />}
        {activeTab === "l1"          && <L1Tab />}
        {activeTab === "opt"         && <OptCptTab />}
        {activeTab === "eb"          && <EbTab />}
        {activeTab === "o1"          && <O1Tab />}
        {activeTab === "visitor"     && <VisitorTab />}
        {activeTab === "processing"  && <ProcessingTimesTab />}
        {activeTab === "company"     && <CompanyExplorerTab />}
        {activeTab === "faq"         && <FaqTab />}
      </main>

      <footer className="app-footer">
        Data sourced from USCIS, DOL, ICE SEVIS, and State Department. Updated weekly. ·{" "}
        <a href="https://github.com/ankitcts/data-analytics-reporting-visa-status-details" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
