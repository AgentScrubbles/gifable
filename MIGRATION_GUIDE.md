# Migration Guide: Prisma to Drizzle ORM

This guide explains how to migrate your existing Gifable installation from Prisma to Drizzle ORM.

## Overview

Gifable has been migrated from Prisma ORM to Drizzle ORM to provide:
- **Multi-database support** via environment variables (no config file editing!)
- **Lighter bundle size** (~40x smaller than Prisma)
- **Simpler setup** - database type auto-detected from DATABASE_URL
- **Better performance** - leaner abstraction layer
- **Same database structure** - your existing data works without migration!

## For Existing Users

### Good News: Your Data is Safe! 🎉

The database table structure **has not changed**. You can upgrade to the new version without any data migration. Drizzle will work with your existing PostgreSQL or SQLite database.

### Migration Steps

1. **Update your code** (pull latest changes or update dependencies):
   ```bash
   git pull
   npm install
   ```

2. **Remove Prisma artifacts** (optional cleanup):
   ```bash
   rm -rf prisma/migrations
   rm prisma/schema.prisma
   rm -rf node_modules/.prisma
   ```

3. **Verify your DATABASE_URL** is set correctly in `.env`:
   ```bash
   # For SQLite
   DATABASE_URL="file:./data/gifable.db"

   # For PostgreSQL
   DATABASE_URL="postgresql://user:password@host:5432/gifable?sslmode=require"
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

That's it! Drizzle will automatically connect to your existing database.

## Database Type Support

Drizzle automatically detects your database type from the `DATABASE_URL`:

| DATABASE_URL starts with | Detected Type | Driver Used |
|-------------------------|---------------|-------------|
| `file:` | SQLite | better-sqlite3 |
| `postgres://` or `postgresql://` | PostgreSQL | postgres.js |

## New Commands

The following commands replace Prisma commands:

| Old Command (Prisma) | New Command (Drizzle) | Purpose |
|---------------------|----------------------|---------|
| `npx prisma generate` | *(not needed)* | Types are auto-generated |
| `npx prisma migrate deploy` | *(not needed)* | Existing DB works as-is |
| `npx prisma migrate dev` | `npm run db:generate` | Generate new migrations |
| `npx prisma db push` | `npm run db:push` | Push schema to DB |
| `npx prisma studio` | `npm run db:studio` | Open database GUI |

## Schema Changes

The database schema remains **identical**:

### User Table
- `id` (text/uuid)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `username` (text, unique)
- `passwordHash` (text)
- `isAdmin` (boolean)
- `lastLogin` (timestamp, nullable)
- `apiToken` (text, nullable)
- `preferredLabels` (text, nullable)
- `theme` (text, nullable)

### Media Table
- `id` (text/uuid)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `url` (text)
- `thumbnailUrl` (text, nullable)
- `fileHash` (text, nullable)
- `labels` (text, nullable)
- `altText` (text, nullable)
- `width` (integer, nullable)
- `height` (integer, nullable)
- `color` (text, nullable)
- `size` (integer, nullable)
- `isPublic` (boolean, default true)
- `userId` (text, foreign key to User)

## Switching Database Types

### From SQLite to PostgreSQL

If you want to migrate from SQLite to PostgreSQL:

```bash
# 1. Set up your PostgreSQL database

# 2. Run the migration script
SQLITE_URL="file:./data/gifable.db" \
POSTGRES_URL="postgresql://user:password@host:5432/gifable?sslmode=require" \
npm run migrate:sqlite-to-postgres

# 3. Update your .env file
DATABASE_URL="postgresql://user:password@host:5432/gifable?sslmode=require"

# 4. Restart the application
npm start
```

### From PostgreSQL to SQLite

This is less common, but if needed:

```bash
# 1. Export your PostgreSQL data
# 2. Create a new SQLite database
# 3. Import the data (manual process)
# 4. Update DATABASE_URL in .env
DATABASE_URL="file:./data/gifable.db"
```

## Development Workflow

### Running Locally

```bash
# Install dependencies
npm install

# Set up your database URL
cp .env.example .env
# Edit .env and set DATABASE_URL

# Start development server
npm run dev
```

### Creating New Migrations (Advanced)

If you're modifying the schema:

1. Edit `app/db/schema.ts`
2. Generate migration:
   ```bash
   npm run db:generate
   ```
3. Review the generated SQL in `drizzle/` directory
4. Apply to database:
   ```bash
   npm run db:push
   ```

## Troubleshooting

### "Cannot find module drizzle-orm"

Run `npm install` to install new dependencies.

### "DATABASE_URL is required"

Make sure your `.env` file has `DATABASE_URL` set correctly.

### "Table 'User' does not exist"

For new installations, run:
```bash
npm run db:push
```

For existing databases, verify your `DATABASE_URL` points to the correct database file/server.

### Type errors in IDE

Restart your TypeScript server:
- VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"

### Existing Prisma migrations folder

You can safely delete the `prisma/` directory after migration:
```bash
rm -rf prisma
```

## Technical Details

### Why Drizzle?

1. **Multi-database without config files**: Prisma required editing `schema.prisma` and running `prisma generate` to switch databases. Drizzle auto-detects from `DATABASE_URL`.

2. **Smaller footprint**: Prisma Client is ~2MB. Drizzle is ~50KB.

3. **Simpler migrations**: No intermediate migration files required for existing databases.

4. **Better DX**: Faster builds, no code generation delays, better TypeScript inference.

### File Changes

**New files:**
- `app/db/schema.ts` - Database schema (TypeScript)
- `drizzle.config.ts` - Drizzle configuration
- `app/db/seed.ts` - Seed script (moved from `prisma/seed.ts`)

**Updated files:**
- `app/utils/db.server.ts` - Drizzle client initialization
- All route files - Query syntax updated
- `package.json` - Dependencies and scripts

**Removed files:**
- `prisma/schema.prisma` - No longer needed
- `prisma/migrations/*` - No longer needed
- `node_modules/.prisma/` - Auto-generated Prisma files

## Getting Help

If you encounter issues:

1. Check your `DATABASE_URL` format
2. Verify the database file/server exists and is accessible
3. Check the logs for specific error messages
4. Consult the [Drizzle ORM documentation](https://orm.drizzle.team/)

## Rollback

If you need to rollback to Prisma:

1. Check out the previous git commit before the Drizzle migration
2. Run `npm install`
3. Run `npx prisma generate`

Note: Your data is safe regardless - the database structure hasn't changed.
