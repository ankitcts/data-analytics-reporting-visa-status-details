/**
 * USCIS H-1B Employer Data Hub scraper
 * Source: https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub
 * Data: FY2009–present, CSV format, annual
 *
 * The USCIS Hub provides per-employer approval/denial/RFE counts.
 * Files are named by fiscal year and available as direct CSV downloads.
 */
const axios = require("axios");
const H1bRecord = require("../models/H1bRecord");
const DataSyncLog = require("../models/DataSyncLog");

// USCIS publishes H-1B employer data as CSV downloads.
// The base URL pattern and available years (update as new years are published).
const USCIS_H1B_FILES = [
  { year: 2024, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2024.csv" },
  { year: 2023, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2023.csv" },
  { year: 2022, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2022.csv" },
  { year: 2021, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2021.csv" },
  { year: 2020, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2020.csv" },
  { year: 2019, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2019.csv" },
  { year: 2018, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2018.csv" },
  { year: 2017, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2017.csv" },
  { year: 2016, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2016.csv" },
  { year: 2015, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2015.csv" },
  { year: 2014, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2014.csv" },
  { year: 2013, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2013.csv" },
  { year: 2012, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2012.csv" },
  { year: 2011, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2011.csv" },
  { year: 2010, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2010.csv" },
  { year: 2009, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-fy2009.csv" },
];

function parseNumber(val) {
  if (!val) return 0;
  const n = parseInt(String(val).replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function parseCsvRows(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    return headers.reduce((obj, h, i) => { obj[h] = (vals[i] || "").trim().replace(/^"|"$/g, ""); return obj; }, {});
  });
}

async function runUscisH1bScraper({ yearsToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "USCIS_H1B", status: "running" });
  let totalInserted = 0;

  const filesToProcess = yearsToFetch
    ? USCIS_H1B_FILES.filter((f) => yearsToFetch.includes(f.year))
    : USCIS_H1B_FILES.slice(0, 2); // default: latest 2 years for weekly sync

  for (const { year, url } of filesToProcess) {
    try {
      console.log(`[USCIS H-1B] Fetching FY${year}...`);
      const { data } = await axios.get(url, { timeout: 60000, responseType: "text" });
      const rows = parseCsvRows(data);

      const ops = rows.map((row) => ({
        updateOne: {
          filter: { fiscalYear: year, employer: row.employer_name || row.employer || "", country: row.country_of_birth || row.country || "" },
          update: {
            $set: {
              fiscalYear: year,
              employer: row.employer_name || row.employer || "",
              industry: row.industry || "",
              state: row.state || "",
              country: row.country_of_birth || row.country || "",
              initialApprovals: parseNumber(row.initial_approvals),
              initialDenials: parseNumber(row.initial_denials),
              continuingApprovals: parseNumber(row.continuing_approvals),
              continuingDenials: parseNumber(row.continuing_denials),
              rfeIssued: parseNumber(row.rfe_issued),
              rfeDecisionApproved: parseNumber(row.rfe_decision_approved),
              rfeDecisionDenied: parseNumber(row.rfe_decision_denied),
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
        console.log(`[USCIS H-1B] FY${year}: ${inserted} records upserted`);
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

  console.log(`[USCIS H-1B] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runUscisH1bScraper };
