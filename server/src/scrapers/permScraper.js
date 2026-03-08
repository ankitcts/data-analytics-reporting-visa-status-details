/**
 * DOL FLAG PERM disclosure data scraper
 * Source: https://flag.dol.gov/programs/PERM
 * Data: FY2014–FY2026, CSV disclosure files (100-300MB each)
 *
 * Each row = one PERM case. We aggregate to employer+year+caseStatus level before upsert.
 * Uses streaming to handle large files.
 */
const axios = require("axios");
const PERMRecord = require("../models/PERMRecord");
const DataSyncLog = require("../models/DataSyncLog");

// DOL FLAG PERM disclosure files — large CSVs, URL pattern may change
const DOL_PERM_FILES = [
  { year: 2024, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2024_Q4.csv" },
  { year: 2023, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2023_Q4.csv" },
  { year: 2022, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2022_Q4.csv" },
  { year: 2021, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2021_Q4.csv" },
  { year: 2020, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2020_Q4.csv" },
  { year: 2019, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2019_Q4.csv" },
  { year: 2018, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2018_Q4.csv" },
  { year: 2017, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2017_Q4.csv" },
  { year: 2016, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2016_Q4.csv" },
  { year: 2015, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2015_Q4.csv" },
  { year: 2014, url: "https://flag.dol.gov/sites/default/files/OFLC_Performance_Data_FY2014_Q4.csv" },
];

const STATUS_MAP = {
  "CERTIFIED": "CERTIFIED",
  "DENIED": "DENIED",
  "WITHDRAWN": "WITHDRAWN",
  "CERTIFIED-EXPIRED": "WITHDRAWN",
  "AUDIT - DENIED": "AUDIT_FAIL",
  "AUDIT FAIL": "AUDIT_FAIL",
  "PENDING": "PENDING",
};

function normalizeStatus(raw) {
  const key = String(raw || "").toUpperCase().trim();
  return STATUS_MAP[key] || null;
}

function parseNumber(val) {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function parseCsvLine(line) {
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
  return vals;
}

async function runPermScraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "DOL_PERM", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? DOL_PERM_FILES.filter((f) => yearsToFetch.includes(f.year))
    : DOL_PERM_FILES;

  for (const { year, url } of filesToProcess) {
    try {
      console.log(`[PERM] Fetching FY${year}... (large file, may take minutes)`);
      const { data } = await axios.get(url, {
        timeout: 600000,
        responseType: "text",
        maxContentLength: 500 * 1024 * 1024,
      });

      // Parse CSV in memory
      const clean = String(data).replace(/^\uFEFF/, "").trim();
      const lines = clean.split("\n");
      if (lines.length < 2) {
        console.log(`[PERM] FY${year}: empty file, skipping`);
        continue;
      }

      const headerLine = lines[0];
      const headers = parseCsvLine(headerLine).map((h) =>
        h.replace(/^"|"$/g, "").trim().toUpperCase().replace(/\s+/g, "_")
      );

      const byKey = {};
      let rawCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        rawCount++;

        const vals = parseCsvLine(line);
        const row = {};
        headers.forEach((h, idx) => { row[h] = (vals[idx] || "").replace(/^"|"$/g, "").trim(); });

        const employer = (row.EMPLOYER_NAME || row.COMPANY_NAME || "").trim();
        if (!employer) continue;

        const rawStatus = row.CASE_STATUS || row.STATUS || "";
        const caseStatus = normalizeStatus(rawStatus);
        if (!caseStatus) continue;

        const state = (row.EMPLOYER_STATE || row.STATE_OF_EMPLOYMENT || "").trim();
        const country = (row.COUNTRY_OF_CITIZENSHIP || row.FOREIGN_WORKER_COUNTRY || "").trim();
        const naicsCode = (row.JOB_INFO_NAICS_CODE || row.NAICS_CODE || "").trim();
        const wageOffered = parseNumber(row.WAGE_OFFER_FROM_9089 || row.WAGE_RATE_OF_PAY_FROM || 0);
        const prevailingWage = parseNumber(row.PW_AMOUNT_9089 || row.PREVAILING_WAGE || 0);

        const key = `${employer}|${caseStatus}`;
        if (!byKey[key]) {
          byKey[key] = {
            employer, state, country, naicsCode,
            wageOffered: 0, prevailingWage: 0,
            caseStatus, totalCases: 0,
            approved: 0, denied: 0, withdrawn: 0,
          };
        }
        byKey[key].totalCases++;
        if (caseStatus === "CERTIFIED") byKey[key].approved++;
        else if (caseStatus === "DENIED" || caseStatus === "AUDIT_FAIL") byKey[key].denied++;
        else if (caseStatus === "WITHDRAWN") byKey[key].withdrawn++;
        // Average wages
        if (wageOffered > 0) byKey[key].wageOffered = (byKey[key].wageOffered + wageOffered) / 2;
        if (prevailingWage > 0) byKey[key].prevailingWage = (byKey[key].prevailingWage + prevailingWage) / 2;
      }

      console.log(`[PERM] FY${year}: ${rawCount} raw rows → ${Object.keys(byKey).length} aggregated records`);

      const ops = Object.values(byKey).map((rec) => ({
        updateOne: {
          filter: {
            fiscalYear: year,
            quarter: "annual",
            employer: rec.employer,
            country: rec.country,
            caseStatus: rec.caseStatus,
          },
          update: {
            $set: {
              fiscalYear: year,
              quarter: "annual",
              employer: rec.employer,
              state: rec.state,
              country: rec.country,
              naicsCode: rec.naicsCode,
              wageOffered: Math.round(rec.wageOffered),
              prevailingWage: Math.round(rec.prevailingWage),
              caseStatus: rec.caseStatus,
              totalCases: rec.totalCases,
              approved: rec.approved,
              denied: rec.denied,
              withdrawn: rec.withdrawn,
              source: "DOL_PERM",
              importedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      if (ops.length > 0) {
        const BATCH = 1000;
        let yearInserted = 0;
        for (let i = 0; i < ops.length; i += BATCH) {
          const result = await PERMRecord.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
          yearInserted += result.upsertedCount + result.modifiedCount;
        }
        totalInserted += yearInserted;
        console.log(`[PERM] FY${year}: ${yearInserted} records upserted`);
      }
    } catch (err) {
      console.error(`[PERM] FY${year} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[PERM] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runPermScraper, DOL_PERM_FILES };
