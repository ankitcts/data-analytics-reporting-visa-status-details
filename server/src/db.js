const mongoose = require("mongoose");

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "visaAnalytics";
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");
  await mongoose.connect(uri, { dbName });
  isConnected = true;
  console.log(`Connected to MongoDB database: ${dbName}`);
}

module.exports = { connectDatabase };
