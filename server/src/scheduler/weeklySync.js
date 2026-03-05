const cron = require("node-cron");
const { runUscisH1bScraper } = require("../scrapers/uscisH1bScraper");
const { runDolLcaScraper } = require("../scrapers/dolLcaScraper");
const { runUscisL1Scraper } = require("../scrapers/uscisL1Scraper");
const { runSevisScraper } = require("../scrapers/sevisScraper");

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
    await runUscisL1Scraper();    // latest 2 years of L-1 data
  } catch (e) {
    console.error("[WeeklySync] USCIS L-1 failed:", e.message);
  }

  try {
    await runSevisScraper();      // latest 2 quarters of SEVIS data
  } catch (e) {
    console.error("[WeeklySync] SEVIS failed:", e.message);
  }

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
