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

function findField(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }
  return "";
}

async function runDolLcaScraper({ quartersToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "DOL_LCA", status: "running" });
  let totalInserted = 0;

  const filesToProcess = quartersToFetch
    ? DOL_LCA_FILES.filter((f) => quartersToFetch.some((q) => q.year === f.year && q.quarter === f.quarter))
    : DOL_LCA_FILES.slice(0, 2); // default: latest 2 quarters

  for (const { year, quarter, url } of filesToProcess) {
    try {
      console.log(`[DOL LCA] Fetching FY${year} Q${quarter}...`);
      const { data } = await axios.get(url, {
        timeout: 120000,
        responseType: "arraybuffer",
      });

      const rows = parseXlsxRows(Buffer.from(data));
      // DOL LCA files include all visa types; filter to H-1B only
      const h1bRows = rows.filter((r) => {
        const visaClass = findField(r, "visa_class", "visa_type", "case_status");
        return String(visaClass).toUpperCase().includes("H-1B");
      });

      // Aggregate by employer + state + country for this quarter
      const aggregated = {};
      for (const row of h1bRows) {
        const employer = findField(row, "employer_name", "employer", "company_name");
        const state = findField(row, "employer_state", "work_state", "state");
        const country = findField(row, "country_of_citizenship", "country", "worker_country");
        const status = findField(row, "case_status", "status");
        const key = `${year}|${employer}|${state}|${country}`;

        if (!aggregated[key]) {
          aggregated[key] = { employer, state, country, initialApprovals: 0, initialDenials: 0 };
        }
        if (String(status).toUpperCase().includes("CERTIF")) {
          aggregated[key].initialApprovals += 1;
        } else if (String(status).toUpperCase().includes("DENIED") || String(status).toUpperCase().includes("WITHDRAW")) {
          aggregated[key].initialDenials += 1;
        }
      }

      const ops = Object.values(aggregated).map((rec) => ({
        updateOne: {
          filter: { fiscalYear: year, employer: rec.employer, country: rec.country, source: "DOL_LCA" },
          update: {
            $set: {
              fiscalYear: year,
              employer: rec.employer,
              state: rec.state,
              country: rec.country,
              initialApprovals: rec.initialApprovals,
              initialDenials: rec.initialDenials,
              source: "DOL_LCA",
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
        console.log(`[DOL LCA] FY${year} Q${quarter}: ${inserted} employer records upserted`);
      }
    } catch (err) {
      console.error(`[DOL LCA] FY${year} Q${quarter} failed: ${err.message}`);
    }
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
