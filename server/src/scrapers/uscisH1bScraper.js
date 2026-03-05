/**
 * USCIS H-1B Employer Data Hub scraper
 * Source: https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub
 * Data: FY2009–present, CSV format, annual
 *
 * CSV columns: Fiscal Year, Employer, Initial Approval, Initial Denial,
 *   Continuing Approval, Continuing Denial, NAICS, Tax ID, State, City, ZIP
 *
 * Each CSV row = one employer at one city/state location.
 * This scraper aggregates all city/state rows per employer before upserting,
 * so each record = true employer-wide totals across all US work locations.
 *
 * NOTE: USCIS bulk CSVs are available for FY2009–FY2023 only.
 * FY2024+ data is available only via USCIS online query tool (not bulk download).
 * For FY2024–FY2026, DOL LCA data is used as a proxy source.
 */
const axios = require("axios");
const H1bRecord = require("../models/H1bRecord");
const DataSyncLog = require("../models/DataSyncLog");

const USCIS_H1B_FILES = [
  { year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2023.csv" },
  { year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2022.csv" },
  { year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2021.csv" },
  { year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2020.csv" },
  { year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2019.csv" },
  { year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2018.csv" },
  { year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2017.csv" },
  { year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2016.csv" },
  { year: 2015, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2015.csv" },
  { year: 2014, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2014.csv" },
  { year: 2013, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2013.csv" },
  { year: 2012, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2012.csv" },
  { year: 2011, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2011.csv" },
  { year: 2010, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2010.csv" },
  { year: 2009, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2009.csv" },
];

function parseNumber(val) {
  if (!val) return 0;
  const n = parseInt(String(val).replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parseCsvRows(text) {
  // Strip BOM if present
  const clean = text.replace(/^\uFEFF/, "").trim();
  const lines = clean.split("\n");
  if (lines.length < 2) return [];

  // Parse header line — handles quoted headers
  const headerLine = lines[0];
  const headers = headerLine
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV values — handle quoted fields containing commas
    const vals = [];
    let inQuote = false;
    let cur = "";
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { vals.push(cur); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur);

    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || "").trim(); });
    rows.push(row);
  }
  return rows;
}

/**
 * Aggregate all per-location rows into one record per employer per year.
 * This ensures the total counts match the USCIS published totals.
 */
function aggregateByEmployer(rows, year) {
  const byEmployer = {};

  for (const row of rows) {
    const employer = row.employer || "";
    if (!employer) continue;

    if (!byEmployer[employer]) {
      byEmployer[employer] = {
        employer,
        industry: row.naics || "",
        // primary state = state of largest location (first occurrence keeps the state)
        state: row.state || "",
        initialApprovals: 0,
        initialDenials: 0,
        continuingApprovals: 0,
        continuingDenials: 0,
        locations: new Set(),
      };
    }

    const e = byEmployer[employer];
    // Handle both old (plural: "Initial Approvals") and new (singular: "Initial Approval") column names
    e.initialApprovals += parseNumber(row.initial_approval || row.initial_approvals);
    e.initialDenials += parseNumber(row.initial_denial || row.initial_denials);
    e.continuingApprovals += parseNumber(row.continuing_approval || row.continuing_approvals);
    e.continuingDenials += parseNumber(row.continuing_denial || row.continuing_denials);
    if (row.state) e.locations.add(row.state);
  }

  return Object.values(byEmployer).map((e) => ({
    ...e,
    statesPresent: [...e.locations].join(","),
    locations: undefined,
  }));
}

async function runUscisH1bScraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_H1B", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_H1B_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_H1B_FILES.slice(0, 2);

  for (const { year, url } of filesToProcess) {
    try {
      console.log(`[USCIS H-1B] Fetching FY${year}...`);
      const { data } = await axios.get(url, { timeout: 60000, responseType: "text" });
      const rows = parseCsvRows(data);
      const employers = aggregateByEmployer(rows, year);

      console.log(`[USCIS H-1B] FY${year}: ${rows.length} location rows → ${employers.length} employers`);

      const ops = employers.map((e) => ({
        updateOne: {
          filter: { fiscalYear: year, employer: e.employer, source: "USCIS_HUB" },
          update: {
            $set: {
              fiscalYear: year,
              employer: e.employer,
              industry: e.industry,
              state: e.state,
              statesPresent: e.statesPresent,
              country: "",
              initialApprovals: e.initialApprovals,
              initialDenials: e.initialDenials,
              continuingApprovals: e.continuingApprovals,
              continuingDenials: e.continuingDenials,
              rfeIssued: 0,
              rfeDecisionApproved: 0,
              rfeDecisionDenied: 0,
              source: "USCIS_HUB",
              importedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const result = await H1bRecord.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount + result.modifiedCount;
        totalInserted += inserted;
        const totalApprovals = employers.reduce((s, e) => s + e.initialApprovals, 0);
        console.log(`[USCIS H-1B] FY${year}: ${inserted} employer records, ${totalApprovals} total initial approvals`);
      }
    } catch (err) {
      console.error(`[USCIS H-1B] FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[USCIS H-1B] Done. Total: ${totalInserted} employer records`);
  return totalInserted;
}

module.exports = { runUscisH1bScraper, USCIS_H1B_FILES };
