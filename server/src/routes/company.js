const express = require("express");
const router = express.Router();
const H1bRecord = require("../models/H1bRecord");
const L1Record = require("../models/L1Record");
const PERMRecord = require("../models/PERMRecord");
const EbRecord = require("../models/EbRecord");
const O1Record = require("../models/O1Record");
const EmployerIndex = require("../models/EmployerIndex");

function buildMatch(name) {
  const safe = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { employer: new RegExp(safe, "i") };
}

async function queryWithTimeout(Model, pipeline, timeoutMs = 5000) {
  return Model.aggregate(pipeline).option({ maxTimeMS: timeoutMs });
}

// GET /api/company/:name/summary
router.get("/:name/summary", async (req, res) => {
  try {
    const name = req.params.name;
    const match = buildMatch(name);

    const [h1bData, l1Data, permData, ebData, o1Data] = await Promise.all([
      queryWithTimeout(H1bRecord, [
        { $match: match },
        { $group: {
            _id: "$fiscalYear",
            fiscalYear: { $first: "$fiscalYear" },
            initialApprovals: { $sum: "$initialApprovals" },
            continuingApprovals: { $sum: "$continuingApprovals" },
            initialDenials: { $sum: "$initialDenials" },
            source: { $first: "$source" },
        }},
        { $sort: { _id: 1 } },
        { $project: { _id: 0, fiscalYear: 1, initialApprovals: 1, continuingApprovals: 1, initialDenials: 1, source: 1 } },
      ]),
      queryWithTimeout(L1Record, [
        { $match: match },
        { $group: {
            _id: { year: "$fiscalYear", type: "$visaType" },
            approvals: { $sum: "$approvals" },
            denials: { $sum: "$denials" },
        }},
        { $sort: { "_id.year": 1 } },
        { $project: { _id: 0, year: "$_id.year", visaType: "$_id.type", approvals: 1, denials: 1 } },
      ]),
      queryWithTimeout(PERMRecord, [
        { $match: match },
        { $group: {
            _id: "$fiscalYear",
            certified: { $sum: "$approved" },
            denied: { $sum: "$denied" },
            totalCases: { $sum: "$totalCases" },
        }},
        { $sort: { _id: 1 } },
        { $project: { _id: 0, year: "$_id", certified: 1, denied: 1, totalCases: 1 } },
      ]),
      queryWithTimeout(EbRecord, [
        { $match: match },
        { $group: {
            _id: { year: "$fiscalYear", cat: "$ebCategory" },
            approvals: { $sum: "$approvals" },
            denials: { $sum: "$denials" },
        }},
        { $sort: { "_id.year": 1 } },
        { $project: { _id: 0, year: "$_id.year", ebCategory: "$_id.cat", approvals: 1, denials: 1 } },
      ]),
      queryWithTimeout(O1Record, [
        { $match: match },
        { $group: {
            _id: { year: "$fiscalYear", type: "$subType" },
            approvals: { $sum: "$approvals" },
            denials: { $sum: "$denials" },
        }},
        { $sort: { "_id.year": 1 } },
        { $project: { _id: 0, year: "$_id.year", subType: "$_id.type", approvals: 1, denials: 1 } },
      ]),
    ]);

    // Cross-visa link flags
    const crossVisaLinks = {
      hasPermData: permData.length > 0,
      hasEbData: ebData.length > 0,
      hasL1Data: l1Data.length > 0,
      hasO1Data: o1Data.length > 0,
    };

    res.json({
      employer: name,
      crossVisaLinks,
      h1b: h1bData,
      l1: l1Data,
      perm: permData,
      eb: ebData,
      o1: o1Data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/company/:name/visas?year=&type=&page=&limit=
router.get("/:name/visas", async (req, res) => {
  try {
    const name = req.params.name;
    const match = { ...buildMatch(name) };
    if (req.query.year) match.fiscalYear = parseInt(req.query.year);

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const skip  = (page - 1) * limit;

    const type = (req.query.type || "h1b").toLowerCase();
    let Model = H1bRecord;
    if (type === "l1") Model = L1Record;
    else if (type === "perm") Model = PERMRecord;
    else if (type === "eb") Model = EbRecord;
    else if (type === "o1") Model = O1Record;

    const [total] = await Model.aggregate([{ $match: match }, { $count: "total" }]);
    const data = await Model.find(match).skip(skip).limit(limit).lean();

    res.json({ page, limit, total: total ? total.total : 0, pages: Math.ceil((total ? total.total : 0) / limit), data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/search/employers?q=&limit=10
router.get("/search/employers", async (req, res) => {
  try {
    if (!req.query.q || req.query.q.trim().length < 2) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    const q = req.query.q.trim();

    // Try text search on EmployerIndex first
    const textResults = await EmployerIndex.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" }, displayName: 1, normalizedName: 1, visaTypes: 1 }
    ).sort({ score: { $meta: "textScore" } }).limit(limit).lean();

    if (textResults.length > 0) {
      return res.json(textResults.map((r) => ({
        name: r.displayName,
        normalizedName: r.normalizedName,
        visaTypes: r.visaTypes,
      })));
    }

    // Fallback: regex search in H1bRecord
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = await H1bRecord.distinct("employer", {
      employer: new RegExp(safe, "i"),
      source: "USCIS_HUB",
    });
    const re = new RegExp(`^${safe}`, "i");
    names.sort((a, b) => (re.test(a) ? 0 : 1) - (re.test(b) ? 0 : 1) || a.localeCompare(b));
    res.json(names.slice(0, limit).map((n) => ({ name: n, visaTypes: ["H1B"] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
