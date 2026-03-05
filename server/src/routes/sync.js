const express = require("express");
const router = express.Router();
const DataSyncLog = require("../models/DataSyncLog");

// GET /api/sync/status — last sync time per source
router.get("/status", async (req, res) => {
  try {
    const sources = ["USCIS_H1B", "DOL_LCA", "USCIS_L1", "ICE_SEVIS"];
    const statuses = await Promise.all(
      sources.map(async (source) => {
        const latest = await DataSyncLog.findOne({ source }).sort({ lastSyncAt: -1 });
        return {
          source,
          lastSyncAt: latest?.lastSyncAt || null,
          recordsInserted: latest?.recordsInserted || 0,
          status: latest?.status || "never",
        };
      })
    );
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
