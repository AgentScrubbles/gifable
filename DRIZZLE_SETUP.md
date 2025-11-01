# Drizzle ORM Setup Guide

This document explains how to set up and use Gifable with Drizzle ORM, including connecting to existing databases.

## Quick Start

### For New Installations

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up your database URL** in `.env`:
   ```bash
   # For SQLite (default)
   DATABASE_URL="file:./data/gifable.db"

   # For PostgreSQL
   DATABASE_URL="postgresql://user:password@localhost:5432/gifable?sslmode=require"
   ```

3. **Initialize the database** (creates tables if they don't exist):
   ```bash
   npm run db:push
   ```

4. **Start the application**:
   ```bash
   npm start
   ```

### For Existing Databases

If you have an **existing database** from a previous installation (Prisma or otherwise):

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set your DATABASE_URL** in `.env` to point to your existing database:
   ```bash
   # For SQLite
   DATABASE_URL="file:./path/to/existing/gifable.db"

   # For PostgreSQL
   DATABASE_URL="postgresql://user:password@host:5432/existing_database"
   ```

3. **Start the application** (no migration needed!):
   ```bash
   npm start
   ```

That's it! Drizzle will automatically connect to your existing tables.

## Supported Databases

Drizzle automatically detects your database type from the `DATABASE_URL`:

### SQLite

Perfect for self-hosted, single-server deployments.

**Format:**
```bash
DATABASE_URL="file:./data/gifable.db"
# Or absolute path
DATABASE_URL="file:/absolute/path/to/gifable.db"
```

**Advantages:**
- No separate database server needed
- Single file database
- Perfect for Docker containers
- Easy backups (just copy the .db file)

**When to use:**
- Personal installations
- Small to medium sized deployments (up to 100K media items)
- Development

### PostgreSQL

Recommended for production deployments.

**Format:**
```bash
# Standard connection string
DATABASE_URL="postgresql://username:password@host:5432/database_name"

# With SSL (recommended for production)
DATABASE_URL="postgresql://username:password@host:5432/database_name?sslmode=require"

# Managed services (e.g., Digital Ocean, Heroku)
DATABASE_URL="postgresql://user:pass@host.db.ondigitalocean.com:25060/gifable?sslmode=require"
```

**Advantages:**
- Better concurrency
- Advanced indexing
- Managed service options
- Better for high-traffic deployments

**When to use:**
- Production deployments
- Multiple concurrent users
- Large datasets (100K+ media items)
- Cloud-hosted applications

## Available Commands

### Database Management

```bash
# Push schema to database (for existing databases or schema changes)
npm run db:push

# Generate migration files (for tracking schema changes)
npm run db:generate

# Open Drizzle Studio (visual database browser)
npm run db:studio

# Run database seed script
npm run db:seed
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
```

## Database Schema

The database uses two tables:

### User Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/UUID | PRIMARY KEY | User ID |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |
| username | TEXT | UNIQUE, NOT NULL | Login username |
| passwordHash | TEXT | NOT NULL | Hashed password |
| isAdmin | BOOLEAN | DEFAULT false | Admin flag |
| lastLogin | TIMESTAMP | NULLABLE | Last login time |
| apiToken | TEXT | NULLABLE | API authentication token |
| preferredLabels | TEXT | NULLABLE | Preferred search labels |
| theme | TEXT | NULLABLE | UI theme preference |

### Media Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT/UUID | PRIMARY KEY | Media ID |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |
| url | TEXT | NOT NULL | Media file URL |
| thumbnailUrl | TEXT | NULLABLE | Thumbnail URL |
| fileHash | TEXT | NULLABLE | File hash for deduplication |
| labels | TEXT | NULLABLE | Comma-separated tags |
| altText | TEXT | NULLABLE | Accessibility text |
| width | INTEGER | NULLABLE | Image width in pixels |
| height | INTEGER | NULLABLE | Image height in pixels |
| color | TEXT | NULLABLE | Dominant color (hex) |
| size | INTEGER | NULLABLE | File size in bytes |
| isPublic | BOOLEAN | DEFAULT true | Public/private flag |
| userId | TEXT | FOREIGN KEY, NOT NULL | Owner user ID |

**Foreign Key:** `userId` references `User.id` with `ON DELETE CASCADE`

## Environment Variables

### Required

```bash
# Database connection string
DATABASE_URL="file:./data/gifable.db"

# Session secret for cookies
SESSION_SECRET="your-random-secret-here"

# Public URL of your instance
APP_URL="https://gifs.example.com"
```

### Optional

See `.env.example` for all available options including:
- S3 storage configuration
- Admin user setup
- File upload limits
- Custom storage providers

## Connecting to Existing Databases

### From Prisma

If you previously used Prisma, **no migration is needed**. The table structure is identical:

1. Keep your existing database
2. Update `DATABASE_URL` in `.env`
3. Run `npm install`
4. Run `npm start`

Your data will work immediately.

### From Other ORMs

If your database has the same table structure (User and Media tables with the columns listed above), Drizzle will work automatically.

If your schema is different, you'll need to:
1. Export your data
2. Create a new database with Drizzle's schema
3. Import your data

## Switching Database Types

### SQLite to PostgreSQL

Use the built-in migration script:

```bash
# 1. Set up your PostgreSQL database first

# 2. Run migration script
SQLITE_URL="file:./data/gifable.db" \
POSTGRES_URL="postgresql://user:pass@host:5432/gifable" \
npm run migrate:sqlite-to-postgres

# 3. Update .env
DATABASE_URL="postgresql://user:pass@host:5432/gifable"

# 4. Restart application
npm start
```

### PostgreSQL to SQLite

Less common, but possible:

```bash
# 1. Export PostgreSQL data (manual process)
# 2. Create SQLite database: npm run db:push
# 3. Import data
# 4. Update .env with SQLite URL
```

## Docker Setup

### With SQLite

```dockerfile
# In your Dockerfile
ENV DATABASE_URL="file:/data/gifable.db"
VOLUME /data
```

```bash
docker run -d \
  --name gifable \
  --env-file=.env \
  -v $PWD/data:/data \
  -e DATABASE_URL="file:/data/gifable.db" \
  ghcr.io/pietvanzoen/gifable:latest
```

### With PostgreSQL

```bash
docker run -d \
  --name gifable \
  --env-file=.env \
  -e DATABASE_URL="postgresql://user:pass@postgres-host:5432/gifable" \
  ghcr.io/pietvanzoen/gifable:latest
```

## Troubleshooting

### "DATABASE_URL is required"

Make sure `.env` file exists and contains `DATABASE_URL`.

### "Table 'User' does not exist"

For new databases, run:
```bash
npm run db:push
```

For existing databases, verify your `DATABASE_URL` is correct.

### TypeScript errors

Restart your TypeScript server:
- VS Code: `Cmd/Ctrl + Shift + P` → "TypeScript: Restart TS Server"
- Or restart your IDE

### Connection errors

**SQLite:**
- Verify the file path exists and is writable
- Check file permissions

**PostgreSQL:**
- Verify connection string format
- Test connection: `psql $DATABASE_URL`
- Check firewall/security groups
- Verify SSL mode matches server requirements

### Performance Issues

**SQLite:**
- Consider upgrading to PostgreSQL for >50K media items
- Ensure database file is on fast storage (SSD)

**PostgreSQL:**
- Add indexes if needed (Drizzle handles basic indexes)
- Check connection pool settings
- Monitor query performance with `DEBUG=app:* npm start`

## Advanced Topics

### Custom Migrations

If you need to modify the schema:

1. Edit `app/db/schema.ts`
2. Generate migration:
   ```bash
   npm run db:generate
   ```
3. Review generated SQL in `drizzle/` directory
4. Apply to database:
   ```bash
   npm run db:push
   ```

### Multiple Environments

Use different `.env` files:

```bash
# Development
DATABASE_URL="file:./dev.db"

# Production
DATABASE_URL="postgresql://..."

# Testing
DATABASE_URL="file:./test.db"
```

### Backup Strategies

**SQLite:**
```bash
# Simple file copy
cp data/gifable.db data/gifable.backup.db

# With timestamp
cp data/gifable.db data/gifable.$(date +%Y%m%d).db
```

**PostgreSQL:**
```bash
# Using pg_dump
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Getting Help

- Check the [Migration Guide](./MIGRATION_GUIDE.md) for upgrading from Prisma
- See [Drizzle ORM documentation](https://orm.drizzle.team/)
- Review the [README](./README.md) for general setup
- Check GitHub issues

## Reference

- **Schema definition**: `app/db/schema.ts`
- **Database client**: `app/utils/db.server.ts`
- **Seed script**: `app/db/seed.ts`
- **Config file**: `drizzle.config.ts`
