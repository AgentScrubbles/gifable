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

## API Keys

Gifable supports API key authentication for accessing the search endpoint without requiring a login session. This is perfect for integrating Gifable with external applications, mobile apps, CI/CD pipelines, or automation tools.

### Features

- **Optional** - API keys can be enabled or disabled via environment variable
- **User-managed** - Each user can create and manage their own API keys
- **Indefinite validity** - Keys remain active until disabled or deleted
- **Enable/Disable** - Temporarily disable keys without deleting them
- **Usage tracking** - See when each key was last used

### Configuration

API keys are **enabled by default**. To disable the feature entirely:

```bash
# In your .env file
ENABLE_API_KEYS=false
```

### Creating API Keys

1. Log in to your Gifable instance
2. Navigate to **Settings**
3. Scroll to the **API Keys** section
4. Enter an optional name (e.g., "Mobile App", "CI/CD Pipeline")
5. Click **Create New API Key**
6. **Important:** Copy the key immediately - you won't be able to see it again!

Keys follow the format: `gbl_<random_string>`

### Using API Keys

API keys can be used to authenticate requests to the `/search` endpoint. Provide the key using either of these methods:

#### Option 1: Authorization Header (Bearer Token)

```bash
curl -H "Authorization: Bearer gbl_your_api_key_here" \
  "https://gifs.example.com/search?q=cat&limit=10"
```

#### Option 2: X-Api-Key Header

```bash
curl -H "X-Api-Key: gbl_your_api_key_here" \
  "https://gifs.example.com/search?q=cat&limit=10"
```

### Authenticated Endpoints

The following endpoints require authentication via session cookie or API key:

- **`/search`** - Search for GIFs with query parameters

All other endpoints remain open:
- **Media downloads** - Public media can be accessed without authentication
- **Matrix federation endpoints** - Always open for federation
- **Thumbnails** - Public media thumbnails are accessible

### Managing API Keys

In the Settings page, you can:

- **View all keys** - See all your API keys with creation and last-used dates
- **Disable/Enable** - Temporarily disable keys without deleting them
- **Delete** - Permanently remove API keys (cannot be undone)
- **Reveal** - Show the full key value (useful if you need to copy it again)

### Security Best Practices

- **Keep keys secret** - Treat API keys like passwords
- **Use descriptive names** - Name keys based on their purpose for easy management
- **Rotate regularly** - Create new keys and delete old ones periodically
- **Disable unused keys** - Temporarily disable keys instead of deleting if unsure
- **Monitor usage** - Check the "last used" timestamp to identify inactive keys

### Example: Using API Keys in Scripts

```bash
#!/bin/bash
API_KEY="gbl_your_api_key_here"
GIFABLE_URL="https://gifs.example.com"

# Search for GIFs
curl -H "Authorization: Bearer $API_KEY" \
  "${GIFABLE_URL}/search?q=celebration&limit=5"
```

### Example: Using API Keys in JavaScript

```javascript
const API_KEY = 'gbl_your_api_key_here';
const GIFABLE_URL = 'https://gifs.example.com';

async function searchGifs(query) {
  const response = await fetch(
    `${GIFABLE_URL}/search?q=${encodeURIComponent(query)}&limit=20`,
    {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    }
  );
  return response.json();
}

searchGifs('cat').then(data => console.log(data));
```
