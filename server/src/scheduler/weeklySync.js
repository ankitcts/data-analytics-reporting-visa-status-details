const cron = require("node-cron");
const { runUscisH1bScraper } = require("../scrapers/uscisH1bScraper");
const { runDolLcaScraper } = require("../scrapers/dolLcaScraper");
const { runUscisL1Scraper } = require("../scrapers/uscisL1Scraper");
const { runSevisScraper } = require("../scrapers/sevisScraper");
const { runO1Scraper } = require("../scrapers/o1Scraper");
const { runI765Scraper } = require("../scrapers/i765Scraper");
const { runI140Scraper } = require("../scrapers/i140Scraper");
const { runNivScraper } = require("../scrapers/nivScraper");

// Every Sunday at 2:00 AM UTC
const SCHEDULE = "0 2 * * 0";

async function runAllScrapers() {
  console.log("[WeeklySync] Starting weekly data refresh...");
  const start = Date.now();

  try {
    await runUscisH1bScraper();   // latest 2 years of H-1B data
  } catch (e) {
    console.error("[WeeklySync] USCIS H-1B failed:", e.message);
  }

  try {
    await runDolLcaScraper();     // latest 2 quarters of DOL LCA data
  } catch (e) {
    console.error("[WeeklySync] DOL LCA failed:", e.message);
  }

  try {
    await runUscisL1Scraper();    // latest 2 years of L-1 data (L1A + L1B)
  } catch (e) {
    console.error("[WeeklySync] USCIS L-1 failed:", e.message);
  }

  try {
    await runSevisScraper();      // latest 2 quarters of SEVIS data
  } catch (e) {
    console.error("[WeeklySync] SEVIS failed:", e.message);
  }

  try {
    await runO1Scraper();         // latest 2 years of O-1 data
  } catch (e) {
    console.error("[WeeklySync] O-1 failed:", e.message);
  }

  try {
    await runI765Scraper();       // latest 2 years of I-765 / H-4 EAD data
  } catch (e) {
    console.error("[WeeklySync] I-765 failed:", e.message);
  }

  try {
    await runI140Scraper();       // latest 2 years of I-140 EB data
  } catch (e) {
    console.error("[WeeklySync] I-140 failed:", e.message);
  }

  try {
    await runNivScraper({ yearsToFetch: [new Date().getFullYear(), new Date().getFullYear() - 1] });
  } catch (e) {
    console.error("[WeeklySync] NIV failed:", e.message);
  }

  // NOTE: DOL PERM files are 100-300MB — skipped in weekly sync, run via seed script only

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[WeeklySync] Done in ${elapsed}s`);
}

function startScheduler() {
  if (!cron.validate(SCHEDULE)) {
    console.error("[WeeklySync] Invalid cron schedule:", SCHEDULE);
    return;
  }

  cron.schedule(SCHEDULE, runAllScrapers, {
    timezone: "UTC",
  });

  console.log(`[WeeklySync] Scheduled (${SCHEDULE} UTC — every Sunday 2am)`);
}

module.exports = { startScheduler, runAllScrapers };
