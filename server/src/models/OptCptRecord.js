const mongoose = require("mongoose");

const OptCptRecordSchema = new mongoose.Schema({
  quarter: { type: String, required: true },   // e.g. "2023-Q2"
  year: { type: Number, required: true, index: true },
  school: { type: String, default: "" },
  state: { type: String, default: "" },
  country: { type: String, default: "" },
  activeStudents: { type: Number, default: 0 },
  optCount: { type: Number, default: 0 },
  cptCount: { type: Number, default: 0 },
  stemOptCount: { type: Number, default: 0 },
  source: { type: String, default: "ICE_SEVIS" },
  importedAt: { type: Date, default: Date.now },
});

OptCptRecordSchema.index({ quarter: 1, school: 1, country: 1 }, { unique: true });
OptCptRecordSchema.index({ country: 1 });

module.exports = mongoose.model("OptCptRecord", OptCptRecordSchema);
