# Rentora API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t rentora-api .
FROM node:22-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only the API's dependencies (and the shared package). tsx and prisma are
# needed at runtime: tsx runs the TypeScript, prisma applies migrations on start.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci -w @rentora/api --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN cd apps/api && npx prisma generate

# Uploaded lease documents live here. Mount a persistent volume on /data/uploads.
RUN mkdir -p /data/uploads && chown -R node:node /data /app/apps/api

ENV NODE_ENV=production \
    PORT=4000 \
    UPLOADS_DIR=/data/uploads

USER node
WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply any new database migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx tsx src/index.ts"]
