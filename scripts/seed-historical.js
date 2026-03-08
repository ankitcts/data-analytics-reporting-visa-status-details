#!/usr/bin/env node
/**
 * Historical seed script — runs all scrapers year-by-year, oldest first.
 *
 * Usage:
 *   node scripts/seed-historical.js                          # all scrapers, all years
 *   node scripts/seed-historical.js --only h1b,perm          # specific scrapers
 *   node scripts/seed-historical.js --year 2022              # single year, all scrapers
 *   node scripts/seed-historical.js --from 2018 --to 2023   # year range
 *   node scripts/seed-historical.js --normalize-only         # just rebuild EmployerIndex
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { connectDatabase } = require("../server/src/db");
const { runUscisH1bScraper } = require("../server/src/scrapers/uscisH1bScraper");
const { runDolLcaScraper, DOL_LCA_FILES } = require("../server/src/scrapers/dolLcaScraper");
const { runUscisL1Scraper } = require("../server/src/scrapers/uscisL1Scraper");
const { runSevisScraper, SEVIS_FILES } = require("../server/src/scrapers/sevisScraper");
const { runI765Scraper } = require("../server/src/scrapers/i765Scraper");
const { runI140Scraper } = require("../server/src/scrapers/i140Scraper");
const { runPermScraper } = require("../server/src/scrapers/permScraper");
const { runO1Scraper } = require("../server/src/scrapers/o1Scraper");
const { runNivScraper } = require("../server/src/scrapers/nivScraper");
const { runEmployerNormalizer } = require("../server/src/scrapers/employerNormalizer");

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

const onlyArg = getArg("--only");
const only = onlyArg ? onlyArg.split(",").map((s) => s.trim().toLowerCase()) : null;
const singleYear = getArg("--year") ? parseInt(getArg("--year")) : null;
const fromYear = getArg("--from") ? parseInt(getArg("--from")) : 2000;
const toYear = getArg("--to") ? parseInt(getArg("--to")) : 2026;
const normalizeOnly = hasFlag("--normalize-only");

function shouldRun(name) {
  return !only || only.includes(name);
}

function buildYearRange() {
  if (singleYear) return [singleYear];
  const years = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);
  return years;
}

function log(tag, result) {
  const padded = tag.padEnd(20, " ");
  if (typeof result === "number") {
    console.log(`  [${padded}] ✓  ${result.toLocaleString()} records`);
  } else {
    console.log(`  [${padded}] ${result}`);
  }
}

async function main() {
  console.log("=== Historical Seed Script ===");
  console.log(`Year range: ${fromYear}–${toYear}${singleYear ? ` (single year: ${singleYear})` : ""}`);
  console.log(`Scrapers: ${only ? only.join(", ") : "all"}`);
  console.log("");

  await connectDatabase();

  if (normalizeOnly) {
    console.log("[normalize-only] Rebuilding EmployerIndex...");
    const n = await runEmployerNormalizer();
    log("EmployerIndex", n);
    console.log("\n=== Normalize complete ===");
    process.exit(0);
  }

  const years = buildYearRange();

  // --- Year-by-year loop ---
  for (const year of years) {
    console.log(`\n=== FY${year} ===`);

    // H-1B (FY2009–FY2023)
    if (shouldRun("h1b") && year >= 2009 && year <= 2023) {
      try {
        const n = await runUscisH1bScraper({ yearsToFetch: [year] });
        log(`FY${year} / H1B`, n);
      } catch (e) {
        log(`FY${year} / H1B`, `ERROR: ${e.message}`);
      }
    }

    // DOL LCA (FY2019–FY2026, quarterly)
    if (shouldRun("lca") || shouldRun("dol")) {
      if (year >= 2019 && year <= 2026) {
        const quarters = DOL_LCA_FILES.filter((f) => f.year === year).map((f) => ({
          year: f.year,
          quarter: f.quarter,
        }));
        if (quarters.length > 0) {
          try {
            const n = await runDolLcaScraper({ quartersToFetch: quarters });
            log(`FY${year} / DOL_LCA`, n);
          } catch (e) {
            log(`FY${year} / DOL_LCA`, `ERROR: ${e.message}`);
          }
        }
      }
    }

    // L-1 (FY2016–FY2023)
    if (shouldRun("l1") && year >= 2016 && year <= 2023) {
      try {
        const n = await runUscisL1Scraper({ yearsToFetch: [year] });
        log(`FY${year} / L1`, n);
      } catch (e) {
        log(`FY${year} / L1`, `ERROR: ${e.message}`);
      }
    }

    // I-765 / H-4 EAD (FY2015–FY2026)
    if (shouldRun("i765") || shouldRun("h4ead")) {
      if (year >= 2015 && year <= 2026) {
        try {
          const n = await runI765Scraper({ yearsToFetch: [year] });
          log(`FY${year} / I765`, n);
        } catch (e) {
          log(`FY${year} / I765`, `ERROR: ${e.message}`);
        }
      }
    }

    // I-140 EB Green Cards (FY2009–FY2026)
    if (shouldRun("i140") || shouldRun("eb")) {
      if (year >= 2009 && year <= 2026) {
        try {
          const n = await runI140Scraper({ yearsToFetch: [year] });
          log(`FY${year} / I140`, n);
        } catch (e) {
          log(`FY${year} / I140`, `ERROR: ${e.message}`);
        }
      }
    }

    // DOL PERM (FY2014–FY2024)
    if (shouldRun("perm") && year >= 2014 && year <= 2024) {
      try {
        const n = await runPermScraper({ yearsToFetch: [year] });
        log(`FY${year} / PERM`, n);
      } catch (e) {
        log(`FY${year} / PERM`, `ERROR: ${e.message}`);
      }
    }

    // O-1 (FY2016–FY2023)
    if (shouldRun("o1") && year >= 2016 && year <= 2023) {
      try {
        const n = await runO1Scraper({ yearsToFetch: [year] });
        log(`FY${year} / O1`, n);
      } catch (e) {
        log(`FY${year} / O1`, `ERROR: ${e.message}`);
      }
    }

    // NIV B-1/B-2 (FY2000–FY2026)
    if (shouldRun("niv") || shouldRun("visitor")) {
      try {
        const n = await runNivScraper({ yearsToFetch: [year] });
        log(`FY${year} / NIV`, n);
      } catch (e) {
        log(`FY${year} / NIV`, `ERROR: ${e.message}`);
      }
    }

    // SEVIS OPT/CPT national aggregates (FY2008–present)
    if (shouldRun("sevis") || shouldRun("opt")) {
      if (year >= 2008) {
        const sevisQuarters = SEVIS_FILES.filter((f) => f.year === year).map((f) => f.quarter);
        if (sevisQuarters.length > 0) {
          try {
            const n = await runSevisScraper({ quartersToFetch: sevisQuarters });
            log(`FY${year} / SEVIS`, n);
          } catch (e) {
            log(`FY${year} / SEVIS`, `ERROR: ${e.message}`);
          }
        }
      }
    }
  }

  // --- Post-loop: EmployerIndex ---
  if (shouldRun("normalize") || !only) {
    console.log("\n=== Building EmployerIndex ===");
    try {
      const n = await runEmployerNormalizer();
      log("EmployerIndex", n);
    } catch (e) {
      log("EmployerIndex", `ERROR: ${e.message}`);
    }
  }

  console.log("\n=== Seed complete ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
