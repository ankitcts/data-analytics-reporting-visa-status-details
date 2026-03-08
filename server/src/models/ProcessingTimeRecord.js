const mongoose = require("mongoose");

const ProcessingTimeRecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  quarter: { type: String, default: "" },
  formType: {
    type: String,
    enum: ["I129", "I140", "I765", "I539", "I485", "I131"],
    required: true,
  },
  visaSubtype: { type: String, default: "" },
  avgProcessingDays: { type: Number, default: 0 },
  medianDays: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  source: { type: String, default: "USCIS_HISTORIC_PT", required: true },
  importedAt: { type: Date, default: Date.now },
});

ProcessingTimeRecordSchema.index(
  { fiscalYear: 1, quarter: 1, formType: 1, visaSubtype: 1 },
  { unique: true }
);

module.exports = mongoose.model("ProcessingTimeRecord", ProcessingTimeRecordSchema);
