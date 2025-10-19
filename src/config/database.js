const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.POSTGRES_DB,
  ssl: {
    rejectUnauthorized: false, // Required for cloud deployments (Railway)
  },
});

// Connection monitoring
pool.on("connect", () => {
  console.log("✅ Database connected successfully");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database error:", err);
  process.exit(-1);
});

module.exports = pool;
