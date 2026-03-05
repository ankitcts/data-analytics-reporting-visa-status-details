/**
 * USCIS L-1 (Intracompany Transferee) scraper
 * Source: https://www.uscis.gov/tools/reports-and-studies/immigration-forms-data/nonimmigrant
 * Data: USCIS I-129 annual form data Excel files, FY2010–present
 *
 * USCIS publishes I-129 petition data by visa type. L-1A and L-1B approval/denial
 * counts are available in the "Nonimmigrant" section of the Immigration Forms Data page.
 */
const axios = require("axios");
const XLSX = require("xlsx");
const L1Record = require("../models/L1Record");
const DataSyncLog = require("../models/DataSyncLog");

// USCIS I-129 data files for L-1 petitions.
// Each file covers a fiscal year and includes both L-1A and L-1B breakdowns.
const USCIS_L1_FILES = [
  { year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2023_qtr4.xlsx" },
  { year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2022_qtr4.xlsx" },
  { year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2021_qtr4.xlsx" },
  { year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2020_qtr4.xlsx" },
  { year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2019_qtr4.xlsx" },
  { year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2018_qtr4.xlsx" },
  { year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2017_qtr4.xlsx" },
  { year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2016_qtr4.xlsx" },
  { year: 2015, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2015_qtr4.xlsx" },
  { year: 2014, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2014_qtr4.xlsx" },
  { year: 2013, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2013_qtr4.xlsx" },
  { year: 2012, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2012_qtr4.xlsx" },
  { year: 2011, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2011_qtr4.xlsx" },
  { year: 2010, url: "https://www.uscis.gov/sites/default/files/document/data/I129_performancedata_fy2010_qtr4.xlsx" },
];

function normalizeHeader(h) {
  return String(h || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function parseNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseInt(String(val).replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parseXlsxRows(buffer, sheetName = null) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const targetSheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];
  if (!targetSheet) return [];
  const raw = XLSX.utils.sheet_to_json(targetSheet, { header: 1 });
  if (raw.length < 2) return [];
  const headers = raw[0].map(normalizeHeader);
  return raw.slice(1).map((row) =>
    headers.reduce((obj, h, i) => {
      obj[h] = row[i] !== undefined ? String(row[i]).trim() : "";
      return obj;
    }, {})
  );
}

function findField(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }
  return "";
}

function detectVisaType(row) {
  const category = findField(row, "nonimmigrant_classification", "classification", "visa_type", "category");
  const cat = String(category).toUpperCase();
  if (cat.includes("L-1A") || cat.includes("L1A")) return "L1A";
  if (cat.includes("L-1B") || cat.includes("L1B")) return "L1B";
  if (cat.includes("L-1") || cat.includes("L1")) return "L1";
  return null;
}

async function runUscisL1Scraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_L1", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_L1_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_L1_FILES.slice(0, 2); // default: latest 2 years

  for (const { year, url } of filesToProcess) {
    try {
      console.log(`[USCIS L1] Fetching FY${year}...`);
      const { data } = await axios.get(url, {
        timeout: 120000,
        responseType: "arraybuffer",
      });

      const rows = parseXlsxRows(Buffer.from(data));
      const l1Rows = rows.filter((r) => detectVisaType(r) !== null);

      const ops = l1Rows.map((row) => {
        const visaType = detectVisaType(row);
        const employer = findField(row, "petitioner_name", "employer_name", "employer", "company");
        const state = findField(row, "petitioner_state", "employer_state", "state");
        const country = findField(row, "country_of_birth", "country_of_citizenship", "country");
        const approvals = parseNumber(findField(row, "approvals", "total_approvals", "approved"));
        const denials = parseNumber(findField(row, "denials", "total_denials", "denied"));

        return {
          updateOne: {
            filter: { fiscalYear: year, visaType, employer, country },
            update: {
              $set: {
                fiscalYear: year,
                visaType,
                employer,
                state,
                country,
                approvals,
                denials,
                source: "USCIS_I129",
                importedAt: new Date(),
              },
            },
            upsert: true,
          },
        };
      });

      if (ops.length > 0) {
        const result = await L1Record.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount + result.modifiedCount;
        totalInserted += inserted;
        console.log(`[USCIS L1] FY${year}: ${inserted} records upserted`);
      }
    } catch (err) {
      console.error(`[USCIS L1] FY${year} failed: ${err.message}`);
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
