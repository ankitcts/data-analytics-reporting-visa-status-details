const mongoose = require("mongoose");

const H1bRecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  employer: { type: String, default: "" },
  industry: { type: String, default: "" },
  state: { type: String, default: "" },
  city: { type: String, default: "" },
  country: { type: String, default: "" },
  initialApprovals: { type: Number, default: 0 },
  initialDenials: { type: Number, default: 0 },
  continuingApprovals: { type: Number, default: 0 },
  continuingDenials: { type: Number, default: 0 },
  rfeIssued: { type: Number, default: 0 },
  rfeDecisionApproved: { type: Number, default: 0 },
  rfeDecisionDenied: { type: Number, default: 0 },
  source: { type: String, enum: ["USCIS_HUB", "DOL_LCA", "DHS_YEARBOOK"], required: true },
  importedAt: { type: Date, default: Date.now },
});

// Unique per employer+state+year (USCIS CSV has one row per employer per city/state)
H1bRecordSchema.index({ fiscalYear: 1, employer: 1, state: 1 }, { unique: true });
H1bRecordSchema.index({ country: 1 });
H1bRecordSchema.index({ state: 1 });

module.exports = mongoose.model("H1bRecord", H1bRecordSchema);
