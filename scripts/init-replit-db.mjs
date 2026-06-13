import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const schemaPath = path.join(rootDir, "server", "schema.sql");
const databaseUrl = process.env.DATABASE_URL || process.env.LOVABLE_DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Create/attach a Replit Database first, then run this again.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === "true" || databaseUrl.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : databaseUrl.includes("sslmode=disable")
        ? false
        : undefined,
});

try {
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
  console.log("Replit database schema is ready.");
} finally {
  await pool.end();
}
