const express = require("express");
const router = express.Router();
const ProcessingTimeRecord = require("../models/ProcessingTimeRecord");

// GET /api/processing/stats?year=&formType=&visaSubtype=
router.get("/stats", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);
    if (req.query.formType) match.formType = req.query.formType;
    if (req.query.visaSubtype) match.visaSubtype = new RegExp(req.query.visaSubtype, "i");

    const [result] = await ProcessingTimeRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avgProcessingDays: { $avg: "$avgProcessingDays" },
          medianDays: { $avg: "$medianDays" },
          completionRate: { $avg: "$completionRate" },
        },
      },
      {
        $project: {
          _id: 0,
          avgProcessingDays: { $round: ["$avgProcessingDays", 1] },
          medianDays: { $round: ["$medianDays", 1] },
          completionRate: { $round: ["$completionRate", 1] },
        },
      },
    ]);

    res.json(result || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/processing/by-form?year=
router.get("/by-form", async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);

    const data = await ProcessingTimeRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$formType",
          formType: { $first: "$formType" },
          avgProcessingDays: { $avg: "$avgProcessingDays" },
          medianDays: { $avg: "$medianDays" },
          completionRate: { $avg: "$completionRate" },
        },
      },
      { $sort: { avgProcessingDays: -1 } },
      {
        $project: {
          _id: 0,
          formType: 1,
          avgProcessingDays: { $round: ["$avgProcessingDays", 1] },
          medianDays: { $round: ["$medianDays", 1] },
          completionRate: { $round: ["$completionRate", 1] },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/processing/trends?formType=&visaSubtype=
router.get("/trends", async (req, res) => {
  try {
    const match = {};
    if (req.query.formType) match.formType = req.query.formType;
    if (req.query.visaSubtype) match.visaSubtype = new RegExp(req.query.visaSubtype, "i");

    const data = await ProcessingTimeRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: "$fiscalYear", formType: "$formType" },
          avgProcessingDays: { $avg: "$avgProcessingDays" },
          medianDays: { $avg: "$medianDays" },
        },
      },
      { $sort: { "_id.year": 1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          formType: "$_id.formType",
          avgProcessingDays: { $round: ["$avgProcessingDays", 1] },
          medianDays: { $round: ["$medianDays", 1] },
        },
      },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
