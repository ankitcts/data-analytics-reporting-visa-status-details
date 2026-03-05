const express = require("express");
const router = express.Router();
const L1Record = require("../models/L1Record");

// GET /api/l1/stats?year=&type=&country=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.type) match.visaType = req.query.type.toUpperCase();
    if (req.query.country) match.country = new RegExp(req.query.country, "i");

    const [result] = await L1Record.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalApprovals: { $sum: "$approvals" },
          totalDenials: { $sum: "$denials" },
          uniqueEmployers: { $addToSet: "$employer" },
        },
      },
      {
        $project: {
          _id: 0,
          totalApprovals: 1,
          totalDenials: 1,
          uniqueEmployers: { $size: "$uniqueEmployers" },
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

// GET /api/l1/trends?type=
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.type) match.visaType = req.query.type.toUpperCase();

    const data = await L1Record.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: "$fiscalYear", visaType: "$visaType" },
          approvals: { $sum: "$approvals" },
          denials: { $sum: "$denials" },
        },
      },
      { $sort: { "_id.year": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          visaType: "$_id.visaType",
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

// GET /api/l1/countries?year=&type=
router.get("/countries", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.type) match.visaType = req.query.type.toUpperCase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await L1Record.aggregate([
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
