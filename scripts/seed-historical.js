#!/usr/bin/env node
/**
 * One-time historical seed script.
 * Imports all available historical data from USCIS, DOL, and ICE SEVIS.
 *
 * Usage:
 *   MONGODB_URI=mongodb+srv://... node scripts/seed-historical.js
 *   MONGODB_URI=... node scripts/seed-historical.js --only h1b
 *   MONGODB_URI=... node scripts/seed-historical.js --only l1,sevis
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { connectDatabase } = require("../server/src/db");
const { runUscisH1bScraper, USCIS_H1B_FILES } = require("../server/src/scrapers/uscisH1bScraper");
const { runDolLcaScraper, DOL_LCA_FILES } = require("../server/src/scrapers/dolLcaScraper");
const { runUscisL1Scraper, USCIS_L1_FILES } = require("../server/src/scrapers/uscisL1Scraper");
const { runSevisScraper, SEVIS_FILES } = require("../server/src/scrapers/sevisScraper");

const args = process.argv.slice(2);
const onlyIdx = args.indexOf("--only");
const only = onlyIdx !== -1 ? args[onlyIdx + 1].split(",") : null;

function shouldRun(name) {
  return !only || only.includes(name);
}

async function main() {
  console.log("=== Historical Seed Script ===");
  await connectDatabase();

  // H-1B: all years FY2009–FY2024
  if (shouldRun("h1b")) {
    console.log("\n[1/4] USCIS H-1B — all years");
    const years = USCIS_H1B_FILES.map((f) => f.year);
    await runUscisH1bScraper({ yearsToFetch: years });
  }

  // DOL LCA: all quarters FY2019–FY2024
  if (shouldRun("lca") || shouldRun("dol")) {
    console.log("\n[2/4] DOL LCA — all quarters");
    const quarters = DOL_LCA_FILES.map((f) => ({ year: f.year, quarter: f.quarter }));
    await runDolLcaScraper({ quartersToFetch: quarters });
  }

  // USCIS L-1: all years FY2010–FY2023
  if (shouldRun("l1")) {
    console.log("\n[3/4] USCIS L-1 — all years");
    const years = USCIS_L1_FILES.map((f) => f.year);
    await runUscisL1Scraper({ yearsToFetch: years });
  }

  // SEVIS OPT/CPT: all quarters
  if (shouldRun("sevis") || shouldRun("opt")) {
    console.log("\n[4/4] ICE SEVIS OPT/CPT — all quarters");
    const quarters = SEVIS_FILES.map((f) => f.label);
    await runSevisScraper({ quartersToFetch: quarters });
  }

  console.log("\n=== Seed complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
