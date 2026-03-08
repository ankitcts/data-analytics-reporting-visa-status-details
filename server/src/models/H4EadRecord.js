const mongoose = require("mongoose");

const H4EadRecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  quarter: { type: String, default: "" },
  eligibilityCategory: {
    type: String,
    enum: ["H4_EAD", "H4_EXTENSION", "H4_CHANGE_STATUS"],
    required: true,
  },
  receipts: { type: Number, default: 0 },
  approvals: { type: Number, default: 0 },
  denials: { type: Number, default: 0 },
  pendingCount: { type: Number, default: 0 },
  avgProcessingDays: { type: Number, default: 0 },
  country: { type: String, default: "" },
  source: {
    type: String,
    enum: ["USCIS_I765", "USCIS_I539"],
    required: true,
  },
  importedAt: { type: Date, default: Date.now },
});

H4EadRecordSchema.index(
  { fiscalYear: 1, quarter: 1, eligibilityCategory: 1, source: 1 },
  { unique: true }
);
H4EadRecordSchema.index({ eligibilityCategory: 1 });

module.exports = mongoose.model("H4EadRecord", H4EadRecordSchema);
