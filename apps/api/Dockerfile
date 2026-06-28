# Blue Card API + worker image (build context = repo root).
#   docker build -f apps/api/Dockerfile -t blue-card-api .
# The same image runs the API (default CMD) and the worker (command override).

# ---- builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Trim the monorepo to just api + shared so we don't pull the mobile/admin
# (Expo/React) toolchains into the API image.
COPY package.json ./
RUN node -e "const p=require('./package.json'); p.workspaces=['apps/api','packages/shared']; require('fs').writeFileSync('package.json', JSON.stringify(p));"
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @blue-card/shared \
 && npm run prisma:generate -w @blue-card/api \
 && npm run build -w @blue-card/api

# ---- runner -----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 3000
# API applies migrations on start, then serves. The worker overrides this CMD.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
