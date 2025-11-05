#!/bin/sh
set -e

echo "🚀 Starting Gifable..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Seed admin user if configured
echo "👤 Checking for admin user..."
node ./seed-admin.js

# Start the application
echo "✅ Starting server..."
exec node -r dotenv/config node_modules/.bin/remix-serve build
