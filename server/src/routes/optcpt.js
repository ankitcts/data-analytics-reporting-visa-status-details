const express = require("express");
const router = express.Router();
const OptCptRecord = require("../models/OptCptRecord");

// GET /api/optcpt/stats?year=&country=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.year) {
      // quarter format: "2023-Q1" — match by year prefix
      match.quarter = new RegExp(`^${req.query.year}`);
    }

    const [result] = await OptCptRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalActiveStudents: { $sum: "$activeStudents" },
          totalOpt: { $sum: "$optCount" },
          totalCpt: { $sum: "$cptCount" },
          totalStemOpt: { $sum: "$stemOptCount" },
          schoolCount: { $addToSet: "$school" },
        },
      },
      {
        $project: {
          _id: 0,
          totalActiveStudents: 1,
          totalOpt: 1,
          totalCpt: 1,
          totalStemOpt: 1,
          uniqueSchools: { $size: "$schoolCount" },
        },
      },
    ]);

    res.json(result || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/optcpt/trends
router.get("/trends", async (req, res) => {
  try {
    const data = await OptCptRecord.aggregate([
      {
        $group: {
          _id: "$quarter",
          activeStudents: { $sum: "$activeStudents" },
          optCount: { $sum: "$optCount" },
          cptCount: { $sum: "$cptCount" },
          stemOptCount: { $sum: "$stemOptCount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          quarter: "$_id",
          activeStudents: 1,
          optCount: 1,
          cptCount: 1,
          stemOptCount: 1,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/optcpt/schools?year=&limit=20
router.get("/schools", async (req, res) => {
  try {
    const match = { school: { $ne: "" } };
    if (req.query.year) match.quarter = new RegExp(`^${req.query.year}`);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const data = await OptCptRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$school",
          school: { $first: "$school" },
          state: { $first: "$state" },
          activeStudents: { $sum: "$activeStudents" },
          optCount: { $sum: "$optCount" },
          cptCount: { $sum: "$cptCount" },
          stemOptCount: { $sum: "$stemOptCount" },
        },
      },
      { $sort: { activeStudents: -1 } },
      { $limit: limit },
      { $project: { _id: 0, school: 1, state: 1, activeStudents: 1, optCount: 1, cptCount: 1, stemOptCount: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/optcpt/countries?year=&limit=50
router.get("/countries", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.quarter = new RegExp(`^${req.query.year}`);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await OptCptRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$country",
          country: { $first: "$country" },
          activeStudents: { $sum: "$activeStudents" },
          optCount: { $sum: "$optCount" },
          stemOptCount: { $sum: "$stemOptCount" },
        },
      },
      { $sort: { activeStudents: -1 } },
      { $limit: limit },
      { $project: { _id: 0, country: 1, activeStudents: 1, optCount: 1, stemOptCount: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
