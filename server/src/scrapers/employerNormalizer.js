/**
 * Employer Normalizer
 * Reads distinct employer names from H1bRecord, L1Record, PERMRecord, EbRecord, O1Record,
 * normalizes them, and builds/updates the EmployerIndex collection.
 *
 * Run via: node scripts/normalizeEmployers.js
 */
const H1bRecord = require("../models/H1bRecord");
const L1Record = require("../models/L1Record");
const PERMRecord = require("../models/PERMRecord");
const EbRecord = require("../models/EbRecord");
const O1Record = require("../models/O1Record");
const EmployerIndex = require("../models/EmployerIndex");

const STRIP_SUFFIXES = /\b(LLC|INC|CORP|LTD|LP|LLP|CO|COMPANY|CORPORATION|INCORPORATED|LIMITED|GROUP|HOLDINGS|TECHNOLOGIES|TECHNOLOGY|SOLUTIONS|SERVICES|CONSULTING|SYSTEMS|GLOBAL|INTERNATIONAL|US|USA|AMERICA|AMERICAS)\b\.?/gi;

function normalizeEmployerName(name) {
  if (!name || name === "_aggregate_") return null;
  return name
    .toUpperCase()
    .replace(STRIP_SUFFIXES, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function collectEmployers(Model, field = "employer", visaType = "UNKNOWN") {
  const names = await Model.distinct(field);
  return names
    .filter((n) => n && n !== "_aggregate_" && n !== "_national_aggregate_")
    .map((n) => ({ raw: n, visaType }));
}

async function runEmployerNormalizer() {
  console.log("[EmployerNormalizer] Collecting employer names...");

  const [h1bNames, l1Names, permNames, ebNames, o1Names] = await Promise.all([
    collectEmployers(H1bRecord, "employer", "H1B"),
    collectEmployers(L1Record, "employer", "L1"),
    collectEmployers(PERMRecord, "employer", "PERM"),
    collectEmployers(EbRecord, "employer", "EB"),
    collectEmployers(O1Record, "employer", "O1"),
  ]);

  const allNames = [...h1bNames, ...l1Names, ...permNames, ...ebNames, ...o1Names];
  console.log(`[EmployerNormalizer] ${allNames.length} total name occurrences across all visa types`);

  // Group by normalized name
  const groups = {};
  for (const { raw, visaType } of allNames) {
    const normalized = normalizeEmployerName(raw);
    if (!normalized) continue;

    if (!groups[normalized]) {
      groups[normalized] = {
        normalizedName: normalized,
        displayName: raw,
        aliases: new Set([raw]),
        visaTypes: new Set(),
      };
    }

    groups[normalized].aliases.add(raw);
    groups[normalized].visaTypes.add(visaType);

    // Prefer longer variant as displayName
    if (raw.length > groups[normalized].displayName.length) {
      groups[normalized].displayName = raw;
    }
  }

  const groupCount = Object.keys(groups).length;
  console.log(`[EmployerNormalizer] ${groupCount} normalized employer groups`);

  // Upsert EmployerIndex
  const ops = Object.values(groups).map((g) => ({
    updateOne: {
      filter: { normalizedName: g.normalizedName },
      update: {
        $set: {
          normalizedName: g.normalizedName,
          displayName: g.displayName,
          aliases: [...g.aliases],
          visaTypes: [...g.visaTypes],
          importedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  let total = 0;
  const BATCH = 1000;
  for (let i = 0; i < ops.length; i += BATCH) {
    const result = await EmployerIndex.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
    total += result.upsertedCount + result.modifiedCount;
  }

  console.log(`[EmployerNormalizer] Done. ${total} EmployerIndex records upserted`);
  return total;
}

module.exports = { runEmployerNormalizer };
