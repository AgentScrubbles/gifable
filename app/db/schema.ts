import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import {
  sqliteTable,
  text as sqliteText,
  integer as sqliteInt,
} from "drizzle-orm/sqlite-core";

// Determine which database we're using
const isPostgres = process.env.DATABASE_URL?.startsWith("postgres");

// PostgreSQL Schema
const pgUsers = pgTable("User", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  username: text("username").unique().notNull(),
  passwordHash: text("passwordHash").notNull(),
  isAdmin: boolean("isAdmin").default(false).notNull(),
  lastLogin: timestamp("lastLogin", { mode: "date" }),
  apiToken: text("apiToken"),
  preferredLabels: text("preferredLabels"),
  theme: text("theme"),
});

const pgMedia = pgTable("Media", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  fileHash: text("fileHash"),
  labels: text("labels"),
  altText: text("altText"),
  width: integer("width"),
  height: integer("height"),
  color: text("color"),
  size: integer("size"),
  isPublic: boolean("isPublic").default(true).notNull(),
  userId: text("userId")
    .notNull()
    .references(() => pgUsers.id, { onDelete: "cascade" }),
});

// SQLite Schema
const sqliteUsers = sqliteTable("User", {
  id: sqliteText("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: sqliteInt("createdAt", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
  updatedAt: sqliteInt("updatedAt", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
  username: sqliteText("username").unique().notNull(),
  passwordHash: sqliteText("passwordHash").notNull(),
  isAdmin: sqliteInt("isAdmin", { mode: "boolean" }).default(false).notNull(),
  lastLogin: sqliteInt("lastLogin", { mode: "timestamp" }),
  apiToken: sqliteText("apiToken"),
  preferredLabels: sqliteText("preferredLabels"),
  theme: sqliteText("theme"),
});

const sqliteMedia = sqliteTable("Media", {
  id: sqliteText("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: sqliteInt("createdAt", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
  updatedAt: sqliteInt("updatedAt", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
  url: sqliteText("url").notNull(),
  thumbnailUrl: sqliteText("thumbnailUrl"),
  fileHash: sqliteText("fileHash"),
  labels: sqliteText("labels"),
  altText: sqliteText("altText"),
  width: sqliteInt("width"),
  height: sqliteInt("height"),
  color: sqliteText("color"),
  size: sqliteInt("size"),
  isPublic: sqliteInt("isPublic", { mode: "boolean" }).default(true).notNull(),
  userId: sqliteText("userId")
    .notNull()
    .references(() => sqliteUsers.id, { onDelete: "cascade" }),
});

// Export the correct schema based on database type
export const users = isPostgres ? pgUsers : sqliteUsers;
export const media = isPostgres ? pgMedia : sqliteMedia;

// Define relations (works for both databases)
export const usersRelations = relations(users, ({ many }) => ({
  medias: many(media),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  user: one(users, {
    fields: [media.userId],
    references: [users.id],
  }),
}));

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
