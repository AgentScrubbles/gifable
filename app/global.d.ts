import type { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import type { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import type * as schema from "~/db/schema";

type DrizzleDB = ReturnType<typeof drizzlePostgres<typeof schema>> | ReturnType<typeof drizzleSqlite<typeof schema>>;

declare global {
  var __stroage: FileStorage | undefined;
  var __db: DrizzleDB | undefined;
}
