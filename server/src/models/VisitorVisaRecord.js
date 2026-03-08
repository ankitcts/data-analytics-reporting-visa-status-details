const mongoose = require("mongoose");

const VisitorVisaRecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  month: { type: Number, default: 0 },
  consularPost: { type: String, default: "" },
  country: { type: String, default: "" },
  nationality: { type: String, default: "" },
  issuances: { type: Number, default: 0 },
  refusals: { type: Number, default: 0 },
  refusalRate: { type: Number, default: 0 },
  visaClass: { type: String, enum: ["B1", "B2", "B1B2"], required: true },
  source: { type: String, default: "STATE_DEPT_NIV", required: true },
  importedAt: { type: Date, default: Date.now },
});

VisitorVisaRecordSchema.index(
  { fiscalYear: 1, month: 1, consularPost: 1, country: 1, visaClass: 1 },
  { unique: true }
);
VisitorVisaRecordSchema.index({ country: 1 });
VisitorVisaRecordSchema.index({ consularPost: 1 });

module.exports = mongoose.model("VisitorVisaRecord", VisitorVisaRecordSchema);
