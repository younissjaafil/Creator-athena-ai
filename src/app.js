const express = require("express");
const cors = require("cors");
const creatorRoutes = require("./routes/creatorRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/status", (req, res) =>
  res.json({
    service: "Creator Athena Microservice",
    status: "Microservice is running successfully",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  })
);

app.use("/creator", creatorRoutes);

module.exports = app;
