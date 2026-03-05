const express = require("express");
const router = express.Router();
const H1bRecord = require("../models/H1bRecord");

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

// GET /api/h1b/trends?country=&state=
// Year-over-year trend (all years in DB)
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.state) match.state = new RegExp(req.query.state, "i");

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

// GET /api/h1b/sponsors?year=&limit=20
router.get("/sponsors", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
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

// GET /api/h1b/states?year=
router.get("/states", async (req, res) => {
  try {
    const match = { state: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);

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

module.exports = router;
