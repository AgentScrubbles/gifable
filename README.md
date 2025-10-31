# Gifable

Gifable is a self hostable gif library manager.

## Features

- Add gifs to your library with searchable comments.
- Find your perfect gif quickly.
- Upload gifs to your S3 compatible bucket.
- Works with javascript disabled.
- Keyboard / accessibility friendly.

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

Gifable supports multiple database providers:

- **SQLite** (default) - Perfect for single-server deployments and development
- **PostgreSQL** - Recommended for production, especially with managed services like Digital Ocean

See [docs/database-providers.md](docs/database-providers.md) for detailed configuration instructions, migration guides, and best practices.

### Quick Start with PostgreSQL

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Set your DATABASE_URL in `.env`:
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/gifable?sslmode=require"
   ```

3. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```

### Migrating from SQLite to PostgreSQL

**Important:** Keep `prisma/schema.prisma` as SQLite during migration. The script connects to both databases independently.

```bash
# Make sure schema.prisma still has provider = "sqlite"
SQLITE_URL="file:./dev.db" POSTGRES_URL="postgresql://user:password@host:5432/gifable?sslmode=require" npm run migrate:sqlite-to-postgres

# After successful migration, update schema.prisma to:
# provider = "postgresql"
# Then update your .env DATABASE_URL and run:
npx prisma generate
```

See the [database providers documentation](docs/database-providers.md) for detailed instructions.

## Configuration

See `.env.example` for all available configuration options.
