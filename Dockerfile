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

# Finally, build the production image with minimal footprint
FROM base

ENV NODE_ENV=production

RUN mkdir /app
WORKDIR /app

COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
COPY --from=build /app/public /app/public
ADD . .

LABEL org.opencontainers.image.source=https://github.com/pietvanzoen/gifable
LABEL org.opencontainers.image.description="Gifable: A simple gif libary."
LABEL org.opencontainers.image.licenses=MIT

EXPOSE 3000
CMD ["npm", "run", "start"]
