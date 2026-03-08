const mongoose = require("mongoose");

const EbRecordSchema = new mongoose.Schema({
  fiscalYear: { type: Number, required: true, index: true },
  ebCategory: {
    type: String,
    enum: ["EB1", "EB1A", "EB1B", "EB1C", "EB2", "EB2NIW", "EB3", "EB3W", "EB4", "EB5"],
    required: true,
  },
  employer: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  receipts: { type: Number, default: 0 },
  approvals: { type: Number, default: 0 },
  denials: { type: Number, default: 0 },
  pendingCount: { type: Number, default: 0 },
  petitionForm: {
    type: String,
    enum: ["I140", "I360", "I526", "I485"],
    default: "I140",
  },
  source: {
    type: String,
    enum: ["USCIS_I140", "DOL_PERM", "STATE_DEPT"],
    required: true,
  },
  importedAt: { type: Date, default: Date.now },
});

EbRecordSchema.index(
  { fiscalYear: 1, ebCategory: 1, employer: 1, country: 1, source: 1 },
  { unique: true }
);
EbRecordSchema.index({ employer: 1, fiscalYear: 1 });
EbRecordSchema.index({ country: 1 });
EbRecordSchema.index({ ebCategory: 1 });

module.exports = mongoose.model("EbRecord", EbRecordSchema);
