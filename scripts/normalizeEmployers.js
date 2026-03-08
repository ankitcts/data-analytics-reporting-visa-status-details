#!/usr/bin/env node
/**
 * Standalone script to rebuild the EmployerIndex collection.
 * Run after seeding all visa data.
 *
 * Usage:
 *   MONGODB_URI=mongodb+srv://... node scripts/normalizeEmployers.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { connectDatabase } = require("../server/src/db");
const { runEmployerNormalizer } = require("../server/src/scrapers/employerNormalizer");

async function main() {
  console.log("=== Employer Normalizer ===");
  await connectDatabase();
  const n = await runEmployerNormalizer();
  console.log(`\nDone. ${n} EmployerIndex records upserted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
