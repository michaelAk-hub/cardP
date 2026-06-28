# Blue Card admin dashboard image (build context = apps/admin).
#   docker build -f apps/admin/Dockerfile --build-arg VITE_API_URL=https://api.example/api -t blue-card-admin apps/admin
# Builds the Vite static bundle and serves it with nginx.

# ---- builder ----------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# VITE_API_URL is baked into the bundle at build time.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- runner -----------------------------------------------------------------
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
