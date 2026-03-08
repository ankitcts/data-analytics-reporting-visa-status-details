const mongoose = require("mongoose");

const EmployerIndexSchema = new mongoose.Schema({
  normalizedName: { type: String, required: true, unique: true },
  displayName: { type: String, default: "" },
  aliases: { type: [String], default: [] },
  state: { type: String, default: "" },
  naicsCode: { type: String, default: "" },
  industry: { type: String, default: "" },
  visaTypes: { type: [String], default: [] },
  importedAt: { type: Date, default: Date.now },
});

EmployerIndexSchema.index({ displayName: "text", aliases: "text" });
EmployerIndexSchema.index({ visaTypes: 1 });

module.exports = mongoose.model("EmployerIndex", EmployerIndexSchema);
