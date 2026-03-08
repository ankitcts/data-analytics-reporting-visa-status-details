const express = require("express");
const router = express.Router();
const PERMRecord = require("../models/PERMRecord");

// GET /api/perm/stats?year=&state=&country=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.state) match.state = new RegExp(req.query.state, "i");
    if (req.query.country) match.country = new RegExp(req.query.country, "i");

    const [result] = await PERMRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCases: { $sum: "$totalCases" },
          totalApproved: { $sum: "$approved" },
          totalDenied: { $sum: "$denied" },
          totalWithdrawn: { $sum: "$withdrawn" },
        },
      },
      {
        $project: {
          _id: 0,
          totalCases: 1,
          totalApproved: 1,
          totalDenied: 1,
          totalWithdrawn: 1,
          certificationRate: {
            $cond: [
              { $gt: ["$totalCases", 0] },
              { $multiply: [{ $divide: ["$totalApproved", "$totalCases"] }, 100] },
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

// GET /api/perm/trends
router.get("/trends", async (req, res) => {
  try {
    const data = await PERMRecord.aggregate([
      {
        $group: {
          _id: "$fiscalYear",
          totalCases: { $sum: "$totalCases" },
          certified: { $sum: "$approved" },
          denied: { $sum: "$denied" },
          withdrawn: { $sum: "$withdrawn" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id",
          totalCases: 1,
          certified: 1,
          denied: 1,
          withdrawn: 1,
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/perm/employers?year=&search=&page=1&limit=50&sort=certified
router.get("/employers", async (req, res) => {
  try {
    const match = { employer: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.state) match.state = new RegExp(req.query.state, "i");
    if (req.query.country) match.country = new RegExp(req.query.country, "i");
    if (req.query.search) match.employer = new RegExp(req.query.search.trim(), "i");

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);
    const skip  = (page - 1) * limit;
    const sortField = req.query.sort === "denied" ? "denied"
                    : req.query.sort === "total" ? "totalCases"
                    : "certified";

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$employer",
          employer: { $first: "$employer" },
          state: { $first: "$state" },
          totalCases: { $sum: "$totalCases" },
          certified: { $sum: "$approved" },
          denied: { $sum: "$denied" },
          withdrawn: { $sum: "$withdrawn" },
        },
      },
      {
        $addFields: {
          certificationRate: {
            $cond: [
              { $gt: ["$totalCases", 0] },
              { $multiply: [{ $divide: ["$certified", "$totalCases"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { [sortField]: -1 } },
    ];

    const [countResult] = await PERMRecord.aggregate([...pipeline, { $count: "total" }]);
    const total = countResult ? countResult.total : 0;

    pipeline.push({ $skip: skip }, { $limit: limit });
    pipeline.push({
      $project: {
        _id: 0, employer: 1, state: 1, totalCases: 1, certified: 1, denied: 1, withdrawn: 1, certificationRate: 1,
      },
    });

    const data = await PERMRecord.aggregate(pipeline);
    res.json({ page, limit, total, pages: Math.ceil(total / limit), data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/perm/employer-suggest?q=
router.get("/employer-suggest", async (req, res) => {
  try {
    if (!req.query.q || req.query.q.trim().length < 2) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const safe  = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = await PERMRecord.distinct("employer", { employer: new RegExp(safe, "i") });
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

// GET /api/perm/states?year=
router.get("/states", async (req, res) => {
  try {
    const match = { state: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);

    const data = await PERMRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$state",
          state: { $first: "$state" },
          totalCases: { $sum: "$totalCases" },
          certified: { $sum: "$approved" },
        },
      },
      { $sort: { certified: -1 } },
      { $project: { _id: 0, state: 1, totalCases: 1, certified: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/perm/countries?year=&limit=50
router.get("/countries", async (req, res) => {
  try {
    const match = { country: { $ne: "" } };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const data = await PERMRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$country",
          country: { $first: "$country" },
          totalCases: { $sum: "$totalCases" },
          certified: { $sum: "$approved" },
        },
      },
      { $sort: { certified: -1 } },
      { $limit: limit },
      { $project: { _id: 0, country: 1, totalCases: 1, certified: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
