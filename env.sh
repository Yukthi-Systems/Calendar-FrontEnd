#!/bin/sh

# Runtime config for the web build. The image is built once with no .env, and this
# script writes web-build/env-config.js from the container's env vars on every start,
# so one image can be pointed at any environment (see tasks-webui/.env.example).
# src/config/env.web.ts reads window._env_ first, falling back to build-time values.

cd /app

cat > ./web-build/env-config.js <<CONFIG
window._env_ = {
  API_URL: "${API_URL}",
  SSO_URL: "${SSO_URL}",
  SSO_APP_ID: "${SSO_APP_ID}",
};
CONFIG

# Execute the passed command (starts the server)
exec "$@"
