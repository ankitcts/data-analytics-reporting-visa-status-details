/**
 * DOL LCA (Labor Condition Application) Disclosure Data scraper
 * Source: https://www.dol.gov/agencies/eta/foreign-labor/performance
 * Data: Quarterly Excel files, FY2008–present
 *
 * DOL publishes LCA disclosure data as Excel files each quarter.
 * We store the latest 2 quarters on weekly sync; seed script pulls all history.
 */
const axios = require("axios");
const XLSX = require("xlsx");
const H1bRecord = require("../models/H1bRecord");
const DataSyncLog = require("../models/DataSyncLog");

// DOL LCA quarterly disclosure Excel files.
// Filed alphabetically by fiscal year quarter. New quarters added each release.
// URL pattern: https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY{YYYY}_Q{N}.xlsx
const DOL_LCA_FILES = [
  { year: 2026, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2026_Q1.xlsx" },
  { year: 2025, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2025_Q4.xlsx" },
  { year: 2025, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2025_Q3.xlsx" },
  { year: 2025, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2025_Q2.xlsx" },
  { year: 2025, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2025_Q1.xlsx" },
  { year: 2024, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2024_Q4.xlsx" },
  { year: 2024, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2024_Q3.xlsx" },
  { year: 2024, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2024_Q2.xlsx" },
  { year: 2024, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2024_Q1.xlsx" },
  { year: 2023, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2023_Q4.xlsx" },
  { year: 2023, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2023_Q3.xlsx" },
  { year: 2023, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2023_Q2.xlsx" },
  { year: 2023, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2023_Q1.xlsx" },
  { year: 2022, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2022_Q4.xlsx" },
  { year: 2022, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2022_Q3.xlsx" },
  { year: 2022, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2022_Q2.xlsx" },
  { year: 2022, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2022_Q1.xlsx" },
  { year: 2021, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2021_Q4.xlsx" },
  { year: 2021, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2021_Q3.xlsx" },
  { year: 2021, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2021_Q2.xlsx" },
  { year: 2021, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2021_Q1.xlsx" },
  { year: 2020, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2020_Q4.xlsx" },
  { year: 2020, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2020_Q3.xlsx" },
  { year: 2020, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2020_Q2.xlsx" },
  { year: 2020, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2020_Q1.xlsx" },
  { year: 2019, quarter: 4, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2019_Q4.xlsx" },
  { year: 2019, quarter: 3, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2019_Q3.xlsx" },
  { year: 2019, quarter: 2, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2019_Q2.xlsx" },
  { year: 2019, quarter: 1, url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2019_Q1.xlsx" },
];

function parseNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseInt(String(val).replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function normalizeHeader(h) {
  return String(h || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/**
 * Parse DOL LCA Excel file — actual column names (from FY2024 format):
 *   VISA_CLASS, CASE_STATUS, EMPLOYER_NAME, EMPLOYER_STATE,
 *   TOTAL_WORKER_POSITIONS, NAICS_CODE
 * Each row = one LCA case; TOTAL_WORKER_POSITIONS = number of workers.
 * We sum positions by employer per quarter, then aggregate across quarters.
 */
function parseXlsxRows(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (raw.length < 2) return [];

  const headers = raw[0].map(normalizeHeader);
  return raw.slice(1).map((row) =>
    headers.reduce((obj, h, i) => {
      obj[h] = row[i] !== undefined ? String(row[i]).trim() : "";
      return obj;
    }, {})
  );
}

async function runDolLcaScraper({ quartersToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "DOL_LCA", status: "running" });
  let totalInserted = 0;

  const filesToProcess = quartersToFetch
    ? DOL_LCA_FILES.filter((f) => quartersToFetch.some((q) => q.year === f.year && q.quarter === f.quarter))
    : DOL_LCA_FILES.slice(0, 2); // default: latest 2 quarters

  // For annual aggregation: collect all quarters' data then upsert per year
  const annualByEmployer = {}; // key: `${year}|${employer}`

  for (const { year, quarter, url } of filesToProcess) {
    try {
      console.log(`[DOL LCA] Fetching FY${year} Q${quarter}...`);
      const { data } = await axios.get(url, {
        timeout: 300000,
        responseType: "arraybuffer",
        maxContentLength: 300 * 1024 * 1024,
      });

      const rows = parseXlsxRows(Buffer.from(data));

      // Filter to H-1B / H-1B1 visa classes
      const h1bRows = rows.filter((r) =>
        String(r.visa_class || "").toUpperCase().startsWith("H-1B")
      );

      console.log(`[DOL LCA] FY${year} Q${quarter}: ${rows.length} total rows, ${h1bRows.length} H-1B rows`);

      for (const row of h1bRows) {
        const employer = (row.employer_name || "").trim();
        if (!employer) continue;

        const state = (row.employer_state || "").trim();
        const industry = (row.naics_code || "").trim();
        // Each LCA covers TOTAL_WORKER_POSITIONS workers
        const positions = Math.max(1, parseInt(row.total_worker_positions || "1", 10) || 1);
        const status = String(row.case_status || "").toUpperCase();

        const key = `${year}|${employer}`;
        if (!annualByEmployer[key]) {
          annualByEmployer[key] = { year, employer, state, industry, certified: 0, denied: 0, wageLevelCounts: {} };
        }

        const wageLevel = (row.wage_level || row.prevailing_wage_level || "").trim();
        if (wageLevel) {
          annualByEmployer[key].wageLevelCounts[wageLevel] =
            (annualByEmployer[key].wageLevelCounts[wageLevel] || 0) + positions;
        }

        if (status.includes("CERTIFIED") && !status.includes("WITHDRAWN")) {
          annualByEmployer[key].certified += positions;
        } else if (status.includes("DENIED")) {
          annualByEmployer[key].denied += positions;
        }
        // "Certified - Withdrawn" and "Withdrawn" are not counted (LCA was pulled)
      }
    } catch (err) {
      console.error(`[DOL LCA] FY${year} Q${quarter} failed: ${err.message}`);
    }
  }

  // Compute modal wage level for each employer
  for (const rec of Object.values(annualByEmployer)) {
    const counts = rec.wageLevelCounts || {};
    const entries = Object.entries(counts);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const modal = entries[0][0];
      rec.wageLevel = modal;
      // Normalize to code: "Level I" -> "L1", etc.
      const codeMap = { "I": "L1", "II": "L2", "III": "L3", "IV": "L4" };
      const match = modal.match(/\b(I{1,3}V?|IV)\b/);
      rec.wageLevelCode = match ? (codeMap[match[1]] || "") : "";
    } else {
      rec.wageLevel = "";
      rec.wageLevelCode = "";
    }
  }

  // Upsert annual employer records
  const ops = Object.values(annualByEmployer).map((rec) => ({
    updateOne: {
      filter: { fiscalYear: rec.year, employer: rec.employer, source: "DOL_LCA" },
      update: {
        $set: {
          fiscalYear: rec.year,
          employer: rec.employer,
          state: rec.state,
          industry: rec.industry,
          naicsCode: rec.industry,
          country: "",
          initialApprovals: rec.certified,
          initialDenials: rec.denied,
          continuingApprovals: 0,
          continuingDenials: 0,
          rfeIssued: 0,
          rfeDecisionApproved: 0,
          rfeDecisionDenied: 0,
          wageLevel: rec.wageLevel || "",
          wageLevelCode: rec.wageLevelCode || "",
          source: "DOL_LCA",
          importedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    // Process in batches of 1000
    const BATCH = 1000;
    for (let i = 0; i < ops.length; i += BATCH) {
      const result = await H1bRecord.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
      totalInserted += result.upsertedCount + result.modifiedCount;
    }
    console.log(`[DOL LCA] Upserted ${totalInserted} employer records across ${Object.keys(annualByEmployer).length} employers`);
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[DOL LCA] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runDolLcaScraper, DOL_LCA_FILES };
