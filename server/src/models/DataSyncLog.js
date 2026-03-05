const mongoose = require("mongoose");

const DataSyncLogSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ["USCIS_H1B", "DOL_LCA", "USCIS_L1", "ICE_SEVIS", "DHS_YEARBOOK"],
    required: true,
  },
  lastSyncAt: { type: Date, default: Date.now },
  recordsInserted: { type: Number, default: 0 },
  status: { type: String, enum: ["success", "failed", "running"], default: "running" },
  error: { type: String, default: "" },
});

DataSyncLogSchema.index({ source: 1, lastSyncAt: -1 });

module.exports = mongoose.model("DataSyncLog", DataSyncLogSchema);
