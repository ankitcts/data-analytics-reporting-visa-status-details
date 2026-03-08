const express = require("express");
const router = express.Router();
const O1Record = require("../models/O1Record");

// GET /api/o1/stats?year=&subType=&country=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.subType) match.subType = req.query.subType.toUpperCase();
    if (req.query.country) match.country = new RegExp(req.query.country, "i");

    const [result] = await O1Record.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalReceipts: { $sum: "$receipts" },
          totalApprovals: { $sum: "$approvals" },
          totalDenials: { $sum: "$denials" },
          totalRfe: { $sum: "$rfeIssued" },
        },
      },
      {
        $project: {
          _id: 0,
          totalReceipts: 1,
          totalApprovals: 1,
          totalDenials: 1,
          totalRfe: 1,
          approvalRate: {
            $cond: [
              { $gt: [{ $add: ["$totalApprovals", "$totalDenials"] }, 0] },
              { $multiply: [{ $divide: ["$totalApprovals", { $add: ["$totalApprovals", "$totalDenials"] }] }, 100] },
              0,
            ],
          },
          rfeRate: {
            $cond: [
              { $gt: ["$totalReceipts", 0] },
              { $multiply: [{ $divide: ["$totalRfe", "$totalReceipts"] }, 100] },
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

// GET /api/o1/trends?subType=
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.subType) match.subType = req.query.subType.toUpperCase();

    const data = await O1Record.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: "$fiscalYear", subType: "$subType" },
          approvals: { $sum: "$approvals" },
          denials: { $sum: "$denials" },
          receipts: { $sum: "$receipts" },
        },
      },
      { $sort: { "_id.year": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          subType: "$_id.subType",
          approvals: 1,
          denials: 1,
          receipts: 1,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/o1/countries?year=&subType=&limit=50
router.get("/countries", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.subType) match.subType = req.query.subType.toUpperCase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await O1Record.aggregate([
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

module.exports = router;
