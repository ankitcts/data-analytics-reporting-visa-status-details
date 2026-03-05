const express = require("express");
const router = express.Router();
const H1bRecord = require("../models/H1bRecord");
const countryStats = require("../data/h1b_country_stats.json");

// GET /api/h1b/stats?year=&country=&state=&source=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.state) match.state = new RegExp(req.query.state, "i");
    if (req.query.source) match.source = req.query.source;

    const [result] = await H1bRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalInitialApprovals: { $sum: "$initialApprovals" },
          totalInitialDenials: { $sum: "$initialDenials" },
          totalContinuingApprovals: { $sum: "$continuingApprovals" },
          totalContinuingDenials: { $sum: "$continuingDenials" },
          totalRfeIssued: { $sum: "$rfeIssued" },
          totalRfeApproved: { $sum: "$rfeDecisionApproved" },
          totalRfeDenied: { $sum: "$rfeDecisionDenied" },
          employerCount: { $addToSet: "$employer" },
        },
      },
      {
        $project: {
          _id: 0,
          totalInitialApprovals: 1,
          totalInitialDenials: 1,
          totalContinuingApprovals: 1,
          totalContinuingDenials: 1,
          totalRfeIssued: 1,
          totalRfeApproved: 1,
          totalRfeDenied: 1,
          uniqueEmployers: { $size: "$employerCount" },
          approvalRate: {
            $cond: [
              { $gt: [{ $add: ["$totalInitialApprovals", "$totalInitialDenials"] }, 0] },
              {
                $multiply: [
                  { $divide: ["$totalInitialApprovals", { $add: ["$totalInitialApprovals", "$totalInitialDenials"] }] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
    ]);

    res.json(result || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/trends?country=&state=&source=
// Year-over-year trend (all years in DB)
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.state) match.state = new RegExp(req.query.state, "i");
    if (req.query.source) match.source = req.query.source;

    const data = await H1bRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$fiscalYear",
          initialApprovals: { $sum: "$initialApprovals" },
          initialDenials: { $sum: "$initialDenials" },
          continuingApprovals: { $sum: "$continuingApprovals" },
          continuingDenials: { $sum: "$continuingDenials" },
          rfeIssued: { $sum: "$rfeIssued" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id",
          initialApprovals: 1,
          initialDenials: 1,
          continuingApprovals: 1,
          continuingDenials: 1,
          rfeIssued: 1,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/sponsors?year=&limit=20&source=
router.get("/sponsors", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.source) match.source = req.query.source;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const data = await H1bRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$employer",
          employer: { $first: "$employer" },
          state: { $first: "$state" },
          initialApprovals: { $sum: "$initialApprovals" },
          initialDenials: { $sum: "$initialDenials" },
          continuingApprovals: { $sum: "$continuingApprovals" },
          rfeIssued: { $sum: "$rfeIssued" },
        },
      },
      { $sort: { initialApprovals: -1 } },
      { $limit: limit },
      { $project: { _id: 0, employer: 1, state: 1, initialApprovals: 1, initialDenials: 1, continuingApprovals: 1, rfeIssued: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/countries?year=&limit=50
router.get("/countries", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await H1bRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$country",
          country: { $first: "$country" },
          initialApprovals: { $sum: "$initialApprovals" },
          initialDenials: { $sum: "$initialDenials" },
          continuingApprovals: { $sum: "$continuingApprovals" },
        },
      },
      { $sort: { initialApprovals: -1 } },
      { $limit: limit },
      { $project: { _id: 0, country: 1, initialApprovals: 1, initialDenials: 1, continuingApprovals: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/states?year=&source=
router.get("/states", async (req, res) => {
  try {
    const match = { state: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.source) match.source = req.query.source;

    const data = await H1bRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$state",
          state: { $first: "$state" },
          initialApprovals: { $sum: "$initialApprovals" },
          initialDenials: { $sum: "$initialDenials" },
        },
      },
      { $sort: { initialApprovals: -1 } },
      { $project: { _id: 0, state: 1, initialApprovals: 1, initialDenials: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/country-breakdown?year=
// Returns country of birth breakdown from USCIS Characteristics of H-1B Reports.
// Note: USCIS bulk CSV data does not include country; this uses official published statistics.
router.get("/country-breakdown", (req, res) => {
  const year = parseInt(req.query.year) || 2023;
  const yearStr = String(year);
  const data = countryStats.years[yearStr];

  if (!data) {
    const available = Object.keys(countryStats.years).map(Number).sort((a, b) => b - a);
    return res.status(404).json({ error: `No country data for FY${year}`, availableYears: available });
  }

  res.json({
    fiscalYear: year,
    total: data.total,
    countries: data.countries,
    source: countryStats._source,
    sourceNote: "Country data is from USCIS Characteristics of H-1B Specialty Occupation Workers annual reports, not from the employer data hub CSV which does not include country of birth.",
  });
});

// GET /api/h1b/employers?year=&search=&page=1&limit=50&sort=initial&source=
// Paginated, searchable employer list
router.get("/employers", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.source) match.source = req.query.source;
    if (req.query.search) match.employer = new RegExp(req.query.search.trim(), "i");

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);
    const skip  = (page - 1) * limit;

    const sortField = req.query.sort === "continuing" ? "continuingApprovals"
                    : req.query.sort === "denials"    ? "initialDenials"
                    : req.query.sort === "total"      ? "totalIssued"
                    : "initialApprovals";

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$employer",
          employer: { $first: "$employer" },
          state: { $first: "$state" },
          initialApprovals: { $sum: "$initialApprovals" },
          initialDenials: { $sum: "$initialDenials" },
          continuingApprovals: { $sum: "$continuingApprovals" },
          continuingDenials: { $sum: "$continuingDenials" },
          rfeIssued: { $sum: "$rfeIssued" },
        },
      },
      {
        $addFields: {
          totalIssued: { $add: ["$initialApprovals", "$continuingApprovals"] },
          denialRate: {
            $cond: [
              { $gt: [{ $add: ["$initialApprovals", "$initialDenials"] }, 0] },
              {
                $multiply: [
                  { $divide: ["$initialDenials", { $add: ["$initialApprovals", "$initialDenials"] }] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { [sortField]: -1 } },
    ];

    // Count total (without pagination)
    const countPipeline = [...pipeline, { $count: "total" }];
    const [countResult] = await H1bRecord.aggregate(countPipeline);
    const total = countResult ? countResult.total : 0;

    // Paginated data
    pipeline.push({ $skip: skip }, { $limit: limit });
    pipeline.push({
      $project: {
        _id: 0,
        employer: 1,
        state: 1,
        initialApprovals: 1,
        initialDenials: 1,
        continuingApprovals: 1,
        continuingDenials: 1,
        rfeIssued: 1,
        totalIssued: 1,
        denialRate: 1,
      },
    });

    const data = await H1bRecord.aggregate(pipeline);

    res.json({
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/employer-suggest?q=INFOSYS&limit=10
// Autocomplete: return distinct employer names matching partial query
router.get("/employer-suggest", async (req, res) => {
  try {
    if (!req.query.q || req.query.q.trim().length < 2)
      return res.json([]);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const safe  = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = await H1bRecord.distinct("employer", {
      employer: new RegExp(safe, "i"),
      source: "USCIS_HUB",   // suggest from granular data only
    });
    // Sort: exact-start matches first, then alphabetical
    const re = new RegExp(`^${safe}`, "i");
    names.sort((a, b) => {
      const aStart = re.test(a) ? 0 : 1;
      const bStart = re.test(b) ? 0 : 1;
      return aStart - bStart || a.localeCompare(b);
    });
    res.json(names.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/company?name=COMPANY_NAME&source=
// Full year-by-year history for a single company (partial name match, aggregated)
router.get("/company", async (req, res) => {
  try {
    if (!req.query.name) return res.status(400).json({ error: "name param required" });

    const safe  = req.query.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = { employer: new RegExp(safe, "i") };
    if (req.query.source) match.source = req.query.source;

    const data = await H1bRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$fiscalYear",
          fiscalYear: { $first: "$fiscalYear" },
          employer: { $first: "$employer" },
          state: { $first: "$state" },
          source: { $first: "$source" },
          initialApprovals: { $sum: "$initialApprovals" },
          initialDenials: { $sum: "$initialDenials" },
          continuingApprovals: { $sum: "$continuingApprovals" },
          continuingDenials: { $sum: "$continuingDenials" },
          rfeIssued: { $sum: "$rfeIssued" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          fiscalYear: 1,
          employer: 1,
          state: 1,
          source: 1,
          initialApprovals: 1,
          initialDenials: 1,
          continuingApprovals: 1,
          continuingDenials: 1,
          rfeIssued: 1,
          totalIssued: { $add: ["$initialApprovals", "$continuingApprovals"] },
          denialRate: {
            $cond: [
              { $gt: [{ $add: ["$initialApprovals", "$initialDenials"] }, 0] },
              {
                $multiply: [
                  { $divide: ["$initialDenials", { $add: ["$initialApprovals", "$initialDenials"] }] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
    ]);

    if (!data.length) return res.status(404).json({ error: "No data found for this employer" });
    // Collect distinct employer names that matched
    const matchedNames = await H1bRecord.distinct("employer", { employer: new RegExp(safe, "i") });
    res.json({ employer: matchedNames.length === 1 ? matchedNames[0] : req.query.name.trim(), matchedNames, years: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/h1b/available-years — list all fiscal years with data
router.get("/available-years", async (req, res) => {
  try {
    const uscisYears = await H1bRecord.distinct("fiscalYear", { source: "USCIS_HUB" });
    const lcaYears = await H1bRecord.distinct("fiscalYear", { source: "DOL_LCA" });
    const countryYears = Object.keys(countryStats.years).map(Number);
    res.json({
      uscis: uscisYears.sort((a, b) => b - a),
      lca: lcaYears.sort((a, b) => b - a),
      country: countryYears.sort((a, b) => b - a),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
