import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import postgres from "postgres";
import Database from "better-sqlite3";
import * as schema from "./app/db/schema";
import { users } from "./app/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

const isPostgres = databaseUrl.startsWith("postgres");

let db: any;
let client: ReturnType<typeof postgres> | null = null;
if (isPostgres) {
  client = postgres(databaseUrl, {
    max: 1, // Only need one connection for seeding
  });
  db = drizzlePostgres(client, { schema });
} else {
  const sqliteUrl = databaseUrl.replace("file:", "");
  const sqlite = new Database(sqliteUrl);
  db = drizzleSqlite(sqlite, { schema });
}

const log = (message: string) => console.log(`ADMIN SEED: ${message}`);

async function main() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return;
  }

  try {
    const admin = await db.query.users.findFirst({
      where: eq(users.username, ADMIN_USERNAME),
    });

    if (admin) {
      log(`Admin user '${ADMIN_USERNAME}' already exists`);
      return;
    }

    log(`Seeding admin user '${ADMIN_USERNAME}'`);

    const now = new Date();
    await db.insert(users).values({
      username: ADMIN_USERNAME,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    log(`Admin user '${ADMIN_USERNAME}' created`);
  } catch (error: any) {
    // If the table doesn't exist, it means this is a fresh database
    // User needs to run db:push first
    if (
      error?.code === "SQLITE_ERROR" ||
      error?.message?.includes("does not exist")
    ) {
      log("Database tables not found. Run 'npm run db:push' first for new databases.");
      return;
    }
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("Error in seed-admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Close postgres connection if it exists
    if (client) {
      await client.end();
    }
    process.exit(0);
  });
