/**
 * ICE SEVIS (Student and Exchange Visitor Information System) scraper
 * Source: https://www.ice.gov/sevis/sevis-by-the-numbers
 * Data: Quarterly Excel/PDF reports, FY2010–present
 *
 * SEVIS "By the Numbers" quarterly reports contain OPT/CPT active student
 * counts by school, country of birth, and field of study.
 */
const axios = require("axios");
const XLSX = require("xlsx");
const OptCptRecord = require("../models/OptCptRecord");
const DataSyncLog = require("../models/DataSyncLog");

// ICE SEVIS quarterly Excel reports.
// URL pattern: https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers{YYYY}{quarter}.xlsx
// Quarter codes: "q1" (Jan–Mar), "q2" (Apr–Jun), "q3" (Jul–Sep), "q4" (Oct–Dec)
const SEVIS_FILES = [
  { year: 2024, quarter: "Q2", label: "2024-Q2", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2024q2.xlsx" },
  { year: 2024, quarter: "Q1", label: "2024-Q1", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2024q1.xlsx" },
  { year: 2023, quarter: "Q4", label: "2023-Q4", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2023q4.xlsx" },
  { year: 2023, quarter: "Q3", label: "2023-Q3", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2023q3.xlsx" },
  { year: 2023, quarter: "Q2", label: "2023-Q2", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2023q2.xlsx" },
  { year: 2023, quarter: "Q1", label: "2023-Q1", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2023q1.xlsx" },
  { year: 2022, quarter: "Q4", label: "2022-Q4", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2022q4.xlsx" },
  { year: 2022, quarter: "Q3", label: "2022-Q3", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2022q3.xlsx" },
  { year: 2022, quarter: "Q2", label: "2022-Q2", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2022q2.xlsx" },
  { year: 2022, quarter: "Q1", label: "2022-Q1", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2022q1.xlsx" },
  { year: 2021, quarter: "Q4", label: "2021-Q4", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2021q4.xlsx" },
  { year: 2021, quarter: "Q3", label: "2021-Q3", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2021q3.xlsx" },
  { year: 2021, quarter: "Q2", label: "2021-Q2", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2021q2.xlsx" },
  { year: 2021, quarter: "Q1", label: "2021-Q1", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2021q1.xlsx" },
  { year: 2020, quarter: "Q4", label: "2020-Q4", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2020q4.xlsx" },
  { year: 2020, quarter: "Q3", label: "2020-Q3", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2020q3.xlsx" },
  { year: 2020, quarter: "Q2", label: "2020-Q2", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2020q2.xlsx" },
  { year: 2020, quarter: "Q1", label: "2020-Q1", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2020q1.xlsx" },
  { year: 2019, quarter: "Q4", label: "2019-Q4", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2019q4.xlsx" },
  { year: 2019, quarter: "Q3", label: "2019-Q3", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2019q3.xlsx" },
  { year: 2019, quarter: "Q2", label: "2019-Q2", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2019q2.xlsx" },
  { year: 2019, quarter: "Q1", label: "2019-Q1", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2019q1.xlsx" },
  { year: 2018, quarter: "Q4", label: "2018-Q4", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2018q4.xlsx" },
  { year: 2018, quarter: "Q3", label: "2018-Q3", url: "https://www.ice.gov/doclib/sevis/pdf/sevisbyNumbers2018q3.xlsx" },
];

function normalizeHeader(h) {
  return String(h || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function parseNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseInt(String(val).replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

function findField(row, ...candidates) {
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }
  return "";
}

function parseXlsxRows(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  // SEVIS reports have multiple sheets; try to find the school-level sheet
  const sheetNames = workbook.SheetNames;
  const schoolSheet = sheetNames.find((s) =>
    s.toLowerCase().includes("school") || s.toLowerCase().includes("institution")
  ) || sheetNames[0];

  const sheet = workbook.Sheets[schoolSheet];
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

async function runSevisScraper({ quartersToFetch = null } = {}) {
  const log = await DataSyncLog.create({ source: "ICE_SEVIS", status: "running" });
  let totalInserted = 0;

  const filesToProcess = quartersToFetch
    ? SEVIS_FILES.filter((f) => quartersToFetch.includes(f.label))
    : SEVIS_FILES.slice(0, 2); // default: latest 2 quarters

  for (const { label, url } of filesToProcess) {
    try {
      console.log(`[SEVIS] Fetching ${label}...`);
      const { data } = await axios.get(url, {
        timeout: 120000,
        responseType: "arraybuffer",
      });

      const rows = parseXlsxRows(Buffer.from(data));

      const ops = rows
        .filter((r) => {
          const school = findField(r, "school_name", "institution", "school");
          return school && school.length > 2;
        })
        .map((row) => {
          const school = findField(row, "school_name", "institution", "school");
          const state = findField(row, "school_state", "state");
          const country = findField(row, "country_of_birth", "country", "citizenship_country");
          const activeStudents = parseNumber(findField(row, "active_students", "total_active", "active"));
          const optCount = parseNumber(findField(row, "opt", "opt_students", "opt_total"));
          const cptCount = parseNumber(findField(row, "cpt", "cpt_students", "cpt_total"));
          const stemOptCount = parseNumber(findField(row, "stem_opt", "stem_opt_students", "opt_stem"));

          return {
            updateOne: {
              filter: { quarter: label, school, country },
              update: {
                $set: {
                  quarter: label,
                  school,
                  state,
                  country,
                  activeStudents,
                  optCount,
                  cptCount,
                  stemOptCount,
                  source: "ICE_SEVIS",
                  importedAt: new Date(),
                },
              },
              upsert: true,
            },
          };
        });

      if (ops.length > 0) {
        const result = await OptCptRecord.bulkWrite(ops, { ordered: false });
        const inserted = result.upsertedCount + result.modifiedCount;
        totalInserted += inserted;
        console.log(`[SEVIS] ${label}: ${inserted} records upserted`);
      }
    } catch (err) {
      console.error(`[SEVIS] ${label} failed: ${err.message}`);
    }
  }

  await DataSyncLog.findByIdAndUpdate(log._id, {
    status: "success",
    recordsInserted: totalInserted,
    lastSyncAt: new Date(),
  });

  console.log(`[SEVIS] Done. Total: ${totalInserted} records`);
  return totalInserted;
}

module.exports = { runSevisScraper, SEVIS_FILES };
