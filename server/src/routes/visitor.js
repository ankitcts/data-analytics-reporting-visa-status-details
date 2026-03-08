const express = require("express");
const router = express.Router();
const VisitorVisaRecord = require("../models/VisitorVisaRecord");

// GET /api/visitor/stats?year=&country=&visaClass=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.visaClass) match.visaClass = req.query.visaClass;

    const [result] = await VisitorVisaRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalIssuances: { $sum: "$issuances" },
          totalRefusals: { $sum: "$refusals" },
        },
      },
      {
        $project: {
          _id: 0,
          totalIssuances: 1,
          totalRefusals: 1,
          overallRefusalRate: {
            $cond: [
              { $gt: [{ $add: ["$totalIssuances", "$totalRefusals"] }, 0] },
              {
                $multiply: [
                  { $divide: ["$totalRefusals", { $add: ["$totalIssuances", "$totalRefusals"] }] },
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

// GET /api/visitor/trends?country=&visaClass=
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.visaClass) match.visaClass = req.query.visaClass;

    const data = await VisitorVisaRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$fiscalYear",
          issuances: { $sum: "$issuances" },
          refusals: { $sum: "$refusals" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id",
          issuances: 1,
          refusals: 1,
          refusalRate: {
            $cond: [
              { $gt: [{ $add: ["$issuances", "$refusals"] }, 0] },
              { $multiply: [{ $divide: ["$refusals", { $add: ["$issuances", "$refusals"] }] }, 100] },
              0,
            ],
          },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/visitor/by-country?year=&limit=50&visaClass=
router.get("/by-country", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.visaClass) match.visaClass = req.query.visaClass;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await VisitorVisaRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$country",
          country: { $first: "$country" },
          issuances: { $sum: "$issuances" },
          refusals: { $sum: "$refusals" },
        },
      },
      {
        $addFields: {
          refusalRate: {
            $cond: [
              { $gt: [{ $add: ["$issuances", "$refusals"] }, 0] },
              { $multiply: [{ $divide: ["$refusals", { $add: ["$issuances", "$refusals"] }] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { issuances: -1 } },
      { $limit: limit },
      { $project: { _id: 0, country: 1, issuances: 1, refusals: 1, refusalRate: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/visitor/by-post?year=&limit=30
router.get("/by-post", async (req, res) => {
  try {
    const match = { consularPost: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);

    const data = await VisitorVisaRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$consularPost",
          consularPost: { $first: "$consularPost" },
          issuances: { $sum: "$issuances" },
          refusals: { $sum: "$refusals" },
        },
      },
      { $sort: { issuances: -1 } },
      { $limit: limit },
      { $project: { _id: 0, consularPost: 1, issuances: 1, refusals: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
