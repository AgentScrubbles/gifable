import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import postgres from "postgres";
import Database from "better-sqlite3";
import * as schema from "~/db/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

type DrizzleDB = ReturnType<typeof drizzlePostgres<typeof schema>> | ReturnType<typeof drizzleSqlite<typeof schema>>;

let db: DrizzleDB;

declare global {
  var __db: DrizzleDB | undefined;
}

const isPostgres = databaseUrl.startsWith("postgres");
const enableLogging = process.env.DEBUG?.includes("db") || process.env.DEBUG?.includes("app:*");

// Singleton pattern - prevent multiple connections in development
if (process.env.NODE_ENV === "production") {
  if (isPostgres) {
    const client = postgres(databaseUrl);
    db = drizzlePostgres(client, { schema, logger: enableLogging });
  } else {
    const sqliteUrl = databaseUrl.replace("file:", "");
    const sqlite = new Database(sqliteUrl);
    db = drizzleSqlite(sqlite, { schema, logger: enableLogging });
  }
} else {
  if (!global.__db) {
    if (isPostgres) {
      const client = postgres(databaseUrl);
      global.__db = drizzlePostgres(client, { schema, logger: enableLogging });
    } else {
      const sqliteUrl = databaseUrl.replace("file:", "");
      const sqlite = new Database(sqliteUrl);
      global.__db = drizzleSqlite(sqlite, { schema, logger: enableLogging });
    }
  }
  db = global.__db;
}

export { db };
