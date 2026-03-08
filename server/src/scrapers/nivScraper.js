/**
 * State Department NIV (Non-Immigrant Visa) issuance scraper
 * Source: travel.state.gov NIV detail tables
 * Data: FY2000–FY2026, Excel files
 *
 * Filters to B-1, B-2, B1/B2 visa classes.
 * For FY2000-2020: aggregate at country+year level (month=0).
 * For FY2021+: store per-month records.
 */
const axios = require("axios");
const XLSX = require("xlsx");
const VisitorVisaRecord = require("../models/VisitorVisaRecord");
const DataSyncLog = require("../models/DataSyncLog");

// State Dept NIV detail table URLs
// Pattern: https://travel.state.gov/.../FY{YYYY}NIVDetailTable.xlsx
// Note: URLs may change; update as needed
function buildNivUrl(year) {
  return `https://travel.state.gov/content/dam/visas/Statistics/Non-Immigrant-Statistics/NIVDetailTables/FY${year}NIVDetailTable.xlsx`;
}

const NIV_YEARS = [];
for (let y = 2000; y <= 2026; y++) NIV_YEARS.push(y);

const B_CLASSES = new Set(["B1", "B2", "B-1", "B-2", "B1/B2", "B-1/B-2"]);

function normalizeVisaClass(raw) {
  const v = String(raw || "").toUpperCase().trim().replace(/-/g, "");
  if (v === "B1B2" || v === "B1/B2") return "B1B2";
  if (v === "B1") return "B1";
  if (v === "B2") return "B2";
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

async function runNivScraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "STATE_DEPT_NIV", status: "running" });
  let totalInserted = 0;

  const years = yearsToFetch || NIV_YEARS;
  const aggregateYears = years.filter((y) => y <= 2020);
  const monthlyYears   = years.filter((y) => y >= 2021);

  for (const year of years) {
    try {
      const url = buildNivUrl(year);
      console.log(`[NIV] Fetching FY${year}...`);
      const { data } = await axios.get(url, {
        timeout: 120000,
        responseType: "arraybuffer",
        maxContentLength: 100 * 1024 * 1024,
      });

      const rows = parseXlsxRows(Buffer.from(data));
      const isMonthly = year >= 2021;

      // Filter B visa rows
      const bRows = rows.filter((r) => {
        const vc = r.visa_class || r.visaclass || r.class || "";
        return normalizeVisaClass(vc) !== null;
      });

      console.log(`[NIV] FY${year}: ${rows.length} rows, ${bRows.length} B-visa rows`);

      if (isMonthly) {
        // Store per month per country per visaClass
        const ops = [];
        for (const row of bRows) {
          const visaClass = normalizeVisaClass(row.visa_class || row.visaclass || row.class || "");
          if (!visaClass) continue;
          const country = (row.nationality || row.country || "").trim();
          const consularPost = (row.post || row.consular_post || "").trim();
          const month = parseNumber(row.month || row.month_number || 0);
          const issuances = parseNumber(row.issuances || row.issued || row.total_issued || 0);
          const refusals  = parseNumber(row.refusals  || row.refused || row.total_refused || 0);
          const total = issuances + refusals;
          const refusalRate = total > 0 ? parseFloat(((refusals / total) * 100).toFixed(2)) : 0;

          ops.push({
            updateOne: {
              filter: { fiscalYear: year, month, consularPost, country, visaClass },
              update: {
                $set: {
                  fiscalYear: year, month, consularPost, country,
                  nationality: country, issuances, refusals, refusalRate, visaClass,
                  source: "STATE_DEPT_NIV", importedAt: new Date(),
                },
              },
              upsert: true,
            },
          });
        }

        if (ops.length > 0) {
          const BATCH = 1000;
          for (let i = 0; i < ops.length; i += BATCH) {
            const result = await VisitorVisaRecord.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
            totalInserted += result.upsertedCount + result.modifiedCount;
          }
          console.log(`[NIV] FY${year}: ${ops.length} monthly records`);
        }
      } else {
        // Aggregate at country+year level (month=0)
        const byKey = {};
        for (const row of bRows) {
          const visaClass = normalizeVisaClass(row.visa_class || row.visaclass || row.class || "");
          if (!visaClass) continue;
          const country = (row.nationality || row.country || "").trim();
          const key = `${country}|${visaClass}`;
          if (!byKey[key]) {
            byKey[key] = { country, visaClass, issuances: 0, refusals: 0 };
          }
          byKey[key].issuances += parseNumber(row.issuances || row.issued || row.total_issued || 0);
          byKey[key].refusals  += parseNumber(row.refusals  || row.refused || row.total_refused || 0);
        }

        const ops = Object.values(byKey).map((rec) => {
          const total = rec.issuances + rec.refusals;
          const refusalRate = total > 0 ? parseFloat(((rec.refusals / total) * 100).toFixed(2)) : 0;
          return {
            updateOne: {
              filter: { fiscalYear: year, month: 0, consularPost: "", country: rec.country, visaClass: rec.visaClass },
              update: {
                $set: {
                  fiscalYear: year, month: 0, consularPost: "", country: rec.country,
                  nationality: rec.country, issuances: rec.issuances, refusals: rec.refusals,
                  refusalRate, visaClass: rec.visaClass,
                  source: "STATE_DEPT_NIV", importedAt: new Date(),
                },
              },
              upsert: true,
            },
          };
        });

        if (ops.length > 0) {
          const BATCH = 1000;
          for (let i = 0; i < ops.length; i += BATCH) {
            const result = await VisitorVisaRecord.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
            totalInserted += result.upsertedCount + result.modifiedCount;
          }
          console.log(`[NIV] FY${year}: ${ops.length} aggregate country records`);
        }
      }
    } catch (err) {
      console.error(`[NIV] FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[NIV] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runNivScraper, NIV_YEARS };
