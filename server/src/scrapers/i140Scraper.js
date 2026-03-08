/**
 * USCIS I-140 (Immigrant Petition for Alien Workers) scraper
 * Source: USCIS I-140 performance data Excel/CSV files
 * Data: FY2009–FY2026
 *
 * Maps preference category strings to EbRecord.ebCategory enum values.
 * Published data is aggregate (no per-employer breakdown) — employer="_aggregate_".
 */
const axios = require("axios");
const XLSX = require("xlsx");
const EbRecord = require("../models/EbRecord");
const DataSyncLog = require("../models/DataSyncLog");

const USCIS_I140_FILES = [
  { year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2023_qtr4.xlsx" },
  { year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2022_qtr4.xlsx" },
  { year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2021_qtr4.xlsx" },
  { year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2020_qtr4.xlsx" },
  { year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2019_qtr4.xlsx" },
  { year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2018_qtr4.xlsx" },
  { year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2017_qtr4.xlsx" },
  { year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2016_qtr4.xlsx" },
  { year: 2015, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2015_qtr4.xlsx" },
  { year: 2014, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2014_qtr4.xlsx" },
  { year: 2013, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2013_qtr4.xlsx" },
  { year: 2012, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2012_qtr4.xlsx" },
  { year: 2011, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2011_qtr4.xlsx" },
  { year: 2010, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2010_qtr4.xlsx" },
  { year: 2009, url: "https://www.uscis.gov/sites/default/files/document/data/I140_performancedata_fy2009_qtr4.xlsx" },
];

// Map preference category strings from USCIS data to our enum
const EB_CATEGORY_MAP = {
  "1ST": "EB1",   "EB-1": "EB1",   "EB1": "EB1",
  "1A": "EB1A",   "EB-1A": "EB1A",
  "1B": "EB1B",   "EB-1B": "EB1B",
  "1C": "EB1C",   "EB-1C": "EB1C",
  "2ND": "EB2",   "EB-2": "EB2",   "EB2": "EB2",
  "NIW": "EB2NIW","EB-2NIW": "EB2NIW", "2NIW": "EB2NIW",
  "3RD": "EB3",   "EB-3": "EB3",   "EB3": "EB3",
  "3W": "EB3W",   "EB-3W": "EB3W", "3RD WORKERS": "EB3W",
  "4TH": "EB4",   "EB-4": "EB4",   "EB4": "EB4",
  "5TH": "EB5",   "EB-5": "EB5",   "EB5": "EB5",
};

function mapEbCategory(raw) {
  const key = String(raw || "").toUpperCase().trim().replace(/\s+/g, " ");
  if (EB_CATEGORY_MAP[key]) return EB_CATEGORY_MAP[key];
  // Try partial matches
  for (const [pattern, cat] of Object.entries(EB_CATEGORY_MAP)) {
    if (key.includes(pattern)) return cat;
  }
  return null;
}

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

async function runI140Scraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_I140", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_I140_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_I140_FILES;

  for (const { year, url } of filesToProcess) {
    try {
      console.log(`[I-140] Fetching FY${year}...`);
      const { data } = await axios.get(url, {
        timeout: 120000,
        responseType: "arraybuffer",
        maxContentLength: 100 * 1024 * 1024,
      });

      const rows = parseXlsxRows(Buffer.from(data));
      console.log(`[I-140] FY${year}: ${rows.length} rows`);

      // Aggregate by ebCategory + country
      const byKey = {};
      for (const row of rows) {
        const rawCat = row.preference_category || row.classification || row.eb_category || "";
        const ebCategory = mapEbCategory(rawCat);
        if (!ebCategory) continue;

        const country = (row.country_of_birth || row.country || "").trim();
        const key = `${ebCategory}|${country}`;
        if (!byKey[key]) {
          byKey[key] = { ebCategory, country, receipts: 0, approvals: 0, denials: 0, pendingCount: 0 };
        }
        byKey[key].receipts    += parseNumber(row.receipts || row.total_receipts);
        byKey[key].approvals   += parseNumber(row.approvals || row.approved || row.total_approvals);
        byKey[key].denials     += parseNumber(row.denials || row.denied || row.total_denials);
        byKey[key].pendingCount += parseNumber(row.pending || row.total_pending);
      }

      const ops = Object.values(byKey).map((rec) => ({
        updateOne: {
          filter: {
            fiscalYear: year,
            ebCategory: rec.ebCategory,
            employer: "_aggregate_",
            country: rec.country,
            source: "USCIS_I140",
          },
          update: {
            $set: {
              fiscalYear: year,
              ebCategory: rec.ebCategory,
              employer: "_aggregate_",
              country: rec.country,
              receipts: rec.receipts,
              approvals: rec.approvals,
              denials: rec.denials,
              pendingCount: rec.pendingCount,
              source: "USCIS_I140",
              importedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const BATCH = 1000;
        for (let i = 0; i < ops.length; i += BATCH) {
          const result = await EbRecord.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
          totalInserted += result.upsertedCount + result.modifiedCount;
        }
        console.log(`[I-140] FY${year}: ${ops.length} category+country records`);
      }
    } catch (err) {
      console.error(`[I-140] FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[I-140] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runI140Scraper, USCIS_I140_FILES };
