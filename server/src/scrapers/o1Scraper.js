/**
 * USCIS O-1 (Extraordinary Ability) scraper
 * Source: USCIS I-129 O-1 performance data CSVs
 * Data: FY2016–FY2026
 *
 * URL pattern: I129_o1{a|b}_performancedata_fy{YYYY}_qtr1.csv
 * Parsing: reuses parseFiscalYearTotals from uscisL1Scraper pattern
 */
const axios = require("axios");
const O1Record = require("../models/O1Record");
const DataSyncLog = require("../models/DataSyncLog");

function parseNumber(val) {
  if (!val) return 0;
  const n = parseInt(String(val).replace(/,/g, "").trim(), 10);
  return isNaN(n) ? 0 : n;
}

const USCIS_O1_FILES = [
  { subType: "O1A", year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2023_qtr1.csv" },
  { subType: "O1A", year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2022_qtr1.csv" },
  { subType: "O1A", year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2021_qtr1.csv" },
  { subType: "O1A", year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2020_qtr1.csv" },
  { subType: "O1A", year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2019_qtr1.csv" },
  { subType: "O1A", year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2018_qtr1.csv" },
  { subType: "O1A", year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2017_qtr1.csv" },
  { subType: "O1A", year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1a_performancedata_fy2016_qtr1.csv" },
  { subType: "O1B", year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2023_qtr1.csv" },
  { subType: "O1B", year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2022_qtr1.csv" },
  { subType: "O1B", year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2021_qtr1.csv" },
  { subType: "O1B", year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2020_qtr1.csv" },
  { subType: "O1B", year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2019_qtr1.csv" },
  { subType: "O1B", year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2018_qtr1.csv" },
  { subType: "O1B", year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2017_qtr1.csv" },
  { subType: "O1B", year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/I129_o1b_performancedata_fy2016_qtr1.csv" },
];

function parseFiscalYearTotals(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const results = [];
  let inFySection = false;

  for (const line of lines) {
    if (line.includes("Fiscal Year - Total")) { inFySection = true; continue; }
    if (line.includes("Fiscal Year 20") && line.includes("Quarter")) { inFySection = false; continue; }
    if (!inFySection) continue;

    const m = line.match(/^"?(\d{4})"?/);
    if (!m) continue;

    const year = parseInt(m[1], 10);
    if (year < 2000 || year > 2030) continue;

    // Columns: Period, Received, Approved, Denied, RFE Issued, Pending
    const parts = (line.match(/"[^"]*"|[^,]+/g) || []).map((p) => p.replace(/^"|"$/g, ""));
    const received = parseNumber(parts[1]);
    const approved = parseNumber(parts[2]);
    const denied   = parseNumber(parts[3]);
    const rfeIssued = parseNumber(parts[4]);
    const pending  = parseNumber(parts[5]);

    if (approved > 0 || denied > 0) {
      results.push({ year, received, approved, denied, rfeIssued, pending });
    }
  }

  return results;
}

async function runO1Scraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_I129_O1", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_O1_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_O1_FILES;

  for (const { subType, year, url } of filesToProcess) {
    try {
      console.log(`[O-1] Fetching ${subType} FY${year}...`);
      const { data } = await axios.get(url, { timeout: 60000, responseType: "text" });

      const rows = parseFiscalYearTotals(data);

      const ops = rows.map(({ year: fy, received, approved, denied, rfeIssued, pending }) => ({
        updateOne: {
          filter: { fiscalYear: fy, subType, employer: "_aggregate_", country: "" },
          update: {
            $set: {
              fiscalYear: fy,
              subType,
              employer: "_aggregate_",
              state: "",
              country: "",
              receipts: received || 0,
              approvals: approved,
              denials: denied,
              rfeIssued: rfeIssued || 0,
              pending: pending || 0,
              source: "USCIS_I129_O1",
              importedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const result = await O1Record.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount + result.modifiedCount;
        totalInserted += inserted;
        console.log(`[O-1] ${subType} FY${year}: ${inserted} annual records`);
      }
    } catch (err) {
      console.error(`[O-1] ${subType} FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[O-1] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runO1Scraper, USCIS_O1_FILES };
