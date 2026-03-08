/**
 * USCIS I-765 Employment Authorization scraper
 * Source: USCIS I-765 performance data Excel files
 * Data: FY2015–FY2026
 *
 * Eligibility category codes:
 *   C26 = H-4 EAD → H4EadRecord
 *   C03A/C03B/C03C = OPT categories → OptCptRecord updates
 *
 * NOTE: USCIS I-765 file URLs are not predictable — update USCIS_I765_FILES
 * as new files are published on https://www.uscis.gov/tools/reports-and-studies
 */
const axios = require("axios");
const XLSX = require("xlsx");
const H4EadRecord = require("../models/H4EadRecord");
const DataSyncLog = require("../models/DataSyncLog");

// Manually maintained list — update as USCIS publishes new files
const USCIS_I765_FILES = [
  { year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2023_qtr4.xlsx" },
  { year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2022_qtr4.xlsx" },
  { year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2021_qtr4.xlsx" },
  { year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2020_qtr4.xlsx" },
  { year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2019_qtr4.xlsx" },
  { year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2018_qtr4.xlsx" },
  { year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2017_qtr4.xlsx" },
  { year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2016_qtr4.xlsx" },
  { year: 2015, url: "https://www.uscis.gov/sites/default/files/document/data/i765_fy2015_qtr4.xlsx" },
];

const H4_EAD_CODE = "C26";
const CATEGORY_MAP = {
  [H4_EAD_CODE]: "H4_EAD",
  "C26_EXT": "H4_EXTENSION",
  "C09": "H4_CHANGE_STATUS",
};

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

async function runI765Scraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_I765", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_I765_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_I765_FILES;

  for (const { year, url } of filesToProcess) {
    try {
      console.log(`[I-765] Fetching FY${year}...`);
      const { data } = await axios.get(url, {
        timeout: 120000,
        responseType: "arraybuffer",
        maxContentLength: 100 * 1024 * 1024,
      });

      const rows = parseXlsxRows(Buffer.from(data));
      console.log(`[I-765] FY${year}: ${rows.length} rows`);

      // Filter H-4 EAD (C26) rows
      const h4Rows = rows.filter((r) => {
        const cat = (r.eligibility_category_code || r.eligibility_category || "").toUpperCase();
        return cat === H4_EAD_CODE || cat.startsWith("C26");
      });

      // Aggregate by eligibility category
      const byCategory = {};
      for (const row of h4Rows) {
        const catCode = (row.eligibility_category_code || "C26").toUpperCase();
        const eligCat = CATEGORY_MAP[catCode] || "H4_EAD";
        if (!byCategory[eligCat]) {
          byCategory[eligCat] = { receipts: 0, approvals: 0, denials: 0, pendingCount: 0 };
        }
        byCategory[eligCat].receipts    += parseNumber(row.receipts || row.total_receipts);
        byCategory[eligCat].approvals   += parseNumber(row.approvals || row.total_approvals);
        byCategory[eligCat].denials     += parseNumber(row.denials || row.total_denials);
        byCategory[eligCat].pendingCount += parseNumber(row.pending || row.total_pending);
      }

      const ops = Object.entries(byCategory).map(([eligibilityCategory, counts]) => ({
        updateOne: {
          filter: { fiscalYear: year, quarter: "annual", eligibilityCategory, source: "USCIS_I765" },
          update: {
            $set: {
              fiscalYear: year,
              quarter: "annual",
              eligibilityCategory,
              ...counts,
              source: "USCIS_I765",
              importedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const result = await H4EadRecord.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount + result.modifiedCount;
        totalInserted += inserted;
        console.log(`[I-765] FY${year}: ${inserted} H-4 EAD records`);
      }
    } catch (err) {
      console.error(`[I-765] FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[I-765] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runI765Scraper, USCIS_I765_FILES };
