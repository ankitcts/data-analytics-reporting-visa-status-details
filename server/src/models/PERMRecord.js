const mongoose = require("mongoose");

const PERMRecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  quarter: { type: String, default: "" },
  employer: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  city: { type: String, default: "" },
  jobTitle: { type: String, default: "" },
  naicsCode: { type: String, default: "" },
  socCode: { type: String, default: "" },
  wageUnit: { type: String, default: "" },
  wageOffered: { type: Number, default: 0 },
  prevailingWage: { type: Number, default: 0 },
  caseStatus: {
    type: String,
    enum: ["CERTIFIED", "DENIED", "WITHDRAWN", "AUDIT_FAIL", "PENDING"],
  },
  totalCases: { type: Number, default: 0 },
  approved: { type: Number, default: 0 },
  denied: { type: Number, default: 0 },
  withdrawn: { type: Number, default: 0 },
  source: { type: String, default: "DOL_PERM", required: true },
  importedAt: { type: Date, default: Date.now },
});

PERMRecordSchema.index(
  { fiscalYear: 1, quarter: 1, employer: 1, country: 1, caseStatus: 1 },
  { unique: true }
);
PERMRecordSchema.index({ employer: 1, fiscalYear: 1 });
PERMRecordSchema.index({ state: 1 });
PERMRecordSchema.index({ country: 1 });
PERMRecordSchema.index({ caseStatus: 1 });

module.exports = mongoose.model("PERMRecord", PERMRecordSchema);
