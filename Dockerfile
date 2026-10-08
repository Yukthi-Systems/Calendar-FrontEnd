# Stage 1: Build the web bundle
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:web

# Stage 2: Serve the static build
FROM node:24-alpine

WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/web-build /app/web-build
COPY env.sh /app/env.sh
RUN chmod +x /app/env.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# env.sh writes web-build/env-config.js from the container env, then exec's CMD
ENTRYPOINT ["/app/env.sh"]
CMD ["serve", "-s", "web-build", "-l", "3000"]
