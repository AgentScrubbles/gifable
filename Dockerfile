# base node image
FROM node:20-alpine AS base

# Install openssl for database connections
RUN apk add --update openssl && rm -rf /var/cache/apk/*

# Install all node_modules, including dev dependencies
FROM base AS deps

RUN mkdir /app
WORKDIR /app

ADD package.json package-lock.json ./
RUN npm install --production=false

# Setup production node_modules
FROM base AS production-deps

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules
ADD package.json package-lock.json ./
RUN npm prune --production

# Build the app
FROM base AS build

RUN mkdir /app
WORKDIR /app

COPY --from=deps /app/node_modules /app/node_modules

RUN apk add --update curl && rm -rf /var/cache/apk/*

ADD . .
RUN npm run build

# Compile seed-admin.ts to JavaScript for production
RUN npx esbuild seed-admin.ts --bundle --platform=node --format=cjs --outfile=seed-admin.js --external:postgres --external:better-sqlite3 --external:drizzle-orm --external:bcryptjs --external:dotenv

# Finally, build the production image with minimal footprint
FROM base

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public
COPY --from=build /app/seed-admin.js /app/seed-admin.js
COPY --from=build /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=build /app/app/db/schema.ts /app/app/db/schema.ts
ADD . .

# Copy and prepare startup script
COPY docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh

LABEL org.opencontainers.image.source=https://github.com/pietvanzoen/gifable
LABEL org.opencontainers.image.description="Gifable: A simple gif libary."
LABEL org.opencontainers.image.licenses=MIT

EXPOSE 3000
CMD ["/app/docker-start.sh"]
