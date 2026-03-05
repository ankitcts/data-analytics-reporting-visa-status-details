const mongoose = require("mongoose");

const L1RecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  visaType: { type: String, enum: ["L1A", "L1B", "L1"], required: true },
  employer: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  approvals: { type: Number, default: 0 },
  denials: { type: Number, default: 0 },
  rfeIssued: { type: Number, default: 0 },
  source: { type: String, default: "USCIS_I129" },
  importedAt: { type: Date, default: Date.now },
});

L1RecordSchema.index({ fiscalYear: 1, visaType: 1, country: 1 }, { unique: true });
L1RecordSchema.index({ country: 1 });

module.exports = mongoose.model("L1Record", L1RecordSchema);
