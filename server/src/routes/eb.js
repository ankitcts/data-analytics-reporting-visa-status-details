const express = require("express");
const router = express.Router();
const EbRecord = require("../models/EbRecord");

// GET /api/eb/stats?year=&category=&country=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.category) match.ebCategory = req.query.category;
    if (req.query.country) match.country = new RegExp(req.query.country, "i");

    const [result] = await EbRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: "$receipts" },
          totalApprovals: { $sum: "$approvals" },
          totalDenials: { $sum: "$denials" },
          totalPending: { $sum: "$pendingCount" },
        },
      },
      {
        $project: {
          _id: 0,
          totalReceipts: 1,
          totalApprovals: 1,
          totalDenials: 1,
          totalPending: 1,
          approvalRate: {
            $cond: [
              { $gt: [{ $add: ["$totalApprovals", "$totalDenials"] }, 0] },
              { $multiply: [{ $divide: ["$totalApprovals", { $add: ["$totalApprovals", "$totalDenials"] }] }, 100] },
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

// GET /api/eb/trends?category=
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.category) match.ebCategory = req.query.category;

    const data = await EbRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: "$fiscalYear", category: "$ebCategory" },
          approvals: { $sum: "$approvals" },
          denials: { $sum: "$denials" },
        },
      },
      { $sort: { "_id.year": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          category: "$_id.category",
          approvals: 1,
          denials: 1,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/eb/by-category?year=
router.get("/by-category", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);

    const data = await EbRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$ebCategory",
          category: { $first: "$ebCategory" },
          approvals: { $sum: "$approvals" },
          denials: { $sum: "$denials" },
          receipts: { $sum: "$receipts" },
        },
      },
      { $sort: { approvals: -1 } },
      { $project: { _id: 0, category: 1, approvals: 1, denials: 1, receipts: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/eb/countries?year=&category=&limit=50
router.get("/countries", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.category) match.ebCategory = req.query.category;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await EbRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$country",
          country: { $first: "$country" },
          approvals: { $sum: "$approvals" },
          denials: { $sum: "$denials" },
        },
      },
      { $sort: { approvals: -1 } },
      { $limit: limit },
      { $project: { _id: 0, country: 1, approvals: 1, denials: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/eb/perm-pipeline?employer=
router.get("/perm-pipeline", async (req, res) => {
  try {
    if (!req.query.employer) return res.status(400).json({ error: "employer param required" });
    const PERMRecord = require("../models/PERMRecord");
    const safe = req.query.employer.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const empMatch = { employer: new RegExp(safe, "i") };

    const [permData, ebData] = await Promise.all([
      PERMRecord.aggregate([
        { $match: { ...empMatch, caseStatus: "CERTIFIED" } },
        { $group: { _id: "$fiscalYear", certified: { $sum: "$approved" } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", permCertified: "$certified" } },
      ]),
      EbRecord.aggregate([
        { $match: { ...empMatch, ebCategory: { $in: ["EB1C", "EB2", "EB3"] } } },
        { $group: { _id: "$fiscalYear", approvals: { $sum: "$approvals" } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", ebApprovals: "$approvals" } },
      ]),
    ]);

    // Merge by year
    const byYear = {};
    permData.forEach((r) => { byYear[r.year] = { year: r.year, permCertified: r.permCertified, ebApprovals: 0 }; });
    ebData.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year, permCertified: 0, ebApprovals: r.ebApprovals };
      else byYear[r.year].ebApprovals = r.ebApprovals;
    });

    res.json(Object.values(byYear).sort((a, b) => a.year - b.year));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
