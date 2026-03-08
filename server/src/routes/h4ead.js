const express = require("express");
const router = express.Router();
const H4EadRecord = require("../models/H4EadRecord");

// GET /api/h4ead/stats?year=&category=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.category) match.eligibilityCategory = req.query.category;

    const [result] = await H4EadRecord.aggregate([
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

// GET /api/h4ead/trends?category=
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.category) match.eligibilityCategory = req.query.category;

    const data = await H4EadRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: "$fiscalYear", category: "$eligibilityCategory" },
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
          category: "$_id.category",
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

// GET /api/h4ead/processing-times?year=
router.get("/processing-times", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);

    const data = await H4EadRecord.aggregate([
      { $match: { ...match, avgProcessingDays: { $gt: 0 } } },
      {
        $group: {
          _id: { year: "$fiscalYear", category: "$eligibilityCategory" },
          avgProcessingDays: { $avg: "$avgProcessingDays" },
        },
      },
      { $sort: { "_id.year": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          category: "$_id.category",
          avgProcessingDays: { $round: ["$avgProcessingDays", 1] },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
