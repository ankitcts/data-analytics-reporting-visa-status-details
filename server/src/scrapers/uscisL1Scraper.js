/**
 * USCIS L-1 (Intracompany Transferee) scraper
 * Source: https://www.uscis.gov/tools/reports-and-studies/immigration-forms-data/nonimmigrant
 * Data: USCIS I-129 quarterly CSV files, FY2016–present
 *
 * USCIS publishes separate CSVs for L-1A (managers/executives) and L-1B (specialized knowledge).
 * Each file contains annual totals plus quarterly breakdowns.
 * URL format: I129_l1{a|b}_performancedata_fy{YYYY}_qtr{1-4}.csv
 */
const axios = require("axios");
const L1Record = require("../models/L1Record");
const DataSyncLog = require("../models/DataSyncLog");

function parseNumber(val) {
  if (!val) return 0;
  const n = parseInt(String(val).replace(/,/g, "").trim(), 10);
  return isNaN(n) ? 0 : n;
}

// USCIS publishes one cumulative file per fiscal year quarter (Q1 has FY totals up to that quarter).
// We use Q1 of the latest available fiscal year (updated data up to Dec 31 of prior year).
const USCIS_L1_FILES = [
  { visaType: "L1A", year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2023_qtr1.csv" },
  { visaType: "L1A", year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2022_qtr1.csv" },
  { visaType: "L1A", year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2021_qtr1.csv" },
  { visaType: "L1A", year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2020_qtr1.csv" },
  { visaType: "L1A", year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2019_qtr1.csv" },
  { visaType: "L1A", year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2018_qtr1.csv" },
  { visaType: "L1A", year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2017_qtr1.csv" },
  { visaType: "L1A", year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1a_performancedata_fy2016_qtr1.csv" },
  { visaType: "L1B", year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2023_qtr1.csv" },
  { visaType: "L1B", year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2022_qtr1.csv" },
  { visaType: "L1B", year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2021_qtr1.csv" },
  { visaType: "L1B", year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2020_qtr1.csv" },
  { visaType: "L1B", year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2019_qtr1.csv" },
  { visaType: "L1B", year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2018_qtr1.csv" },
  { visaType: "L1B", year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2017_qtr1.csv" },
  { visaType: "L1B", year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/I129_l1b_performancedata_fy2016_qtr1.csv" },
];

/**
 * Parse the USCIS L-1 aggregate CSV.
 * Format: multi-section CSV with "Fiscal Year - Total" section and annual rows like:
 *   2022,"14,082","13,096","3,191","3,767",,,,,,
 * Columns: Period, Petitions Received, Approved, Denied, Pending
 *
 * Returns array of { year, approved, denied } for all fiscal year total rows.
 */
function parseFiscalYearTotals(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  let inFySection = false;

  for (const line of lines) {
    if (line.includes("Fiscal Year - Total")) { inFySection = true; continue; }
    if (line.includes("Fiscal Year 20") && line.includes("Quarter")) { inFySection = false; continue; }
    if (!inFySection) continue;

    // Match rows starting with a 4-digit year
    const m = line.match(/^"?(\d{4})"?/);
    if (!m) continue;

    const year = parseInt(m[1], 10);
    if (year < 2000 || year > 2030) continue;

    // Split on comma, handle quoted numbers like "13,418", strip surrounding quotes
    // Columns: Period, Received, Approved, Denied, Pending
    const parts = (line.match(/"[^"]*"|[^,]+/g) || []).map((p) => p.replace(/^"|"$/g, ""));
    const received = parseNumber(parts[1]);
    const approved = parseNumber(parts[2]);
    const denied = parseNumber(parts[3]);
    const pending = parseNumber(parts[4]);
    if (approved > 0 || denied > 0) {
      results.push({ year, received, approved, denied, pending });
    }
  }

  return results;
}

async function runUscisL1Scraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_L1", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_L1_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_L1_FILES.slice(0, 2);

  for (const { visaType, year, url } of filesToProcess) {
    try {
      console.log(`[USCIS L1] Fetching ${visaType} FY${year}...`);
      const { data } = await axios.get(url, { timeout: 60000, responseType: "text" });

      const rows = parseFiscalYearTotals(data);

      const ops = rows.map(({ year: fy, approved, denied, received, pending }) => ({
        updateOne: {
          filter: { fiscalYear: fy, visaType, employer: "_aggregate_", country: "" },
          update: {
            $set: {
              fiscalYear: fy,
              visaType,
              employer: "_aggregate_",
              state: "",
              country: "",
              approvals: approved,
              denials: denied,
              receipts: received || 0,
              pending: pending || 0,
              source: "USCIS_I129",
              importedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const result = await L1Record.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount + result.modifiedCount;
        totalInserted += inserted;
        console.log(`[USCIS L1] ${visaType} FY${year}: ${inserted} annual records upserted`);
      }
    } catch (err) {
      console.error(`[USCIS L1] ${visaType} FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[USCIS L1] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runUscisL1Scraper, USCIS_L1_FILES };
