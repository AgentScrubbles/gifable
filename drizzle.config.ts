import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const isPostgres = databaseUrl.startsWith("postgres");

export default {
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: {
    url: isPostgres ? databaseUrl : databaseUrl.replace("file:", ""),
  },
  verbose: true,
  strict: true,
} satisfies Config;
