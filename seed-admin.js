"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// seed-admin.ts
var import_postgres_js = require("drizzle-orm/postgres-js");
var import_better_sqlite3 = require("drizzle-orm/better-sqlite3");
var import_postgres = __toESM(require("postgres"));
var import_better_sqlite32 = __toESM(require("better-sqlite3"));

// app/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  media: () => media,
  mediaRelations: () => mediaRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var import_sqlite_core = require("drizzle-orm/sqlite-core");
var _a;
var isPostgres = (_a = process.env.DATABASE_URL) == null ? void 0 : _a.startsWith("postgres");
var pgUsers = (0, import_pg_core.pgTable)("User", {
  id: (0, import_pg_core.text)("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: (0, import_pg_core.timestamp)("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updatedAt", { mode: "date" }).defaultNow().notNull(),
  username: (0, import_pg_core.text)("username").unique().notNull(),
  passwordHash: (0, import_pg_core.text)("passwordHash").notNull(),
  isAdmin: (0, import_pg_core.boolean)("isAdmin").default(false).notNull(),
  lastLogin: (0, import_pg_core.timestamp)("lastLogin", { mode: "date" }),
  apiToken: (0, import_pg_core.text)("apiToken"),
  preferredLabels: (0, import_pg_core.text)("preferredLabels"),
  theme: (0, import_pg_core.text)("theme")
});
var pgMedia = (0, import_pg_core.pgTable)("Media", {
  id: (0, import_pg_core.text)("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: (0, import_pg_core.timestamp)("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: (0, import_pg_core.timestamp)("updatedAt", { mode: "date" }).defaultNow().notNull(),
  url: (0, import_pg_core.text)("url").notNull(),
  thumbnailUrl: (0, import_pg_core.text)("thumbnailUrl"),
  fileHash: (0, import_pg_core.text)("fileHash"),
  labels: (0, import_pg_core.text)("labels"),
  altText: (0, import_pg_core.text)("altText"),
  width: (0, import_pg_core.integer)("width"),
  height: (0, import_pg_core.integer)("height"),
  color: (0, import_pg_core.text)("color"),
  size: (0, import_pg_core.integer)("size"),
  isPublic: (0, import_pg_core.boolean)("isPublic").default(true).notNull(),
  userId: (0, import_pg_core.text)("userId").notNull().references(() => pgUsers.id, { onDelete: "cascade" })
});
var sqliteUsers = (0, import_sqlite_core.sqliteTable)("User", {
  id: (0, import_sqlite_core.text)("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: (0, import_sqlite_core.integer)("createdAt", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updatedAt", { mode: "timestamp" }).defaultNow().notNull(),
  username: (0, import_sqlite_core.text)("username").unique().notNull(),
  passwordHash: (0, import_sqlite_core.text)("passwordHash").notNull(),
  isAdmin: (0, import_sqlite_core.integer)("isAdmin", { mode: "boolean" }).default(false).notNull(),
  lastLogin: (0, import_sqlite_core.integer)("lastLogin", { mode: "timestamp" }),
  apiToken: (0, import_sqlite_core.text)("apiToken"),
  preferredLabels: (0, import_sqlite_core.text)("preferredLabels"),
  theme: (0, import_sqlite_core.text)("theme")
});
var sqliteMedia = (0, import_sqlite_core.sqliteTable)("Media", {
  id: (0, import_sqlite_core.text)("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: (0, import_sqlite_core.integer)("createdAt", { mode: "timestamp" }).defaultNow().notNull(),
  updatedAt: (0, import_sqlite_core.integer)("updatedAt", { mode: "timestamp" }).defaultNow().notNull(),
  url: (0, import_sqlite_core.text)("url").notNull(),
  thumbnailUrl: (0, import_sqlite_core.text)("thumbnailUrl"),
  fileHash: (0, import_sqlite_core.text)("fileHash"),
  labels: (0, import_sqlite_core.text)("labels"),
  altText: (0, import_sqlite_core.text)("altText"),
  width: (0, import_sqlite_core.integer)("width"),
  height: (0, import_sqlite_core.integer)("height"),
  color: (0, import_sqlite_core.text)("color"),
  size: (0, import_sqlite_core.integer)("size"),
  isPublic: (0, import_sqlite_core.integer)("isPublic", { mode: "boolean" }).default(true).notNull(),
  userId: (0, import_sqlite_core.text)("userId").notNull().references(() => sqliteUsers.id, { onDelete: "cascade" })
});
var users = isPostgres ? pgUsers : sqliteUsers;
var media = isPostgres ? pgMedia : sqliteMedia;
var usersRelations = (0, import_drizzle_orm.relations)(users, ({ many }) => ({
  medias: many(media)
}));
var mediaRelations = (0, import_drizzle_orm.relations)(media, ({ one }) => ({
  user: one(users, {
    fields: [media.userId],
    references: [users.id]
  })
}));

// seed-admin.ts
var import_drizzle_orm2 = require("drizzle-orm");
var import_bcryptjs = __toESM(require("bcryptjs"));
var dotenv = __toESM(require("dotenv"));
dotenv.config();
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}
var isPostgres2 = databaseUrl.startsWith("postgres");
var db;
if (isPostgres2) {
  const client = (0, import_postgres.default)(databaseUrl);
  db = (0, import_postgres_js.drizzle)(client, { schema: schema_exports });
} else {
  const sqliteUrl = databaseUrl.replace("file:", "");
  const sqlite = new import_better_sqlite32.default(sqliteUrl);
  db = (0, import_better_sqlite3.drizzle)(sqlite, { schema: schema_exports });
}
var log = (message) => console.log(`ADMIN SEED: ${message}`);
async function main() {
  var _a2;
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return;
  }
  try {
    const admin = await db.query.users.findFirst({
      where: (0, import_drizzle_orm2.eq)(users.username, ADMIN_USERNAME)
    });
    if (admin) {
      log(`Admin user '${ADMIN_USERNAME}' already exists`);
      return;
    }
    log(`Seeding admin user '${ADMIN_USERNAME}'`);
    const now = new Date();
    await db.insert(users).values({
      username: ADMIN_USERNAME,
      passwordHash: await import_bcryptjs.default.hash(ADMIN_PASSWORD, 10),
      isAdmin: true,
      createdAt: now,
      updatedAt: now
    });
    log(`Admin user '${ADMIN_USERNAME}' created`);
  } catch (error) {
    if ((error == null ? void 0 : error.code) === "SQLITE_ERROR" || ((_a2 = error == null ? void 0 : error.message) == null ? void 0 : _a2.includes("does not exist"))) {
      log("Database tables not found. Run 'npm run db:push' first for new databases.");
      return;
    }
    throw error;
  }
}
main().catch((e) => {
  console.error("Error in seed-admin:", e);
  process.exit(1);
}).finally(() => {
  process.exit(0);
});
