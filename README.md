# Gifable


Gifable is a self hostable gif library manager.

## Features

- Add gifs to your library with searchable comments.
- Find your perfect gif quickly.
- Upload gifs to your S3 compatible bucket.
- Works with javascript disabled.
- Keyboard / accessibility friendly.
- **Matrix Federation** - Share GIFs with Matrix clients (Element, Gomuks, etc.) using MXC URIs.

## Running with docker

Gifable is available as a docker image.

```sh
docker pull ghcr.io/pietvanzoen/gifable:latest
```

To run the image first setup your configuration. Copy the `.env.example` and update as needed.

```sh
curl https://raw.githubusercontent.com/pietvanzoen/gifable/main/.env.example -o .env
```

Then run the image using `--env-file` flag. You'll also want to attach a volume for the database so it is persisted between runs. In this example we're using a directory `/data` to store the database file. You don't need to create the file, the app will create one if it doesn't exist.

```sh
docker run -d \
  --name gifable \
  --env-file=$PWD/.env \
  -v $PWD/data:/data \
  -e DATABASE_URL="file:/data/gifable.db" \
  ghcr.io/pietvanzoen/gifable:latest
```

## Database Support

Gifable uses **Drizzle ORM** for database management, supporting multiple database providers with automatic switching via environment variables:

- **SQLite** (default) - Perfect for single-server deployments and development
- **PostgreSQL** - Recommended for production, especially with managed services like Digital Ocean
- **MySQL** - Also supported through Drizzle ORM

The database provider is **automatically detected** from your `DATABASE_URL` - no configuration files to edit!

### Quick Start with SQLite (Default)

Simply set your DATABASE_URL in `.env`:
```bash
DATABASE_URL="file:./data/gifable.db"
```

### Quick Start with PostgreSQL

1. Set your DATABASE_URL in `.env`:
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/gifable?sslmode=require"
   ```

2. That's it! The app automatically detects PostgreSQL and uses the correct driver.

### Database Commands

```bash
# Push schema to database (creates/updates tables for existing databases)
npm run db:push

# Generate migration files (for new schemas)
npm run db:generate

# Open Drizzle Studio (database GUI)
npm run db:studio

# Run seed script
npm run db:seed
```

### Migrating from SQLite to PostgreSQL

The migration script automatically handles database type differences:

```bash
SQLITE_URL="file:./dev.db" \
POSTGRES_URL="postgresql://user:password@host:5432/gifable?sslmode=require" \
npm run migrate:sqlite-to-postgres

# Then update your .env DATABASE_URL to the PostgreSQL URL
```

### Connecting to an Existing Database

If you have an **existing database** from a previous Prisma installation:

1. **No migration needed!** Drizzle works with your existing tables.

2. Simply set your `DATABASE_URL`:
   ```bash
   # For SQLite
   DATABASE_URL="file:./data/gifable.db"

   # For PostgreSQL
   DATABASE_URL="postgresql://user:password@host:5432/gifable?sslmode=require"
   ```

3. Drizzle will automatically connect to your existing database structure.

**Note:** The table structure remains the same (User and Media tables), so existing Prisma databases work seamlessly with Drizzle.

## Configuration

See `.env.example` for all available configuration options.

## Matrix Federation

Gifable supports Matrix federation, allowing Matrix clients to use your GIFs via MXC URIs (`mxc://`). This enables seamless integration with Matrix messaging platforms like Element, Gomuks, FluffyChat, and more.

### How It Works

- Your Gifable instance acts as a Matrix media server
- Public media can be referenced using `mxc://your-domain.com/media-id` URIs
- Matrix homeservers fetch media via standard Matrix endpoints
- No duplicates - the same GIF = the same MXC URI across all Matrix rooms
- Homeservers cache media and can independently manage cleanup
- All media is proxied through your server with proper CORS headers (no S3 redirects)

### Setup

1. **Set your public domain** in `.env`:
   ```bash
   APP_URL=https://gifs.example.com
   ```

2. **Ensure media is public** - Only public media is accessible via federation

3. **That's it!** Matrix endpoints are automatically available:
   - `/.well-known/matrix/server` - Server discovery
   - `/_matrix/media/v3/download/{serverName}/{mediaId}` - Media downloads
   - `/_matrix/media/v3/thumbnail/{serverName}/{mediaId}` - Thumbnails
   - `/_matrix/media/search?q=query&limit=20` - Search for GIFs (returns MXC URIs)

### Usage

Generate MXC URIs in your code:

```typescript
import { getMxcUri } from "~/utils/media.server";

const mxcUri = getMxcUri(mediaId);
// Returns: "mxc://gifs.example.com/abc-123-def"
```

### Testing

Test your Matrix federation setup:

```bash
# Run the test script
APP_URL=http://localhost:3000 TEST_MEDIA_ID=your-media-id ./scripts/test-matrix-federation.sh

# Or test manually
curl https://gifs.example.com/.well-known/matrix/server
```

### Search API

Search for GIFs and get results as MXC URIs for use in Matrix sticker pickers:

```bash
# Search for cat GIFs
curl "https://gifs.example.com/_matrix/media/search?q=cat&limit=10"

# Response includes MXC URIs ready to use
{
  "results": [
    {
      "id": "abc-123",
      "mxc": "mxc://gifs.example.com/abc-123",
      "body": "Cute cat GIF",
      "tags": ["cat", "cute", "animal"],
      "info": { "w": 640, "h": 480, "mimetype": "image/gif" },
      ...
    }
  ],
  "count": 10,
  "query": "cat"
}
```

Perfect for building custom Matrix sticker picker widgets!

For detailed documentation, see:
- [docs/matrix-federation.md](docs/matrix-federation.md) - Complete guide
- [docs/matrix-federation-testing.md](docs/matrix-federation-testing.md) - Testing instructions
- [docs/matrix-search-api.md](docs/matrix-search-api.md) - Search API reference
