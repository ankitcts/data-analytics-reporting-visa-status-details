const express = require("express");
const router = express.Router();
const OptCptRecord = require("../models/OptCptRecord");
const H1bRecord = require("../models/H1bRecord");
const PERMRecord = require("../models/PERMRecord");
const EbRecord = require("../models/EbRecord");

// GET /api/pipeline/f1-to-h1b?fromYear=&toYear=
// Joins OptCptRecord + H1bRecord by year to show F-1 → OPT → H-1B pipeline
router.get("/f1-to-h1b", async (req, res) => {
  try {
    const fromYear = parseInt(req.query.fromYear) || 2008;
    const toYear   = parseInt(req.query.toYear)   || 2026;

    const [optData, h1bData] = await Promise.all([
      OptCptRecord.aggregate([
        { $match: { year: { $gte: fromYear, $lte: toYear } } },
        {
          $group: {
            _id: "$year",
            activeStudents: { $sum: "$activeStudents" },
            optCount: { $sum: "$optCount" },
            stemOptCount: { $sum: "$stemOptCount" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", activeStudents: 1, optCount: 1, stemOptCount: 1 } },
      ]),
      H1bRecord.aggregate([
        { $match: { fiscalYear: { $gte: fromYear, $lte: toYear } } },
        {
          $group: {
            _id: "$fiscalYear",
            initialApprovals: { $sum: "$initialApprovals" },
            initialDenials: { $sum: "$initialDenials" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", h1bInitialApprovals: "$initialApprovals" } },
      ]),
    ]);

    // Merge by year
    const byYear = {};
    optData.forEach((r) => { byYear[r.year] = { year: r.year, ...r }; });
    h1bData.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { year: r.year };
      byYear[r.year].h1bInitialApprovals = r.h1bInitialApprovals;
    });

    res.json(Object.values(byYear).sort((a, b) => a.year - b.year));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/h1b-to-green-card?fromYear=&toYear=
// Joins H1bRecord + PERMRecord + EbRecord to show H-1B → PERM → EB pipeline
router.get("/h1b-to-green-card", async (req, res) => {
  try {
    const fromYear = parseInt(req.query.fromYear) || 2009;
    const toYear   = parseInt(req.query.toYear)   || 2026;

    const [h1bData, permData, ebData] = await Promise.all([
      H1bRecord.aggregate([
        { $match: { fiscalYear: { $gte: fromYear, $lte: toYear } } },
        { $group: { _id: "$fiscalYear", initialApprovals: { $sum: "$initialApprovals" } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", h1bApprovals: "$initialApprovals" } },
      ]),
      PERMRecord.aggregate([
        { $match: { fiscalYear: { $gte: fromYear, $lte: toYear } } },
        { $group: { _id: "$fiscalYear", certified: { $sum: "$approved" } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", permCertified: "$certified" } },
      ]),
      EbRecord.aggregate([
        { $match: { fiscalYear: { $gte: fromYear, $lte: toYear }, ebCategory: { $in: ["EB1", "EB1C", "EB2", "EB3"] } } },
        { $group: { _id: "$fiscalYear", approvals: { $sum: "$approvals" } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", ebApprovals: "$approvals" } },
      ]),
    ]);

    const byYear = {};
    h1bData.forEach((r) => { byYear[r.year] = { year: r.year, h1bApprovals: r.h1bApprovals, permCertified: 0, ebApprovals: 0 }; });
    permData.forEach((r) => { if (!byYear[r.year]) byYear[r.year] = { year: r.year, h1bApprovals: 0, ebApprovals: 0 }; byYear[r.year].permCertified = r.permCertified; });
    ebData.forEach((r) => { if (!byYear[r.year]) byYear[r.year] = { year: r.year, h1bApprovals: 0, permCertified: 0 }; byYear[r.year].ebApprovals = r.ebApprovals; });

    res.json(Object.values(byYear).sort((a, b) => a.year - b.year));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/compare?types=H1B,L1,PERM&year=&country=
// Side-by-side stats for multiple visa types
router.get("/compare", async (req, res) => {
  try {
    const types = (req.query.types || "H1B,L1,PERM").split(",").map((t) => t.trim().toUpperCase());
    const year = req.query.year ? parseInt(req.query.year) : null;

    const L1Record = require("../models/L1Record");
    const results = {};

    if (types.includes("H1B")) {
      const match = {};
      if (year) match.fiscalYear = year;
      const [r] = await H1bRecord.aggregate([
        { $match: match },
        { $group: { _id: null, approvals: { $sum: "$initialApprovals" }, denials: { $sum: "$initialDenials" } } },
        { $project: { _id: 0, approvals: 1, denials: 1, approvalRate: {
          $cond: [{ $gt: [{ $add: ["$approvals", "$denials"] }, 0] },
            { $multiply: [{ $divide: ["$approvals", { $add: ["$approvals", "$denials"] }] }, 100] }, 0]
        }}},
      ]);
      results.H1B = r || {};
    }

    if (types.includes("L1")) {
      const match = {};
      if (year) match.fiscalYear = year;
      const [r] = await L1Record.aggregate([
        { $match: match },
        { $group: { _id: null, approvals: { $sum: "$approvals" }, denials: { $sum: "$denials" } } },
        { $project: { _id: 0, approvals: 1, denials: 1, approvalRate: {
          $cond: [{ $gt: [{ $add: ["$approvals", "$denials"] }, 0] },
            { $multiply: [{ $divide: ["$approvals", { $add: ["$approvals", "$denials"] }] }, 100] }, 0]
        }}},
      ]);
      results.L1 = r || {};
    }

    if (types.includes("PERM")) {
      const match = {};
      if (year) match.fiscalYear = year;
      const [r] = await PERMRecord.aggregate([
        { $match: match },
        { $group: { _id: null, approvals: { $sum: "$approved" }, denials: { $sum: "$denied" }, totalCases: { $sum: "$totalCases" } } },
        { $project: { _id: 0, approvals: 1, denials: 1, totalCases: 1, approvalRate: {
          $cond: [{ $gt: ["$totalCases", 0] }, { $multiply: [{ $divide: ["$approvals", "$totalCases"] }, 100] }, 0]
        }}},
      ]);
      results.PERM = r || {};
    }

    if (types.includes("EB")) {
      const match = {};
      if (year) match.fiscalYear = year;
      const [r] = await EbRecord.aggregate([
        { $match: match },
        { $group: { _id: null, approvals: { $sum: "$approvals" }, denials: { $sum: "$denials" } } },
        { $project: { _id: 0, approvals: 1, denials: 1, approvalRate: {
          $cond: [{ $gt: [{ $add: ["$approvals", "$denials"] }, 0] },
            { $multiply: [{ $divide: ["$approvals", { $add: ["$approvals", "$denials"] }] }, 100] }, 0]
        }}},
      ]);
      results.EB = r || {};
    }

    res.json({ year, types, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
