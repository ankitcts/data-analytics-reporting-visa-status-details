const mongoose = require("mongoose");

const O1RecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  subType: { type: String, enum: ["O1A", "O1B", "O1"], required: true },
  employer: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  receipts: { type: Number, default: 0 },
  approvals: { type: Number, default: 0 },
  denials: { type: Number, default: 0 },
  rfeIssued: { type: Number, default: 0 },
  pending: { type: Number, default: 0 },
  source: {
    type: String,
    enum: ["USCIS_I129", "USCIS_I129_O1"],
    required: true,
  },
  importedAt: { type: Date, default: Date.now },
});

O1RecordSchema.index(
  { fiscalYear: 1, subType: 1, employer: 1, country: 1 },
  { unique: true }
);
O1RecordSchema.index({ employer: 1, fiscalYear: 1 });
O1RecordSchema.index({ country: 1 });

module.exports = mongoose.model("O1Record", O1RecordSchema);
