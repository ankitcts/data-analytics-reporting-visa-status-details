import React, { useState } from "react";
import Dashboard from "./components/Dashboard";
import H1bTab from "./components/H1bTab";
import L1Tab from "./components/L1Tab";
import OptCptTab from "./components/OptCptTab";
import FaqTab from "./components/FaqTab";
import "./styles.css";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "h1b", label: "H-1B" },
  { id: "l1", label: "L-1A / L-1B" },
  { id: "opt", label: "OPT / CPT" },
  { id: "faq", label: "FAQ" },
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
        </div>
      </header>

      <main className="app-main">
        {activeTab === "overview" && <Dashboard />}
        {activeTab === "h1b" && <H1bTab />}
        {activeTab === "l1" && <L1Tab />}
        {activeTab === "opt" && <OptCptTab />}
        {activeTab === "faq" && <FaqTab />}
      </main>

      <footer className="app-footer">
        Data sourced from USCIS H-1B Employer Data Hub, DOL LCA Disclosure Data, and ICE SEVIS. Updated weekly. ·{" "}
        <a href="https://github.com/ankitcts/data-analytics-reporting-visa-status-details" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
