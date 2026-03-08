const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { connectDatabase } = require("./src/db");
const h1bRouter = require("./src/routes/h1b");
const l1Router = require("./src/routes/l1");
const optcptRouter = require("./src/routes/optcpt");
const faqRouter = require("./src/routes/faq");
const syncRouter = require("./src/routes/sync");
const h4eadRouter = require("./src/routes/h4ead");
const ebRouter = require("./src/routes/eb");
const permRouter = require("./src/routes/perm");
const o1Router = require("./src/routes/o1");
const visitorRouter = require("./src/routes/visitor");
const processingRouter = require("./src/routes/processingTimes");
const companyRouter = require("./src/routes/company");
const pipelineRouter = require("./src/routes/pipeline");
const { startScheduler } = require("./src/scheduler/weeklySync");

dotenv.config({ path: require("path").join(__dirname, "../.env") });

const app = express();
const port = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "visa-analytics-api", timestamp: new Date() });
});

app.use("/api/h1b", h1bRouter);
app.use("/api/l1", l1Router);
app.use("/api/optcpt", optcptRouter);
app.use("/api/faq", faqRouter);
app.use("/api/sync", syncRouter);
app.use("/api/h4ead", h4eadRouter);
app.use("/api/eb", ebRouter);
app.use("/api/perm", permRouter);
app.use("/api/o1", o1Router);
app.use("/api/visitor", visitorRouter);
app.use("/api/processing", processingRouter);
app.use("/api/company", companyRouter);
app.use("/api/pipeline", pipelineRouter);

// Serve frontend in production
const publicDir = path.join(__dirname, "../client/public");
app.use(express.static(publicDir));
app.get("*splat", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

async function start() {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Visa Analytics API listening on http://localhost:${port}`);
  });
  startScheduler();
}

start().catch((error) => {
  console.error("Failed to start API:", error.message);
  process.exit(1);
});
